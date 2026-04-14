# LUXE TABLE Waitlist Web App - Implementation Plan

## Context

Build a Next.js waitlist web app for a restaurant, derived from the existing `restaurant-pos` Spring Boot project. The app serves as a kiosk/tablet interface with three core flows: an idle menu slideshow, a customer waitlist entry system, and a QR-based pre-ordering feature. It uses a **hybrid architecture** (own API routes + Spring Boot calls), **Prisma ORM**, **shared PostgreSQL database** with the POS system, and the "Digital Maitre D'" design system defined in `Guide/Design/DESIGN.md`.

---

## 1. Project Setup

### Initialize Next.js
```bash
cd /home/steph/Projects/waitlisted
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
```

### Dependencies
```bash
# Core
npm install prisma @prisma/client
npm install bcryptjs @types/bcryptjs    # PIN auth (bcrypt cost 4, matching Spring Boot)
npm install jose                        # JWT (Edge-compatible)
npm install qrcode @types/qrcode       # QR code generation
npm install zod                         # Validation
npm install @tanstack/react-query       # Server state + polling
npm install zustand                     # Pre-order cart state
npm install framer-motion               # Slideshow + page transitions
```

### Environment (`.env.local`)
```env
DATABASE_URL="postgresql://posuser:pospass123@localhost:5432/restaurant_pos"
JWT_SECRET="<256-bit-secret>"
SPRING_BOOT_URL="http://localhost:8090"
NEXT_PUBLIC_BASE_URL="http://localhost:3000"
SMS_PROVIDER="console"
```

### Tailwind Config
Replicate the exact color tokens from the HTML mockups (all 5 mockups share identical tokens). Key values:
- `surface: #131313`, `primary: #e9c176`, `tertiary: #b8ccb8`
- Full token map in `Guide/Design/customer_waitlist_entry/code.html` lines 15-62
- Fonts: `headline: ["Noto Serif"]`, `body/label: ["Manrope"]`
- Custom CSS classes: `.bg-gold-gradient`, `.primary-gradient-btn`, `.glass-panel`

---

## 2. Database Layer (Prisma)

### Strategy
The shared DB already has tables from Flyway migrations (V1-V6). Prisma must model existing tables (read-only) and create 3 new tables.

**Steps:**
1. `npx prisma init` + `npx prisma db pull` to introspect existing schema
2. Add new models to `schema.prisma`
3. `npx prisma migrate dev --create-only --name add_waitlist_tables` - review SQL to confirm only new tables are created
4. `npx prisma migrate dev` to apply

### New Tables

**`waitlist_entries`**
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | `gen_random_uuid()` |
| guest_name | VARCHAR(100) | Required |
| party_size | INT | Required |
| phone_number | VARCHAR(20) | Required |
| notes | TEXT | Optional |
| status | VARCHAR(20) | WAITING, NOTIFIED, SEATED, CANCELLED, NO_SHOW |
| access_token | VARCHAR(64) | Unique, crypto random hex, for customer URLs |
| estimated_wait_minutes | INT | Calculated at creation |
| preferred_zone | VARCHAR(50) | Optional |
| queue_position | INT | Ordinal at insert time |
| notified_at | TIMESTAMP | When SMS sent |
| seated_at | TIMESTAMP | When seated |
| seated_table_id | UUID | References `tables.id` (app-level FK) |
| seated_by_user_id | UUID | References `users.id` (app-level FK) |
| created_at | TIMESTAMP | Default now |
| updated_at | TIMESTAMP | Auto-updated |

**`pre_orders`**
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| waitlist_entry_id | UUID (FK, unique) | One pre-order per entry |
| status | VARCHAR(20) | DRAFT, CONFIRMED, FIRED, CANCELLED |
| subtotal | DECIMAL(10,2) | Calculated |
| fired_order_id | UUID | Links to `orders.id` after staff fires |
| fired_by_user_id | UUID | Staff who authorized the fire (audit trail) |
| created_at, updated_at | TIMESTAMP | |

**`pre_order_items`**
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| pre_order_id | UUID (FK) | Cascade delete |
| menu_item_id | UUID | References `menu_items.id` (app-level FK) |
| quantity | INT | Default 1 |
| special_instructions | TEXT | Optional |
| unit_price | DECIMAL(10,2) | Snapshot at add time |
| created_at | TIMESTAMP | |

FK references to existing tables are enforced at application level (not Prisma relations) to avoid migration conflicts with introspected models.

---

## 3. Authentication

