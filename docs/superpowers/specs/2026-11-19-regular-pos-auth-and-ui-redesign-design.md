# Regular Restaurant POS: Terminal Auth, Staff PIN Lock & UI Redesign

## Intent & Why
The app currently presents itself as an "evaluator demo" (persistent Evaluator Control Bar, 1-click persona/branch switching, failure-simulation toggles, visible `PIN: 1234`, Split-Screen demo page). The owner wants it to be a **regular restaurant POS** that a reviewer judges by *using it like staff would* and by reading the code. The domain core (orders, multi-round KDS, split billing, inventory/COGS, audit, shifts) stays; the entry flow, navigation and visual design change.

## Goals
- Real two-layer authentication like Toast / Square / Lightspeed:
  1. **Terminal sign-in** — a Branch Manager, Owner or Admin signs the device in with email + password; the terminal is bound to a branch.
  2. **Staff PIN lock screen** — the device then shows that branch's staff; tap a name, enter a 4-digit PIN, land on the role's home screen.
- **Lock** button in the sidebar returns to the lock screen (fast role switching for reviewers and real staff).
- Owner & Admin get a **branch dropdown** in the top bar; everyone else is fixed to the terminal branch.
- Full UI redesign in the light, warm style of the reference screens (left icon sidebar, KPI cards, photo-card menu grid, right-hand order panel, order cards board, floor-plan tables, payment modal with keypad).

## Non-goals
- No changes to money math, state machines, split-bill engine, idempotent settlement, inventory deduction, or reporting queries beyond what the new screens need.
- No customer-facing ordering, reservations, or delivery integrations.
- No real payment processor.

## Anti-goals (failure even if it works)
- Any "demo/evaluator" chrome left in the UI (evaluator bar, simulation toggles, PIN hints, split-screen page).
- Credentials or PINs shown anywhere in the UI (README only).
- Staff able to reach screens their role shouldn't (403, not just hidden links).

## Constraints
- Laravel 13, PHP 8.3+, Inertia 2 + React 19 + TS, Tailwind v4, shadcn/ui, motion; SQLite + MySQL 8.4 parity; integer cents/bps; Actions inside `DB::transaction()`; existing architecture tests (`ModuleBoundariesTest`) must keep passing.
- Reuse existing `users.pin_hash`, `users.role`, `users.branch_id`, `VerifyManagerPinAction`.
- Windows dev sandbox: run Pest with sandbox bypass (existing ruling).

## Approaches considered
- **A. Terminal sign-in + staff PIN lock screen — CHOSEN.** Realistic, reuses `pin_hash`, fast role switching. Cost: two auth layers to build and test.
- B. One PIN pad for every staff member across branches — rejected: 20 users across 3 branches on one pad is unrealistic; PINs must be globally unique.
- C. Email/password per person, log out to switch — rejected: slow switching, doesn't feel like a POS.

## Design (decided)

### Auth flow
```
/login (email+password, Manager/Owner/Admin only)
   └─> terminal bound to user's branch (Owner/Admin: choose branch on sign-in)
        └─> /lock  — grid of active staff at terminal branch (avatar initials, name, role)
              └─> tap name → 4-digit PIN keypad → unlocked
                    └─> redirect to role home
```
- Session keys: `terminal_user_id` (via Laravel `web` guard login), `terminal_branch_id`, `staff_user_id`, `staff_last_activity_at`, `active_branch_id` (Owner/Admin dropdown; defaults to terminal branch).
- Middleware: `EnsureTerminalSignedIn` (else → `/login`), `EnsureStaffUnlocked` (else → `/lock`), `EnsureRole:<abilities>` (403 otherwise).
- PIN attempts rate-limited (5 per minute per terminal+user); failures audit-logged.
- "Sign out terminal" (manager-only, in Settings / lock screen footer) ends both layers.
- Every staff member gets a PIN (today only manager roles have one); seeded per role in README.
- Manager-PIN overrides (voids, >threshold discounts, refunds, variance approval) are unchanged — still verified via `VerifyManagerPinAction`.

