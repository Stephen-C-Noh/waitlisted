# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Status

The Next.js app is built and running (`src/`, `npm run dev`, Vitest via `npm test`). `Plans/` and `Guide/` hold the original specs and design assets; where they disagree with the code, the code wins.

**Source-of-truth order for specs** (newer overrides older):
1. `Plans/waitlisted-project-description.md` — current stack, routes, auth model (authoritative)
2. `Plans/implementation-plan.md` — earlier deep-dive; still correct for directory layout, DB schema details, wait-time algorithm, and mockup references, but some stack/auth details are stale

Note: the app is named **Waitlisted**. The older `implementation-plan.md` refers to it as "LUXE TABLE" — that is the old name; use "Waitlisted" in new code, env, and docs.

## Layout

- `Plans/implementation-plan.md` — full implementation plan for the Waitlisted app. Read this before making architectural decisions; it dictates directory structure, API routes, DB schema additions, auth flow, and phase ordering.
- `Guide/Database/V1`–`V6` — Flyway migrations from the sibling `restaurant-pos` Spring Boot project. These define the **shared PostgreSQL schema** this app reads from and writes to. `V1` = core POS tables (users, menu_items, tables, orders), `V5` = seeded staff with bcrypt(cost=4) PIN hashes, `V6` = seeded tables across zones.
- `Guide/Design/DESIGN.md` — "Digital Maître D'" design system. Non-negotiable rules: no 1px dividers (use tonal background shifts), no pure white (use `on_surface #e5e2e1`), gold `#e9c176` reserved for "moment of truth" CTAs, tonal layering instead of shadow elevation levels.
- `Guide/Design/*/code.html` — five HTML mockups. Each includes the **authoritative Tailwind token map** in an inline `<script>` at the top; `customer_waitlist_entry/code.html` lines 15–62 is the canonical source. All five mockups share the same tokens.

## Stack

Next.js **16.2.1** (App Router) + TypeScript 5 + Tailwind **v4** (CSS-first via `@theme` in `globals.css`, no `tailwind.config.*`) + **Prisma 7** with `@prisma/adapter-pg` + PostgreSQL 16 + TanStack Query v5 + Zustand v5 + Framer Motion v12 + `jose` v6 + `bcryptjs` v3 + Zod v4. Middleware file is **`proxy.ts`** (Next.js 16), not `middleware.ts`.

## Architecture

Hybrid Next.js + Spring Boot system sharing one Postgres database:

- **Reads** (menu, tables, waitlist) go directly through **Prisma** for speed.
- **Writes with business logic** (table status changes on seat, create+fire order) go through the **Spring Boot POS** at `http://localhost:8090` so its state machine, Kafka events, and WebSocket broadcasts fire.
- **Only the POS changes POS-owned tables** (`tables`, `orders`, `users`, ...). If a POS call fails (503 unreachable, POS 4xx passed through, 502 on POS 5xx/auth) the route returns the error via `posFailure()` and writes nothing; there is **no Prisma fallback**. `src/lib/no-pos-writes.test.ts` fails on any `prisma.<pos table>.create/update/...` or `$executeRaw` under `src/`.
- **Cloud mode** (`POS_INTEGRATION_ENABLED=false`, no POS deployed): `DashboardPage` reads the flag on the server (`isPosIntegrationEnabled()`) and passes `posEnabled` down; Seat, Fire and table-status controls are disabled with the note in `src/lib/pos-mode.ts`. The 503 from the API stays as the safety net.
- Prisma introspects existing POS tables (`prisma db pull`) and owns only three **new** tables: `waitlist_entries`, `pre_orders`, `pre_order_items`. FKs to POS tables (`tables`, `users`, `menu_items`) are enforced at app level only — do not add Prisma relations to introspected models or migrations will conflict.

### Route groups

- `(public)` — `/`, `/slideshow`, `/waitlist`, `/waitlist/[token]/confirmation`, `/waitlist/[token]/status`, `/menu/[token]`
- `(staff)` — `/admin/login`, `/admin/dashboard`
- `proxy.ts` guards `/admin/*` by verifying the staff JWT cookie.

### Metrics

Wrap every POS-writing route, the login route and the waitlist create/list/status routes (and any new route of those kinds) in `withMetrics("<route template>", handler)` from `src/lib/metrics.ts`, using the template (`/api/waitlist/[id]/seat`), never the concrete URL, so the `route` label stays bounded. Other routes (health, menu, reads) are deliberately unwrapped (plan Decision 2).

### Polling cadence

`useWaitlistPolling` = 10 s (guest status page). `useDashboardPolling` runs two queries: waitlist 5 s, tables 15 s. Use TanStack Query `refetchInterval`.