### Staff Login Flow
1. Staff navigates to `/admin/login`, enters 4-digit PIN
2. `POST /api/auth/login` queries active users with non-null `pin_hash` (excludes KITCHEN)
3. Iterates users, calls `bcryptjs.compare(pin, user.pin_hash)` - cost factor 4 matches Spring Boot's `BCryptPasswordEncoder(4)`
4. On match: generates JWT via `jose` with `{ userId, username, fullName, role }`, 24h expiry
5. Also calls Spring Boot `POST /api/auth/login` with the same PIN to get a POS token
6. Both tokens stored as `httpOnly` cookies: `staff-token` (Next.js) + `pos-token` (Spring Boot)

### Middleware (`middleware.ts`)
- Matches `/admin/dashboard/:path*`
- Reads `staff-token` cookie, verifies JWT
- Redirects to `/admin/login` if invalid

### Customer Access (No Auth)
- `accessToken` (64 hex chars) generated per waitlist entry
- Embedded in URLs: `/waitlist/{token}/confirmation`, `/menu/{token}`
- Validated by DB lookup; denied if entry is CANCELLED or SEATED

**Key file:** `src/lib/auth.ts` - `verifyStaffAuth(request)` helper

---

## 4. Directory Structure

```
src/
  app/
    layout.tsx              # Root: Noto Serif + Manrope fonts, dark mode, QueryProvider
    page.tsx                # Redirect to /slideshow
    globals.css             # Design tokens + custom classes
    (public)/
      slideshow/page.tsx    # Feature A: idle menu slideshow
      waitlist/page.tsx     # Feature B: customer entry form
      waitlist/[token]/
        confirmation/page.tsx  # QR code + confirmation
        status/page.tsx        # Customer status check
      menu/[token]/page.tsx    # Feature C: pre-order menu
    (staff)/
      admin/
        layout.tsx          # Auth check wrapper
        login/page.tsx      # PIN login
        dashboard/page.tsx  # Waitlist management
    api/
      auth/login/route.ts
      auth/session/route.ts
      waitlist/route.ts                # GET (staff) / POST (public)
      waitlist/[id]/route.ts           # GET/PATCH/DELETE (staff)
      waitlist/[id]/notify/route.ts    # POST (staff)
      waitlist/[id]/seat/route.ts      # POST (staff)
      waitlist/wait-estimate/route.ts  # GET (public)
      pre-order/[token]/route.ts       # GET/POST (public via token)
      pre-order/[token]/confirm/route.ts
      menu/route.ts                    # GET (public, reads DB directly)
      tables/route.ts                  # GET (staff, reads DB directly)
      tables/stats/route.ts
      orders/from-preorder/route.ts    # POST (staff + PIN verify, calls Spring Boot)
      pre-order/by-entry/[id]/route.ts  # GET (staff): lookup pre-order by waitlist entry ID
  lib/
    prisma.ts               # Singleton client
    auth.ts                 # JWT sign/verify/middleware
    spring-boot-client.ts   # HTTP client for :8090
    sms.ts                  # Mock SMS (console.log)
    wait-time.ts            # Wait estimation algorithm
    qr.ts                   # QR code generation
    validations.ts          # Zod schemas
  components/
    layout/     Navbar.tsx, Footer.tsx
    slideshow/  SlideshowContainer.tsx, HeroSlide.tsx, BentoSection.tsx, SlideIndicators.tsx
    waitlist/   WaitlistForm.tsx, WaitTimeIndicator.tsx, PartySizeSelector.tsx, PhoneInput.tsx
    confirmation/ SuccessBadge.tsx, QRCodeDisplay.tsx, WaitlistSummary.tsx, ActionButtons.tsx
    menu/       CategorySidebar.tsx, MenuGrid.tsx, MenuCard.tsx, PreOrderSidebar.tsx
    admin/      MetricCards.tsx, TabNavigation.tsx, ZoneFilter.tsx, WaitlistTable.tsx,
                WaitlistRow.tsx, GuestActions.tsx, PreOrderModal.tsx, SeatGuestModal.tsx,
                PinConfirmDialog.tsx
    ui/         Button.tsx, Input.tsx, Select.tsx, Badge.tsx, GlassPanel.tsx, BottomSheet.tsx
  hooks/
    useIdleDetection.ts
    useWaitlistPolling.ts
    useDashboardPolling.ts
    usePreOrderCart.ts
  stores/
    preOrderStore.ts        # Zustand: cart items per token, persisted to localStorage
  types/
    database.ts, api.ts, waitlist.ts
```

---

## 5. Feature A: Menu Slideshow

**Page:** `src/app/(public)/slideshow/page.tsx`
**Reference:** `Guide/Design/menu_slideshow_updated/code.html`

