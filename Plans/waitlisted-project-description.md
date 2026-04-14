# Waitlisted
**Restaurant Waitlist Web Application** | CPRG306 Web Development | Winter 2026
Student: Stephen Noh | Solo Project | Next.js 16 + TypeScript + PostgreSQL + Prisma

---

## 1. Project Overview

Waitlisted is a tablet-and-mobile web app for a full-service restaurant. It replaces paper sign-in sheets with a real-time kiosk experience. Guests enter their name, party size, phone, and seating preference, then receive a queue position, estimated wait time, and a QR-linked token to check status from their own phone. While waiting, guests can pre-order from a mobile menu. Staff manage the queue via a PIN-authenticated dashboard that auto-refreshes and delegates seating/order-firing to the existing Spring Boot POS backend.

### Scope

**In scope:** Kiosk pages (idle slideshow, entry form, confirmation, status), mobile pre-order menu, admin dashboard, REST API routes, three new Prisma-managed DB tables, SMS console stub.

**Out of scope:** Real SMS delivery, payment processing, multi-tenant support, native mobile app, Spring Boot POS reimplementation.

---

## 2. Features

### A — Idle Menu Slideshow (`/slideshow`)
**User stories:** Provides ambient marketing while the kiosk waits for a guest, supporting the overall in-restaurant experience.

Animated Framer Motion slideshow of featured menu items when the kiosk is idle. `useIdleDetection` hook resets to slideshow after a configurable timeout. A tap navigates to the entry form.

### B — Customer Waitlist Entry (`/waitlist` → `/waitlist/[token]/confirmation` → `/waitlist/[token]/status`)
**User stories:** Guest adds party to waitlist, sees queue position and estimated wait time, receives SMS when table is ready.

Multi-step self-registration form. Zod validates inputs client- and server-side. On submit, API creates a `WaitlistEntry`, assigns queue position, generates an access token, and estimates wait time (`AVG_DINING_DURATION=90min`, `TABLE_TURNOVER_BUFFER=10min`). Confirmation screen shows QR code; status page polls every 10 s via `useWaitlistPolling`.

### C — QR-Based Pre-Order Menu (`/menu/[token]`)
**User stories:** Guest browses menu and pre-orders items while waiting, can confirm or modify order before it's sent to kitchen.

Mobile menu browsable by category (Appetizers, Mains, Desserts). Cart managed by Zustand (`usePreOrderCart`). Guest can review and confirm a `PreOrder`; server locks it at `CONFIRMED` status.

### D — Staff Admin Dashboard (`/admin/dashboard`)
**User stories:** Staff view live queue and table availability, notify guests their table is ready, seat guests, and separately fire pre-orders to the kitchen after a PIN re-confirmation.

Live queue + table grid. Auto-refreshes via `useDashboardPolling` (waitlist every 5 s, tables every 15 s). Actions: notify guest, seat guest (updates table status via Spring Boot — does **not** fire the pre-order), fire pre-order (requires a second PIN entry by the acting staff member; only then does Spring Boot create + fire the order), mark no-show/cancelled. Separating "seat" from "fire" gives the server a chance to verbally confirm the order with the guest before it hits the kitchen.

### E — PIN Auth & JWT Sessions (`/admin/login`)
**User stories:** Staff securely authenticate to access the admin dashboard using a 4-digit PIN only.

Staff log in with a 4-digit PIN (bcrypt, cost 4) — no username. The login route iterates active users with non-null `pin_hash` (excluding KITCHEN role) and matches via `bcryptjs.compare`. `jose` issues a JWT stored in an HttpOnly, SameSite=Strict cookie. `proxy.ts` middleware guards all `/admin/*` routes. Firing a pre-order requires a **second PIN verification** at the time of fire; `pre_orders.fired_by_user_id` records which staff member authorized it.

---

## 3. Technology Stack