### PIN-only login (no username)

Login takes a **4-digit PIN only**. The `POST /api/auth/login` route loads all active users with non-null `pin_hash` (excluding KITCHEN role) and iterates `bcryptjs.compare` until one matches — **do not add a username field**. Use **bcrypt cost factor 4** to match Spring Boot's `BCryptPasswordEncoder(4)`; do not raise it.

Two tokens are issued: the Next.js JWT (via `jose`) stored as `staff-token` and the Spring Boot POS token stored as `pos-token`. Both cookies are **HttpOnly, SameSite=Strict**. The POS token is needed for Spring Boot write calls (seat, fire).

Customers have no account: each `waitlist_entries` row carries a 64-hex `access_token` embedded in URLs (`/waitlist/{token}/confirmation`, `/waitlist/{token}/status`, `/menu/{token}`). Tokens for entries in `CANCELLED`/`SEATED` state must be rejected by the token-gated public routes.

### Seating and firing are **separate** actions (do not merge)

This is a load-bearing UX rule, not a cleanup candidate:

1. **Seat guest** — updates table status via Spring Boot (`PATCH /api/tables/{id}/status` with `serverId` = the seating user; the POS records `current_server_id`) and, only if the POS succeeds, sets `waitlist_entries.status = SEATED`. **Does not** touch the pre-order. This lets the server walk the party to the table and verbally confirm the order with the guest.
2. **Fire pre-order** — a distinct dashboard action. Prompts the acting staff member for their **4-digit PIN a second time**. The PIN is sent in the `POST /api/orders/from-preorder` body and re-verified server-side against the **logged-in user's own** `users.pin_hash` (looked up by the session `userId`, never a scan of all users, so another staff member's PIN is rejected with 401 "Invalid PIN") before the route calls Spring Boot's `POST /api/orders` + `/fire`. The create payload carries `serverId` = the session user (no `unitPrice`; the POS prices from the menu). The route saves `fired_order_id` together with `fired_by_user_id` = the user who created the POS order (always equal to `orders.server_id`) as soon as the POS creates it (status stays `CONFIRMED`, so a retry fires that order instead of creating another, and keeps `fired_by_user_id` even if a different user retries); only after the POS fire succeeds does it set `pre_orders.status = FIRED`. Who approved a retry is not recorded (one column; add one if that audit is ever needed). So `fired_order_id` can be set on a `CONFIRMED` row; check `status`, not the id, to know whether it was fired.

Never wire the "seat" action to automatically fire the pre-order, even for convenience — the second PIN gate exists so a kitchen ticket can't be created without a human confirming at that moment.

### Kiosk idle model

The app runs on a touch-only tablet. `useIdleDetection` listens to **`touchstart` only** (no keyboard/mouse). Any touch on `/slideshow` navigates to `/waitlist`; 2 minutes of inactivity on any other public page returns to `/slideshow`.

### Wait time algorithm

Lives in `src/lib/wait-time.ts`. Constants reflect high-end dining: `AVG_DINING_DURATION=90`, `TABLE_TURNOVER_BUFFER=10`, `avgRemainingTime=50`. Output is clamped `[5, 150]`, rounded to nearest 5, and displayed as a ±5 range. See plan §8 for the full formula.

## Bootstrapping commands (per the plan)

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
npx prisma init
npx prisma db pull                                    # introspect POS schema first
```

Migrations: `prisma/migrations/` holds only the three waitlist tables; on a fresh database run `npm run db:setup` after the POS stack is up (plain `migrate deploy` fails with P3005 because the POS tables make the schema non-empty); after that, `npx prisma migrate deploy` applies newer migrations. **Never run `prisma migrate dev`**: the schema includes introspected POS tables that are not in the migration history, so `dev` would try to create or reset them. Write new migrations by hand or with `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script`, keeping only the waitlist statements.

Required env (`.env.local`): `DATABASE_URL` (shared POS Postgres), `JWT_SECRET`, `SPRING_BOOT_URL=http://localhost:8090`, `NEXT_PUBLIC_BASE_URL`, `SMS_PROVIDER=console`. Optional: `METRICS_TOKEN` protects `GET /api/metrics`: set, the request must send `Authorization: Bearer <token>` (401 otherwise, constant-time compare); unset, the endpoint is open outside production and returns 404 in production. Prometheus sends it with `authorization: { credentials: <token> }` in its scrape config.

Commands: `npm run dev` (dev server; it rewrites `AGENTS.md`, revert that), `npm test` (Vitest), `npm run lint`, `npx tsc --noEmit`.