### Behavior
- Full-screen hero slideshow cycling active menu items (fetched via `GET /api/menu`)
- Auto-advances every 8 seconds
- Each slide: dimmed full-bleed image (`brightness-[0.5]`), editorial overlay with dish name (Noto Serif `text-8xl`), description, "Join the Waitlist" gold gradient CTA
- Below hero: bento-style secondary section (large 8-col card + 4-col card)
- Slide indicators at bottom (thin bars: active gold, inactive white/20%)

### Interaction Detection (`useIdleDetection` hook)
- **Touch-only device** (old tablet, no keyboard/mouse): listens only for `touchstart` on `document`
- Any touch navigates to `/waitlist`
- After 2 minutes inactivity on other pages, returns to `/slideshow`

### Components
- `SlideshowContainer` - slide index, auto-advance interval
- `HeroSlide` - full-bleed image + overlay + CTA (receives `menuItem` prop)
- `BentoSection` - asymmetric bento grid (2 featured items)
- `SlideIndicators` - bar indicators with active highlight

---

## 6. Feature B: Waitlist Entry & Management

### 6a. Customer Form
**Page:** `src/app/(public)/waitlist/page.tsx`
**Reference:** `Guide/Design/customer_waitlist_entry/code.html`

**Layout:** Centered card on `surface-container-high`, ambient blur background, 3 atmospheric images below.

**Fields (from mockup):**
- Guest Name - text input, placeholder "e.g. Julian Vane"
- Party Size - select: 2 Guests, 3 Guests, 4 Guests, 5-6 Guests, 7+ Guests
- Phone Number - country code select (+1/+44/+33) + phone input
- Special Occasion or Preferences - textarea

**Wait Time Indicator:** Green-pulsing bar at top. Fetches `GET /api/waitlist/wait-estimate?partySize=N`, re-fetches when party size changes.

**Submit Flow:**
1. Validate with Zod
2. `POST /api/waitlist` -> server generates `accessToken`, calculates `queuePosition` and `estimatedWaitMinutes`
3. Mock SMS logged to console
4. Redirect to `/waitlist/{accessToken}/confirmation`

### 6b. Confirmation Page
**Page:** `src/app/(public)/waitlist/[token]/confirmation/page.tsx`
**Reference:** `Guide/Design/updated_confirmation_qr/code.html`

- Success badge: checkmark + "You're on the list!"
- QR code card: encodes `{BASE_URL}/menu/{token}`, white-padded with `primary/10` glow blur
- Summary bento cards: party size (left), estimated wait with pulse dot (right)
- Action buttons: "Pre-Order Menu Items" (gradient), "Modify Reservation" (outlined)
- Polls wait estimate every 30 seconds

### 6c. Admin Dashboard
**Page:** `src/app/(staff)/admin/dashboard/page.tsx`
**Reference:** `Guide/Design/updated_admin_dashboard/code.html`

**Metric Cards (3-col grid):**
- Total on List (primary gold) - count of WAITING + NOTIFIED
- Average Wait (white + "m" suffix) - avg `estimatedWaitMinutes`
- Available Tables (tertiary green + pulse dot) - from DB

**Tab Navigation:** Active Queue | Seated | Cancelled
**Zone Filter:** All Zones | Main Dining | Patio | Bar

**Waitlist Table Columns:** Pos, Guest Details (name + phone), Party, Wait Time (with status chip: On Track/Delayed/Ready Soon), Preferred Zone (badge + matching table numbers), Pre-Order (View Order button or "No Pre-Order" italic), Actions (Seat/Notify/Remove icons)

**Status Chips:**
- "On Track" - tertiary color, within estimate
- "Delayed" - error color, over estimate
- "Ready Soon" - tertiary color + `animate-ping` dot, < 5 min

**Actions:**
- Seat -> `SeatGuestModal` (select table + server) -> `POST /api/waitlist/[id]/seat`
- Notify -> `POST /api/waitlist/[id]/notify` (mock SMS, status -> NOTIFIED)
- Remove -> `DELETE /api/waitlist/[id]` (status -> CANCELLED)
- View Order -> `PreOrderModal` (review items, adjust, fire to kitchen)
- "+ Add Guest" button at bottom

**Polling:** Waitlist every 5s, table stats every 15s via `@tanstack/react-query` `refetchInterval`

---

## 7. Feature C: Pre-Order via QR Code

### Menu Page (Mobile-First - accessed via phone QR scan)
**Page:** `src/app/(public)/menu/[token]/page.tsx`
**Reference:** `Guide/Design/categorized_pre_order_menu/code.html`

**Desktop layout** (lg+): 3-column `lg:grid-cols-12` as in mockup (sidebar col-span-2, menu col-span-7, cart col-span-3).