### Role homes & navigation
| Role | Home | Sidebar |
|---|---|---|
| Enterprise Admin | Dashboard | Dashboard, POS, Orders, Tables, Kitchen, Menu, Inventory, Reports, Shifts, Settings |
| Owner | Dashboard | same as Admin |
| Branch Manager | Dashboard | same as Admin |
| Cashier | POS | POS, Orders, Tables, Shifts |
| Waiter | Tables | Tables, POS, Orders |
| Chef | Kitchen | Kitchen |
| Expediter | Kitchen (Expo view) | Kitchen |
| Inventory Manager | Inventory | Inventory, Menu, Reports |
Sidebar footer: staff avatar/name/role, **Lock** button.

### Screens (new routes replace evaluator ones)
- `/login`, `/lock` — centered cards, branded.
- `/dashboard` — greeting, KPI cards (Revenue, Orders, Dine-in, Takeaway / AOV), sales-by-hour area chart, sales-by-category donut, live orders list, table-status donut, top dishes, out-of-stock list. Uses `GetExecutiveDashboardMetricsQuery` + live order/table queries.
- `/pos` — category chips/tabs, search, photo card grid (+/– qty, modifier sheet), right panel: order header (customer/table/type, order #), items with notes, subtotal/discount/service/tax/total, "Send to Kitchen" (fire round) and "Charge" buttons. "New Order" modal (Dine-in / Takeaway, customer name, guests, table picker).
- `/orders` — tabs All / In Progress / Ready / Completed; order cards (table/takeaway badge, items, total, status chip, "See Details", "Pay Bill").
- Payment modal — receipt-style transaction details on the left; on the right split mode (Single / By Seat-Item / Equal N), tender (Cash with keypad + quick amounts + change; Card), Pay. Card goes through a **simulated card terminal step** with "Approve / Decline" buttons (honest simulation of a card reader; replaces the global decline toggle and exercises partial-failure recovery). Receipt print/view after payment; refunds from order details (manager PIN).
- `/tables` — floor plan by zone tabs (Main / Patio / Bar), tables coloured by state with running total + elapsed time; tap → open/continue order, transfer, mark clean.
- `/kitchen` — KDS, keeps dark high-contrast theme, station tabs, Expo view, SLA timers, chime.
- `/menu` — branch catalog: availability (86) toggles, price overrides.
- `/inventory` — stock table, receive/wastage drawers, movement ledger.
- `/reports` — branch comparison, P&L, COGS %, voids, cash variance, audit trail.
- `/shifts` — open/close drawer, blind count, variance approval.
- `/settings` — branch settings (tax, service charge, thresholds), terminal sign-out.

### Removed
`EvaluatorControlBar`, `/evaluator/*` routes, `EvaluatorDemoController`, `SplitScreenDemoController` + page, `WelcomeDashboard`, `SwitchEvaluatorPersonaAction`, `GetEvaluatorContextQuery` (replaced by a `CurrentStaffContext` service resolving terminal, staff and active branch from the session), session simulation flags (low-stock auto-86 now happens only from real stock levels).

### Visual system
Light warm-neutral background, white rounded-2xl cards, orange primary accent (references 1, 2, 4, 7), status colours (green ready/available, amber in-progress, red occupied/declined, grey cleaning). Inter font, generous spacing, tablet-first (1024–1440px). KDS dark.

## Left to the builder (my calls, correctable)
- Menu photos: add nullable `image_path` to `menu_items`; seed with generated food images if feasible, otherwise category-coloured illustration fallback.
- Auto-lock after 10 minutes idle (config value).
- Owner/Admin choose the branch on terminal sign-in; the top-bar dropdown changes `active_branch_id` for all screens in that session.
- Exact chart library: hand-rolled SVG (existing) unless a lightweight lib is clearly better.
- Tests: rewrite HTTP tests to go through login → PIN unlock; add auth/lockout/role-gate tests; keep all domain tests.
