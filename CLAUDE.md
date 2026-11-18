# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Status

This repo currently contains **only specs and design assets** — no application code, no `package.json`, no build system yet. The Next.js app described below has not been scaffolded.

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

## Architecture (once scaffolded)

Hybrid Next.js + Spring Boot system sharing one Postgres database:

- **Reads** (menu, tables, waitlist) go directly through **Prisma** for speed.
- **Writes with business logic** (table status changes on seat, create+fire order) go through the **Spring Boot POS** at `http://localhost:8090` so its state machine, Kafka events, and WebSocket broadcasts fire.
- Prisma introspects existing POS tables (`prisma db pull`) and owns only three **new** tables: `waitlist_entries`, `pre_orders`, `pre_order_items`. FKs to POS tables (`tables`, `users`, `menu_items`) are enforced at app level only — do not add Prisma relations to introspected models or migrations will conflict.

### Route groups

- `(public)` — `/`, `/slideshow`, `/waitlist`, `/waitlist/[token]/confirmation`, `/waitlist/[token]/status`, `/menu/[token]`
- `(staff)` — `/admin/login`, `/admin/dashboard`
- `proxy.ts` guards `/admin/*` by verifying the staff JWT cookie.

### Polling cadence

`useWaitlistPolling` = 10 s (guest status page). `useDashboardPolling` runs two queries: waitlist 5 s, tables 15 s. Use TanStack Query `refetchInterval`.

### PIN-only login (no username)

Login takes a **4-digit PIN only**. The `POST /api/auth/login` route loads all active users with non-null `pin_hash` (excluding KITCHEN role) and iterates `bcryptjs.compare` until one matches — **do not add a username field**. Use **bcrypt cost factor 4** to match Spring Boot's `BCryptPasswordEncoder(4)`; do not raise it.

Two tokens are issued: the Next.js JWT (via `jose`) stored as `staff-token` and the Spring Boot POS token stored as `pos-token`. Both cookies are **HttpOnly, SameSite=Strict**. The POS token is needed for Spring Boot write calls (seat, fire).

Customers have no account: each `waitlist_entries` row carries a 64-hex `access_token` embedded in URLs (`/waitlist/{token}/confirmation`, `/waitlist/{token}/status`, `/menu/{token}`). Tokens for entries in `CANCELLED`/`SEATED` state must be rejected by the token-gated public routes.

### Seating and firing are **separate** actions (do not merge)

This is a load-bearing UX rule, not a cleanup candidate:

1. **Seat guest** — updates table status via Spring Boot and sets `waitlist_entries.status = SEATED`. **Does not** touch the pre-order. This lets the server walk the party to the table and verbally confirm the order with the guest.
2. **Fire pre-order** — a distinct dashboard action. Prompts the acting staff member for their **4-digit PIN a second time**. The PIN is sent in the `POST /api/orders/from-preorder` body and re-verified server-side against `users.pin_hash` before the route calls Spring Boot's `POST /api/orders` + `/fire`. On success the route sets `pre_orders.status = FIRED`, `fired_order_id`, and `fired_by_user_id` (audit trail of who authorized the fire).

Never wire the "seat" action to automatically fire the pre-order, even for convenience — the second PIN gate exists so a kitchen ticket can't be created without a human confirming at that moment.

### Kiosk idle model

The app runs on a touch-only tablet. `useIdleDetection` listens to **`touchstart` only** (no keyboard/mouse). Any touch on `/slideshow` navigates to `/waitlist`; 2 minutes of inactivity on any other public page returns to `/slideshow`.

### Wait time algorithm

Lives in `src/lib/wait-time.ts` (to be created). Constants reflect high-end dining: `AVG_DINING_DURATION=90`, `TABLE_TURNOVER_BUFFER=10`, `avgRemainingTime=50`. Output is clamped `[5, 150]`, rounded to nearest 5, and displayed as a ±5 range. See plan §8 for the full formula.

## Bootstrapping commands (per the plan)

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
npx prisma init
npx prisma db pull                                    # introspect POS schema first
```

Migrations: `prisma/migrations/` holds only the three waitlist tables; apply with `npx prisma migrate deploy` after the POS stack is up. **Never run `prisma migrate dev`**: the schema includes introspected POS tables that are not in the migration history, so `dev` would try to create or reset them. Write new migrations by hand or with `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script`, keeping only the waitlist statements.

Required env (`.env.local`): `DATABASE_URL` (shared POS Postgres), `JWT_SECRET`, `SPRING_BOOT_URL=http://localhost:8090`, `NEXT_PUBLIC_BASE_URL`, `SMS_PROVIDER=console`.

No lint/test/run commands exist yet — add them here once the Next.js project is scaffolded.