**Mobile layout** (default, primary use case since accessed via phone):
- `CategorySidebar` is **collapsible**: hidden by default, toggled via a hamburger/filter icon button at top. When open, slides in as an overlay or top sheet listing categories. Tapping a category scrolls to that section and auto-closes the sidebar.
- `MenuGrid` takes full width, single-column card layout for narrow screens.
- `PreOrderSidebar` ("Your List" + estimated total + "Confirm Selection") moves to a **sticky bottom sheet**:
  - Collapsed state: shows item count badge + total price as a slim bar at bottom
  - Tap to expand: slides up to reveal full cart with item list, quantities, and confirm button
  - This keeps the menu browsable without the cart consuming screen space

**Categories** derived from `kitchen_section`: Appetizers (APPETIZER), Mains (GRILL + SAUTE + FRYER + COLD), Desserts (DESSERT)

**State:** Zustand store (`preOrderStore`) keyed by token, persisted to `localStorage`. Initialized from `GET /api/pre-order/[token]` on load.

**Confirm:** `POST /api/pre-order/[token]` saves items, then `POST /api/pre-order/[token]/confirm` sets status to CONFIRMED.

**Token validation:** If entry is CANCELLED or SEATED, show appropriate message instead of menu.

### Pre-Order to Real Order (Staff-Side)
**Accessing a specific pre-order:** Staff can access a guest's pre-order in two ways:
1. From the admin dashboard: click "View Order" on any waitlist row that has a pre-order
2. Direct lookup: navigate to a pre-order detail page via `/admin/pre-order/[waitlistEntryId]` or search by guest name on the dashboard

**Firing requires PIN verification:**
1. Staff opens `PreOrderModal` from the dashboard -> sees customer's selections
2. Staff can adjust quantities, remove/add items
3. Staff clicks "Fire to Kitchen" -> a **PIN confirmation dialog** appears
4. Staff enters their 4-digit PIN -> `POST /api/orders/from-preorder` includes the PIN in the request body
5. API route verifies the PIN against the `users` table (same bcrypt comparison as login), confirming a real staff member is authorizing the fire
6. On verification: API calls Spring Boot `POST /api/orders` then `POST /api/orders/{id}/fire`
7. Updates `PreOrder.status` to FIRED, sets `firedOrderId`, records `fired_by_user_id`

**New field on `pre_orders` table:** `fired_by_user_id UUID` - tracks which staff member authorized the fire (audit trail)

---

## 8. Wait Time Algorithm

**File:** `src/lib/wait-time.ts`

```
estimateWaitMinutes(partySize):
  1. Find compatible tables (capacity >= partySize)
  2. Count available compatible tables
  3. Count parties waiting ahead (competing for same tables)
  4. If available > partiesAhead: return 5 (immediate seating)
  5. effectiveWait = partiesAhead - available
  6. occupiedCompatible = compatible tables with OCCUPIED status
  7. totalCycleTime = AVG_DINING_DURATION + TABLE_TURNOVER_BUFFER
  8. avgRemainingTime = totalCycleTime / 2  (default: 50 min)
  9. cyclesNeeded = ceil((effectiveWait + 1) / max(occupiedCompatible, 1))
  10. estimate = cyclesNeeded * avgRemainingTime
  11. Clamp to [5, 150], round to nearest 5
  12. Display as range: estimate-5 to estimate+5 (min 5)
```

Constants:
- `AVG_DINING_DURATION = 90` (high-end restaurant, guests tend to linger)
- `TABLE_TURNOVER_BUFFER = 10` (cleaning + resetting the table)
- `totalCycleTime = 100` (full table cycle: dining + turnover)
- `avgRemainingTime = 50` (occupied tables are on average halfway through)
- `MIN_WAIT = 5`, `MAX_WAIT = 150`

**Rationale:** For a high-end dining experience, 90 minutes is a realistic average dining duration (courses, drinks, dessert). The 10-minute buffer covers clearing, cleaning, and resetting the table. The `/2` division reflects that occupied tables are at random stages of their dining cycle, so on average they have half the total cycle time remaining.

---

## 9. Spring Boot Integration

**Read operations** (tables, menu) go directly through Prisma for speed.
**Write operations** (update table status, create/fire orders) go through Spring Boot to trigger its business logic (Kafka events, WebSocket, state machine validation).

| Operation | Source | Reason |
|-----------|--------|--------|
| Read menu items | Prisma | Public data, no auth needed |
| Read table status | Prisma | Read-only display |
| Update table on seat | Spring Boot PATCH `/api/tables/{id}/status` | Triggers state machine |
| Create + fire order | Spring Boot POST `/api/orders` + `/fire` | Triggers Kafka/WebSocket |

