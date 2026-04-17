# Waitlisted

A waitlist and pre-order kiosk for a fine-dining restaurant. Submitted as a school project.

Waitlisted runs on a touch-only tablet at the host stand. Guests add themselves to the waitlist, get a trackable status link via SMS, and can browse the menu and build a pre-order while they wait. Staff use a PIN-authenticated dashboard to seat guests, manage tables, and fire confirmed pre-orders to the kitchen.

## Architecture

Waitlisted is the **guest-facing half** of a two-app system. The other half is a separate Spring Boot POS that owns the shared Postgres database's state machine, Kafka events, and WebSocket broadcasts.

- **Reads** (menu, tables, waitlist) go directly through Prisma for speed.
- **Writes with business logic** (table status changes, create + fire order) go through the Spring Boot POS at `http://localhost:8090` so its state machine fires correctly.
- Prisma owns three new tables: `waitlist_entries`, `pre_orders`, `pre_order_items`. All other tables are introspected from the POS schema.

See `Plans/waitlisted-project-description.md` and `Plans/implementation-plan.md` for the full spec.

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript 5**
- **Tailwind v4** (CSS-first via `@theme` in `globals.css`)
- **Prisma 7** with `@prisma/adapter-pg` → PostgreSQL 16
- **TanStack Query v5**, **Zustand v5**, **Framer Motion v12**
- **jose** (JWT), **bcryptjs** (PIN hashing), **Zod** (validation)

Middleware lives in `proxy.ts` (Next.js 16 naming), not `middleware.ts`.

## Route map

### Public (`src/app/(public)`)
- `/` and `/slideshow` — idle menu slideshow; any touch navigates to `/waitlist`
- `/waitlist` — guest entry form (name, party size, phone, zone)
- `/waitlist/[token]/confirmation` — post-submit confirmation with queue position
- `/waitlist/[token]/status` — live-polling status page (10s)
- `/menu/[token]` — pre-order menu and cart

### Staff (`src/app/(staff)`)
- `/admin/login` — 4-digit PIN login
- `/admin/dashboard` — waitlist, floor map, pre-orders

`proxy.ts` guards `/admin/*` by verifying the staff JWT cookie.

## Two load-bearing UX rules

1. **Seat and fire are separate actions.** Seating a guest updates the table status and marks the waitlist entry `SEATED`. It does **not** fire the pre-order. That's a distinct dashboard action.
2. **Firing requires a second PIN.** Before calling the POS `POST /api/orders` + `/fire`, the staff member re-enters their 4-digit PIN. The PIN is re-verified server-side, and the authorizing user's id is recorded in `pre_orders.fired_by_user_id` for audit.

This keeps a kitchen ticket from being created without a human confirming at that exact moment.

## Auth model

- **Staff**: PIN-only (no username). `POST /api/auth/login` iterates active non-KITCHEN users with a non-null `pin_hash` and runs `bcryptjs.compare` until one matches. Uses **bcrypt cost 4** to match the Spring Boot `BCryptPasswordEncoder(4)`. Two cookies are issued: `staff-token` (this app) and `pos-token` (Spring Boot). Both are `HttpOnly`, `SameSite=Strict`.
- **Guests**: no account. Each `waitlist_entries` row has a 64-hex `access_token` embedded in public URLs. Tokens for `CANCELLED` or `SEATED` entries are rejected.

## Getting started

### Prerequisites
- Node.js 20+
- PostgreSQL 16 (shared with the `restaurant-pos` Spring Boot app)
- Flyway migrations V1–V6 from the POS project applied to the database

### Environment
Create `.env.local`:

```bash
DATABASE_URL="postgresql://user:pass@localhost:5432/restaurant_pos"
JWT_SECRET="<generate-a-long-random-string>"
SPRING_BOOT_URL="http://localhost:8090"
NEXT_PUBLIC_BASE_URL="http://localhost:3000"
SMS_PROVIDER="console"
```

### Install and run

```bash
npm install
npx prisma db pull          # introspect the shared POS schema
npx prisma generate
npm run dev                 # http://localhost:3000
```

Start the Spring Boot POS separately on port 8090 for write operations (seat, fire) to work end-to-end. If POS is unreachable, the app falls back to local Prisma writes where possible.

## Scripts

| Command          | What it does              |
|------------------|---------------------------|
| `npm run dev`    | Start dev server          |
| `npm run build`  | Production build          |
| `npm run start`  | Run the production build  |
| `npm run lint`   | ESLint                    |

## Project layout

```
src/
  app/
    (public)/       Guest-facing routes
    (staff)/        PIN-gated admin routes
    api/            Route handlers
  components/       UI components
  hooks/            useIdleDetection, polling hooks
  lib/
    auth.ts         PIN verification + JWT signing
    prisma.ts       Prisma client singleton
    wait-time.ts    Wait-time estimator (§8 of the plan)
    spring-boot-client.ts  HTTP client for the POS
    validations.ts  Zod schemas for all route bodies
  stores/           Zustand stores
  proxy.ts          Staff auth middleware
Plans/              Design docs (source of truth)
Guide/
  Database/V1–V6    Flyway migrations from the POS project
  Design/           Design system + HTML mockups
```

## Design system

Non-negotiable rules from `Guide/Design/DESIGN.md`:
- No 1px dividers — use tonal background shifts
- No pure white — use `on_surface #e5e2e1`
- Gold `#e9c176` is reserved for "moment of truth" CTAs
- Tonal layering instead of shadow elevation levels

Authoritative token map lives in the inline `<script>` at the top of each `Guide/Design/*/code.html` mockup.

## Known limitations

This is a class project and the scope reflects that. Open tracking issues on GitHub cover the remaining correctness/UX fixes — most notably around POS-unreachable handling when firing orders to the kitchen.