| Category | Technology | Purpose |
|---|---|---|
| Framework | Next.js 16.2.1 | App Router, API routes, proxy.ts middleware |
| Language | TypeScript 5 | Full type safety |
| Styling | Tailwind CSS v4 | CSS-first config via `@theme` in globals.css |
| ORM | Prisma 7 + @prisma/adapter-pg | Type-safe DB access |
| Database | PostgreSQL 16 (shared) | Shared with Spring Boot POS via Docker Compose |
| Server State | TanStack React Query v5 | Fetching, caching, polling |
| Client State | Zustand v5 | Pre-order cart |
| Animation | Framer Motion v12 | Slideshow + page transitions |
| Auth | jose v6 + bcryptjs v3 | JWT signing, PIN comparison |
| QR Codes | qrcode v1.5 | Guest confirmation QR |
| Validation | Zod v4 | API request validation |
| Containerization | Docker Compose | PostgreSQL + Kafka (from restaurant-pos) |

---

## 4. Architecture

Next.js App Router with two route groups: `(public)` for guests and `(staff)` for PIN-authenticated staff. Reads and waitlist mutations go through Next.js API routes → Prisma → PostgreSQL. Seating and order-firing delegate to Spring Boot via `lib/spring-boot-client.ts`.

### Route Groups

| Group | Routes |
|---|---|
| (public) | `/` → redirect, `/slideshow`, `/waitlist`, `/waitlist/[token]/confirmation`, `/waitlist/[token]/status`, `/menu/[token]` |
| (staff) | `/admin/login`, `/admin/dashboard` |

### API Routes (`/api/...`)

- `GET/POST /waitlist` — list queue / create entry
- `GET/PATCH/DELETE /waitlist/[id]` — single entry management
- `PATCH /waitlist/[id]/notify` — mark NOTIFIED, SMS stub
- `PATCH /waitlist/[id]/seat` — mark SEATED, call Spring Boot
- `GET /waitlist/wait-estimate` — current estimated wait
- `GET /menu` — active items grouped by category
- `GET/PATCH /pre-order/[token]` — read/update draft
- `POST /pre-order/[token]/confirm` — lock at CONFIRMED
- `GET/PATCH /pre-order/by-entry/[id]` — staff view of guest order
- `POST /orders/from-preorder` — fire to Spring Boot kitchen
- `GET /tables` + `GET /tables/stats` — table status + aggregates
- `POST /api/auth/login` — validate PIN, issue JWT
- `GET /api/auth/session` — current session claims

### Key Hooks & Libraries

| | |
|---|---|
| `useWaitlistPolling` | Guest status page polling (10 s) |
| `useDashboardPolling` | Dual polling: queue 5 s, tables 15 s |
| `usePreOrderCart` | Zustand cart with add/remove/clear |
| `useIdleDetection` | Slideshow reset on inactivity |
| `lib/auth.ts` | JWT sign/verify (jose) |
| `lib/prisma.ts` | Singleton PrismaClient |
| `lib/sms.ts` | SMS interface — console stub in dev |
| `lib/spring-boot-client.ts` | Typed HTTP client for POS |
| `lib/wait-time.ts` | `estimateWaitMinutes(partySize)` |
| `lib/validations.ts` | Zod schemas for all API bodies |

### Database Models

**Existing (read-only in Prisma, managed by Flyway in POS):** `users`, `tables`, `menu_categories`, `menu_items`

**New (Prisma-managed):**
- `waitlist_entries` — guest name, partySize, phone, status, accessToken, queuePosition, preferredZone, notifiedAt, seatedAt
- `pre_orders` — 1:1 to waitlist_entries; status: DRAFT → CONFIRMED → FIRED; links to firedOrderId
- `pre_order_items` — menuItemId, quantity, unitPrice, specialInstructions

---

## 5. UI Notes

### 1. Menu Slideshow.
![Wireframe of menu slideshow screen](Wireframe/Wireframe_Menu_slideshow.png)
Shows popular dishes in a slideshow when no one is using the kiosk. Guests can tap the screen to start joining the waitlist.

### 2. Waitlist Entry.
![Wireframe of waitlist entry form](Wireframe/Wireframe_waitlist_entry.png)
Shows the form where guests enter their name, party size, phone number, and seating choice. The screen is made for tablet use and has a clear submit button.

### 3. Admin Dashboard.
![Wireframe of admin dashboard](Wireframe/Wireframe_Admin_Dashboard.png)
Shows live queue and table information for staff. Staff can notify guests, seat parties, and update the queue quickly.