**Auth for Spring Boot calls:** At staff login, also call Spring Boot's login endpoint with the same PIN. Store the returned POS JWT in a second `httpOnly` cookie (`pos-token`). Use it for write operations.

Spring Boot CORS already allows `localhost:3000`. Server-to-server calls from Next.js API routes bypass CORS anyway.

---

## 10. Implementation Sequence

**Phase 1 - Foundation:**
1. Create Next.js project, install dependencies
2. Tailwind config with full design token map
3. Prisma: introspect DB, add new tables, run migration
4. `globals.css` with gradient/glass custom classes
5. Shared UI components (Button, Input, Select, Badge, Navbar, Footer)

**Phase 2 - Auth:**
1. `src/lib/prisma.ts` (singleton)
2. `src/lib/auth.ts` (JWT helpers)
3. `POST /api/auth/login`, `GET /api/auth/session`
4. `/admin/login` page (PIN pad)
5. `middleware.ts` for staff route protection

**Phase 3 - Feature A (Slideshow):**
1. `GET /api/menu` route
2. Slideshow components
3. `/slideshow` page
4. `useIdleDetection` hook

**Phase 4 - Feature B (Waitlist):**
1. `POST /api/waitlist`, wait time algorithm
2. `/waitlist` page (customer form)
3. `/waitlist/[token]/confirmation` page
4. Staff CRUD routes (GET/PATCH/DELETE, notify, seat)
5. `src/lib/sms.ts` mock + `src/lib/spring-boot-client.ts`
6. Admin dashboard page with all sub-components

**Phase 5 - Feature C (Pre-Order):**
1. `GET/POST /api/pre-order/[token]` routes
2. Zustand `preOrderStore`
3. `/menu/[token]` page with all components
4. `POST /api/orders/from-preorder` (Spring Boot integration)
5. `PreOrderModal` for admin dashboard

**Phase 6 - Polish:**
1. Framer Motion animations (slide transitions, page entry)
2. Idle detection return-to-slideshow on all public pages
3. End-to-end testing with Spring Boot + Docker PostgreSQL

---

## 11. Critical Reference Files

| File | Purpose |
|------|---------|
| `Guide/Database/V1__initial_schema.sql` | Exact column names/types for existing tables |
| `Guide/Database/V5__seed_staff.sql` | Staff PIN hashes (bcrypt cost 4) |
| `Guide/Database/V6__seed_tables.sql` | 15 tables across 3 zones |
| `Guide/Design/DESIGN.md` | Design principles and rules |
| `Guide/Design/customer_waitlist_entry/code.html` | Waitlist form mockup + full Tailwind config |
| `Guide/Design/updated_admin_dashboard/code.html` | Admin dashboard mockup |
| `Guide/Design/categorized_pre_order_menu/code.html` | Pre-order menu mockup |
| `Guide/Design/updated_confirmation_qr/code.html` | QR confirmation mockup |
| `Guide/Design/menu_slideshow_updated/code.html` | Slideshow mockup |

---

## 12. Verification

### Feature A
- Navigate to `/slideshow` -> full-screen hero with menu item
- Wait 8s -> slide transitions
- Touch screen -> navigates to `/waitlist`
- Keyboard/mouse events are ignored (touch-only tablet)

### Feature B
- Load `/waitlist` -> wait time indicator shows estimate
- Fill form, submit -> redirected to confirmation with QR code
- Scan QR -> opens menu on phone
- Log in as staff at `/admin/login` -> dashboard shows new entry
- Click Notify -> console logs SMS, status changes
- Click Seat -> select table -> status changes, Spring Boot table updated

### Feature C
- Open `/menu/{token}` on phone -> mobile layout with full-width menu grid
- Category sidebar hidden by default, toggle via icon -> slides open, tap category scrolls to section
- Add items -> bottom sheet shows item count + total
- Expand bottom sheet -> full cart with items, quantities, confirm button
- Confirm selection -> pre-order status = CONFIRMED
- Staff clicks "View Order" on dashboard -> sees items in `PreOrderModal`
- Staff clicks "Fire to Kitchen" -> PIN confirmation dialog appears
- Staff enters PIN -> PIN verified server-side -> order created in Spring Boot
- Wrong PIN -> rejected, fire does not proceed

### Auth
- Valid PIN -> JWT issued, dashboard accessible
- Invalid PIN -> 401
- No cookie -> redirected to login
- KITCHEN role PIN (null) -> excluded from login
- Fire-to-kitchen requires separate PIN verification (audit trail)
