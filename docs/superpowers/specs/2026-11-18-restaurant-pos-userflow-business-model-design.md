# Restaurant POS & Kitchen Display System — User Flow, Business Model & Modular Architecture Design

**Date:** 2026-11-18
**Status:** Draft — Pending Approval
**Size:** Project (4 Sequential Phases)

---

## 1. Intent & Why

This system is a flagship, production-grade **Restaurant Point-of-Sale (POS) & Kitchen Display System (KDS)** engineered as a portfolio showcase for **technical recruiters and senior/staff engineers**. Evaluators interact with the application at two levels:

1. **Interactive Product & Real-Time Evaluation:** An evaluator wants to land on the application, place a dine-in or takeaway order, see it appear instantaneously across kitchen stations, split a bill, trigger a payment failure, and inspect analytics—without spending 15 minutes configuring branches, menus, or shifts first.
2. **Senior Engineering Code Review:** Immediately after testing the live UI, a reviewer inspects the repository to judge domain modeling, state-machine rigor, concurrency handling, transaction integrity, test coverage, and architectural cleanliness.

### Dual Mandate

- **Zero-Friction & Split-Screen Live Demo:** The system boots with a pre-seeded multi-branch enterprise group (**Aurelia Dining Group** across three branches: *Downtown Flagship*, *Waterfront Patio*, and *Airport Express*) complete with menus, modifiers, ingredient recipes, active tables, and open shifts. A persistent **Evaluator Control Bar** lets reviewers switch instantaneously across all 8 user roles, launch a **Split-Screen POS ↔ KDS Workspace** in one viewport (or across synced browser tabs), and toggle deterministic failure simulations (e.g., card payment decline, low-stock auto-86).
- **Codebase Built for Senior Code Review:** The backend follows a **Modular Monolith** under `app/Modules/`, enforcing strict domain boundaries via Pest `arch()` tests. Every mutation executes inside a single-purpose transactional Action class, governed by PHP 8.3 backed-enum state machines, pessimistic row locking (`SELECT ... FOR UPDATE`), client-supplied payment idempotency keys, `afterCommit` Reverb broadcasts and Horizon jobs, and integer-cent currency arithmetic.

---

## 2. Work Sizing & Sub-Project Phasing

An 11-module, 8-role, 4-interface system with real-time WebSockets, split billing, and recipe inventory is a **Project (Multi-Phase System)**. Rather than planning everything in one monolithic pass, implementation is decomposed into **4 sequential, independently testable sub-project plans**:

| Phase | Scope & Deliverables | Domain Modules Included |
|---|---|---|
| **Phase 1: Core Foundation, Enterprise Business Model, Master Catalog & Shift Gate** | Multi-branch enterprise hierarchy, 8-role RBAC & Manager PIN verification, master menu with branch overrides & 86'ing, shift/cash-drawer gating, rich enterprise demo seeders, and the **Evaluator Control Bar**. | `Restaurant`, `Identity`, `Menu`, `Shifts` |
| **Phase 2: Live Service Loop — Floor, Open-Tab Multi-Round POS & Station-to-Expediter KDS** | Interactive floor plan & atomic table transfers, dine-in open tabs & takeaway orders, multi-round ticket firing, station-filtered KDS + Expediter board with SLA timers & Web Audio chimes, Reverb real-time sync, and **Split-Screen POS ↔ KDS** mode. | `Floor`, `Orders`, `Kitchen` |
| **Phase 3: Split-Billing Engine, Payment Integrity, Exception Paths & Receipts** | Unified, item/seat split, and equal $N$-way split billing with deterministic penny allocation, idempotent `SELECT ... FOR UPDATE` settlement, partial payment failure recovery, Manager-PIN voids & refunds, thermal receipt component, and blind shift cash reconciliation. | `Billing` (+ exception hooks into `Orders`, `Kitchen`, `Shifts`) |
| **Phase 4: Recipe Inventory COGS, Executive Analytics & Audit Trail** | Ingredient stock & recipe COGS deduction via Horizon (`DeductOrderInventoryJob`), low-stock auto-86 broadcasts, wastage logging, Owner/Manager cross-branch analytics dashboard, and immutable audit log inspector. | `Inventory`, `Reporting`, `Audit` |

---

## 3. Goals, Non-Goals, and Anti-Goals

### Goals
- **Sub-100ms Local Real-Time Sync:** Fire-to-KDS, station item bumps, expediter ready alerts, table occupancy changes, and 86'd menu availability propagate across connected terminals via Laravel Reverb + Echo.
- **Zero Floating-Point Drift:** All prices, taxes, discounts, splits, payments, COGS, and cash drawer counts are stored and computed in integer `cents` (`BIGINT` / `INTEGER`).
- **Concurrency & Transaction Safety:** Concurrent split-bill payments, simultaneous table claims/transfers, and inventory deductions use `DB::transaction()` with `lockForUpdate()` (`SELECT ... FOR UPDATE`) and idempotency keys to prevent double charges, orphan tabs, or negative stock drift.
- **High-Craft Role-Specific UI:** Touch-friendly, responsive React + TypeScript interfaces built with Tailwind CSS, `shadcn/ui`, and `motion.dev` layout animations, ticket arrival transitions, SLA pulses, and split-bill microinteractions.

### Non-Goals
- **Multi-Tenant SaaS Billing:** No Stripe subscriptions, self-serve tenant signups, or tenant provisioning portals (this is a single-brand enterprise system).
- **Physical Hardware Drivers:** No native ESC/POS USB thermal printer daemon or physical EMV card-reader SDKs. Replaced by a print-ready thermal receipt modal/view and a simulated Payment Gateway supporting deterministic success, card decline, and timeout modes.
- **Third-Party Aggregator Integrations:** No DoorDash, UberEats, or external delivery marketplace webhooks.

### Anti-Goals
- **No PostgreSQL Dependencies:** The application, migrations, locks, JSON queries, and tests must run cleanly on **MySQL 8.4+ and SQLite** (explicitly superseding the PostgreSQL block shown in the preliminary architecture diagram).
- **No Fat Controllers or Eloquent Boot-Hook Side Effects:** Controllers remain thin Inertia/HTTP adapters; Eloquent `booted()` hooks never fire WebSocket events or queue jobs. All state transitions and side effects live in explicit Domain Action classes.
- **No Uncommitted WebSocket Broadcasts or Queue Jobs:** Reverb events and Horizon jobs must only dispatch `afterCommit` (via `DB::afterCommit()` or `ShouldDispatchAfterCommit`), preventing phantom kitchen tickets or stock deductions on rolled-back transactions.
- **No Floating-Point Currency Math:** Never use PHP `float` or JS floating-point division for currency totals or splits.
- **No Manual Setup Barrier:** Visiting the application root drops evaluators directly into the seeded demo environment with immediate role switching and shift presets active.

---

## 4. Technical Stack & Global Constraints

| Layer | Specification |
|---|---|
| **Backend** | Laravel 12/13, PHP 8.3+ (`declare(strict_types=1);`, backed enums, `readonly` DTOs) |
| **Frontend** | React 19 + TypeScript via Inertia.js 2, Tailwind CSS, `shadcn/ui`, `motion.dev` |
| **Database** | MySQL 8.4+ (production / Docker / CI) and SQLite with WAL mode (quick-start & fast local tests) |
| **Background Processing** | Redis + Laravel Horizon (`inventory`, `analytics`, `notifications` dedicated queues) |
| **Realtime** | Laravel Reverb + Laravel Echo (`private-branch.{branchId}.*` channels) |
| **Testing & CI** | Pest PHP (Unit, Feature, Concurrency, and `arch()` module-boundary tests) + GitHub Actions running against both SQLite and MySQL 8.4+ service containers |

---

## 5. Enterprise Business Model (Single-Brand, Multi-Branch Enterprise)

The application models **Aurelia Dining Group**, a single restaurant brand operating multiple branches under centralized corporate governance with branch-level operational autonomy.

### Corporate-to-Branch Scoping (`branch_id`)
- **Corporate Level:** Owns global brand tax/service-charge defaults, master menu categories, products, variants, modifier groups, prep-station routing assignments (`Grill`, `Cold/Salad`, `Pastry`, `Bar`), and standard ingredient recipes.
- **Branch Level:** Every operational record—floors, tables, shifts, cash drawers, orders, kitchen tickets, bills, payments, branch stock levels, and Reverb WebSocket channels—is strictly isolated by `branch_id`. Branches can define local `price_override_cents`, branch-specific tax/service rates, and real-time item availability (`is_available` / **"86'd"**).

### Three Operational Profit & Governance Levers
1. **Theoretical vs. Actual Food Cost (COGS) & Auto-86'ing:**
   - Every product variant maps to a `Recipe` composed of `Ingredients` with `unit_cost_cents`.
   - When a kitchen round completes (or an `InPrep`/`Ready` item is voided as wastage), Horizon processes `DeductOrderInventoryJob`, deducting branch stock inside a row lock, recording a `stock_movements` COGS snapshot, and triggering an `ItemAvailabilityChanged` Reverb broadcast if branch stock drops below `auto_86_threshold` (immediately disabling the dish on active POS terminals).
2. **Cash Drawer & Discount/Void Loss Prevention:**
   - Cashiers and Waiters must belong to an open `Shift` to transact. Cash tenders and cash refunds append to the shift's `expected_cash_cents`.
   - Closing a shift requires a **blind cash count** (`counted_cash_cents`) without showing the expected total upfront; the system calculates `variance_cents = counted_cash_cents - expected_cash_cents` and flags discrepancies exceeding branch tolerance.
   - Discounts exceeding the branch threshold (default `15%`), post-fire item voids, and post-payment refunds require a **4-digit Branch Manager PIN** verified server-side and recorded in `audit_logs`.
3. **Throughput & Kitchen SLA Performance:**
   - Measures table turnover duration, Average Order Value (AOV), peak-hour order velocity, voids/refunds rate, and kitchen ticket SLA compliance (`Green < 10m`, `Amber 10–15m`, `Red > 15m`).

### 8 User Roles & Permission Matrix

| Role | Primary Workspace | Core Capabilities & Authority |
|---|---|---|
| **Enterprise System Admin** | Executive / System Admin | Provisions branches, registers POS/KDS terminals, configures global compliance/tax defaults, monitors Horizon queue health, inspects full `audit_logs`. |
| **Restaurant Owner** | Owner / Manager Dashboard | Views cross-branch P&L, revenue, COGS %, AOV, and cash variance comparisons; governs master menu, corporate recipes, and cross-branch staff roles. |
| **Branch Manager** | Floor / Manager / Dashboard | Configures branch tables, manages staff shifts & blind cash variance reviews, holds **4-digit PIN override** authority (voids, refunds, >15% discounts), toggles branch 86'ing and local pricing. |
| **Cashier** | Cashier POS | Opens/closes cash-drawer shifts, creates dine-in/takeaway orders, fires rounds, applies standard discounts, splits bills (item/seat or equal $N$-way), collects payments, issues/reprints thermal receipts. |
| **Waiter / Server** | Floor & Table POS | Manages assigned tables, seats guests, transfers open tabs between tables, builds multi-round orders, fires rounds to KDS, responds to ready alerts, requests bills. |
| **Chef / Kitchen Staff** | Kitchen Display (Station View) | Views station-filtered KDS tickets (`Grill`, `Cold/Salad`, `Pastry`, `Bar`), sees modifier/allergy callouts, bumps items `Queued → In Prep → Ready`. |
| **Kitchen Expediter (Expo)** | Kitchen Display (Expo View) | Monitors consolidated all-station tickets and SLA timers, verifies complete order trays once all stations hit `Ready`, bumps tickets `Ready → Served` (notifying Waiters). |
| **Inventory Manager** | Inventory & Purchasing | Manages branch ingredients, supplier stock-in receipts, recipe mappings, manual wastage entries, and low-stock / auto-86 threshold alerts. |

---

## 6. Detailed End-to-End User Flows & State Machines

### 6.1 Shift & Cash Drawer Lifecycle (`ShiftState`)

```text
[Closed / None] ──(OpenShiftAction + opening_cash_cents)──► Open
                                                              │
                                    (CloseShiftAction + blind counted_cash_cents)
                                                              │
                                       ┌──────────────────────┴──────────────────────┐
                                 |variance| <= tol                             |variance| > tol
                                       ▼                                             ▼
                                    Closed                                   VarianceFlagged
                                                                                     │
                                                              (Manager Approval + note)
                                                                                     ▼
                                                                                  Closed
```

- **Gate Rule:** Creating or firing a paid/takeaway transaction or capturing a payment requires an active `Shift` in `Open` state for the acting user/terminal at that `branch_id`.

### 6.2 Floor & Table Lifecycle (`TableState`)

```text
Available ──(Seat / OpenTab)──► Occupied ──(RequestBill)──► Billing ──(Order Paid)──► Dirty ──(MarkClean)──► Available
    │                              ▲
    └──(Reserve)──► Reserved ──────┘
```

- **Atomic Table Transfer (`TransferTableAction`):** Inside `DB::transaction()`, locks source table, target table (`Available`), and the active `Order` via `lockForUpdate()`. Moves `order.table_id` to target, marks source `Available` (or `Dirty` if guests already had plates), marks target `Occupied`, and broadcasts `TableOccupancyChanged` `afterCommit`.

### 6.3 Open-Tab, Multi-Round Service & KDS Flow (`OrderState`, `TicketState`, `ItemPrepState`)

```text
Order (Table Tab):      Draft ──► Open (Active) ──► Billing ──┬──(Full Pay)────► Paid / Closed
                                       │                       └──(Partial Fail)► PartiallyPaid ──► Paid / Closed
                                       │
KitchenTicket (Round N):               └──(FireRound)──► Fired ──► InPrep ──► Ready (All Stations) ──► Served (Expo)
                                                           │
OrderItem (Per Station):        Draft ──(FireRound)──► Queued ──► InPrep ──► Ready ──► Served
                                                           │          │         │
                                                           └──(Manager PIN Void)┴──► Voided
```

1. **Service Type Selection:**
   - **Dine-In:** Waiter or Cashier selects an `Available` (or `Reserved`) table on the Floor Map or POS table selector, opening an `Order` in `Draft` (with `guest_count`).
   - **Takeaway / Pickup:** Skips table assignment, captures customer name / pickup reference, and transitions straight to `Open` when Round 1 is fired.
2. **Draft Cart & Firing Round $N$ (`FireOrderRoundAction`):**
   - Items added to the active order begin as `OrderItem` rows in `ItemPrepState::Draft` and can be modified or removed freely before firing.
   - Clicking **"Fire Round"** transitions `Order` from `Draft → Open` (if first round), creates a `KitchenTicket` (`round_number = N`), snapshots item prices, modifiers, tax rules, and station routing (`Grill`, `Cold/Salad`, `Pastry`, `Bar`), transitions drafted items to `ItemPrepState::Queued`, and dispatches `OrderRoundFired` via Reverb `afterCommit`.
   - Waiters/Cashiers can continue adding items and firing Round 2 (drinks, mains, desserts) on the same open `Order` while Round 1 is cooking.
3. **Station Chef → Expediter Handoff:**
   - Station chefs filter KDS by their assigned station (`Grill`, `Cold/Salad`, `Pastry`, `Bar`) and tap touch-friendly item cards (`Queued → InPrep → Ready`).
   - Moving the first item on a ticket to `InPrep` advances `KitchenTicket` from `Fired → InPrep`. When **all non-voided items** on a ticket reach `Ready`, `KitchenTicket` automatically transitions to `Ready` (broadcasting `KitchenItemStatusUpdated`).
   - **SLA Timers:** Computed from `kitchen_tickets.fired_at`:
     - `< 10 min`: Green
     - `10–15 min`: Amber
     - `> 15 min`: Red + subtle pulse + Web Audio chime on KDS
   - **Expediter (Expo) Bump:** The Expo views consolidated multi-station tickets. Once a ticket is `Ready`, tapping **"Bump / Serve"** moves `KitchenTicket` and its items to `Served`, triggering `TicketExpoServed` over Reverb so the Waiter receives a real-time table-ready notification.

### 6.4 Billing, Split-Bill Engine & Settlement (`BillSplitState` & `PaymentState`)

1. **Entering Billing:** Tapping **"Request Bill"** transitions `Order` to `Billing` and `Table` to `Billing` (preventing accidental new kitchen rounds unless reopened by staff). Discounts may be applied (`<= 15%` directly by Cashier/Waiter; `> 15%` requires **Branch Manager PIN**).
2. **Three Split Modes (`SplitOrderBillAction`):**
   - **Single Unified Bill:** Creates one `BillSplit` covering 100% of `order.total_cents`.
   - **Split by Item / Seat:** Interactive React Split Drawer assigns individual `OrderItem`s (or shared fractional items split across selected seats) into named checks (`Check A`, `Check B`, ...). Server recalculates subtotal, proportional discount, service charge, and tax per check, guaranteeing `SUM(bill_splits.total_cents) === order.total_cents`.
   - **Split Equally ($N$-Ways):** Divides `order.total_cents` across $N$ checks in integer cents using deterministic remainder distribution: `base = intdiv(total_cents, N)`, `remainder = total_cents % N`, assigning `+1` cent to each of the final `remainder` checks so every penny is accounted for with zero drift.
3. **Idempotent Payment Capture (`SettleBillSplitAction`):**
   - Client sends a UUID `idempotency_key`, `bill_split_id`, `tender_method` (`Cash`, `Card`, `QR`), `amount_tendered_cents`, and optional `tip_cents`.
   - Inside `DB::transaction()`:
     - Checks `payment_transactions.idempotency_key` first; if already processed, returns the existing recorded outcome idempotently without re-charging.
     - Acquires `lockForUpdate()` on `orders` and `bill_splits` rows in deterministic ID order (preventing deadlocks).
     - Processes tender through the `PaymentGatewayInterface` (Simulated Gateway respects the Evaluator Bar's "Simulate Card Decline" toggle).
     - Records an immutable `PaymentTransaction` (`Captured` or `Failed`).
     - If all `BillSplit` records on the order are `Paid`, transitions `Order` to `Paid` and `Table` to `Dirty`, issues the thermal receipt payload, and dispatches `PaymentCaptured` + `TableOccupancyChanged` `afterCommit`.

### 6.5 Exception Paths (Separate Flows)

| Exception Scenario | Operational & Transactional Behavior |
|---|---|
| **Pre-Fire Item Removal** | `OrderItem` in `ItemPrepState::Draft` is deleted directly with instant cart recalculation; no Manager PIN or audit record required. |
| **Post-Fire Item or Order Void** | Once an item is `Queued`, `InPrep`, or `Ready`, voiding requires a **4-digit Branch Manager PIN** + reason code (`CustomerChangedMind`, `KitchenError`, `OrderMistake`). Transitions item to `Voided`, recalculates order totals, logs to `audit_logs`, and broadcasts `OrderItemVoided` to KDS (striking through the item with a visual/audible warning). If the item was already `InPrep` or `Ready`, Horizon dispatches `DeductOrderInventoryJob` flagged as `wastage`. |
| **Payment Failure & Partial Settlement Recovery** | In a split bill where Check A (`Card`) succeeds and Check B (`Card`) declines: Check A stays committed as `Paid` with Receipt A available; Check B records a `Failed` `PaymentTransaction`; the `Order` transitions to `PartiallyPaid`. The Cashier can immediately retry Check B or switch Check B to `Cash` / `QR` without risking double-charging Check A. |
| **Post-Payment Refund** | Requires a **4-digit Branch Manager PIN**, refund amount (full or itemized), reason code, and a `restock_or_wastage` selection. Appends an immutable negative `PaymentTransaction` (`Refunded`), decrements the active shift's `expected_cash_cents` if refunded in cash, logs an `AuditLog`, and dispatches wastage/restock adjustment via Horizon if applicable. |

---

## 7. Approaches Considered & Architectural Blueprint

### Approaches Evaluated

1. **Modular Monolith with Explicit Domain Actions, PHP 8.3 State Machines & Transactional Events (Chosen)**
   - Organizes code into 11 cohesive modules under `app/Modules/` with strict Pest `arch()` rules, thin Inertia controllers, single-purpose Action classes, enum-driven transitions, pessimistic row locking, and `afterCommit` events/jobs.
   - *Trade-off:* Slightly more upfront folder structure than standard Laravel MVC, delivering senior-review clarity and transactional rigor without CQRS complexity.
2. **Event-Sourced / CQRS (`spatie/laravel-event-sourcing`)**
   - Stores every state change as an append-only event stream with MySQL read projectors.
   - *Why Rejected:* Heavy boilerplate across 11 modules slows down synchronous Inertia CRUD, reporting queries, and evaluator readability.
3. **Standard Layer-Based Laravel MVC (Controllers + Models + Services)**
   - Places all models in `app/Models/` and services in `app/Services/`.
   - *Why Rejected:* Across 11 modules and 8 roles, `Order` and `Branch` rapidly collapse into 1,000-line God classes, undermining the codebase-review objective.

### Backend Module Map (`app/Modules/`)

```text
app/Modules/
├── Restaurant/   # Branches, operating hours, corporate/branch tax & service charge config
├── Identity/     # Staff users, 8 roles, permissions, Manager PIN verification, Evaluator persona switch
├── Floor/        # Floor zones, tables, occupancy states, reservations, TransferTableAction
├── Menu/         # Corporate categories, products, variants, modifiers, branch price overrides & 86'ing
├── Shifts/       # Shift open/close, cash drawer ledger, blind cash count & variance flagging
├── Orders/       # Dine-in/takeaway tabs, Draft items, FireOrderRoundAction, post-fire PIN voids
├── Kitchen/      # Station routing, KitchenTicket & ItemPrepState machines, BumpItem & ExpoServe actions
├── Billing/      # SplitOrderBillAction (1-bill/item/equal), SettleBillSplitAction, refunds, thermal receipts
├── Inventory/    # Ingredients, recipes, supplier stock-in, wastage, DeductOrderInventoryJob (Horizon)
├── Reporting/    # Revenue, AOV, peak hours, voids/variance, COGS vs. sales, cross-branch comparisons
└── Audit/        # Immutable audit_logs for PIN overrides, refunds, voids, cash variances, 86 events
```

### Frontend Workspaces (Inertia.js 2 + React + TypeScript + `shadcn/ui` + `motion.dev`)

- **Persistent `EvaluatorControlBar`:** Top bar (collapsible) offering one-click Role Switcher (all 8 roles), Branch Switcher, **Split-Screen POS ↔ KDS Toggle**, and Failure Simulation Switches (*Simulate Card Decline*, *Trigger Low Stock Auto-86*).
- **`PosWorkspace` (Cashier / Waiter):** Category pills, search, product grid with real-time 86'd badges, modifier drawer, interactive multi-round cart (`Draft` vs. `Fired` badges), table selector, discount modal (with Manager PIN gate >15%), split-bill drawer, payment modal with retry recovery, and printable thermal receipt history.
- **`KdsWorkspace` (Chef / Kitchen Expediter):** High-contrast dark-mode-ready touch board, station tabs (`All / Expo`, `Grill`, `Cold/Salad`, `Pastry`, `Bar`), animated `motion.dev` ticket cards, live color-coded SLA timers, allergy/modifier highlights, void strike-through alerts, and Web Audio chime notifications.
- **`FloorWorkspace` (Waiter / Branch Manager):** Interactive table zone canvas showing occupancy, guest counts, active tab elapsed time, ready-to-serve food alerts, and drag/click table transfer modal.
- **`ExecutiveWorkspace` (Owner / Branch Manager / Inventory Manager / Admin):** Branch comparison cards, hourly revenue & peak-hour velocity charts, AOV, voids & cash variance audit table, COGS & ingredient stock ledger, and immutable audit trail viewer.
- **`SplitScreenDemoWorkspace`:** Dedicated evaluator route rendering `PosWorkspace` (left) and `KdsWorkspace` (right) simultaneously in one browser viewport, both connected to live Reverb WebSocket channels so clicking **Fire Round** on the left animates the ticket onto the right in real time.

### Reverb WebSocket Channel & Event Contract

All channels use private branch authorization (`private-branch.{branchId}.*`) enforcing `branch_id` and role authorization in `routes/channels.php`:

| Channel | Broadcast Events (All dispatched `afterCommit`) | Consumers |
|---|---|---|
| `private-branch.{branchId}.kds` | `OrderRoundFired`, `KitchenItemStatusUpdated`, `TicketExpoServed`, `OrderItemVoided` | KDS (Chefs & Expo), Split-Screen Demo |
| `private-branch.{branchId}.pos` | `TicketExpoServed`, `OrderBillSplitUpdated`, `PaymentCaptured`, `ItemAvailabilityChanged` | Cashier POS, Waiter POS, Split-Screen Demo |
| `private-branch.{branchId}.floor` | `TableOccupancyChanged`, `TicketExpoServed`, `ServiceRequested` | Floor View, Branch Manager |
| `private-branch.{branchId}.manager` | `ShiftVarianceFlagged`, `CriticalAuditLogged`, `ItemAvailabilityChanged` | Branch Manager, Owner, Inventory Manager |

---

## 8. Builder Calls vs. Left to the Builder

### Architect Calls (Locked In)
- **Integer Cents Only:** Every monetary column uses integer cents (`*_cents`); no `float`/`decimal` drift in calculations.
- **Database Parity:** Migrations and queries must use standard SQL compatible with **both MySQL 8.4+ and SQLite** (avoiding PostgreSQL-specific `RETURNING`, array columns, or PG-only locks; using Laravel's `lockForUpdate()`).
- **4-Digit Manager PIN Verification:** Elevated actions (voids after fire, refunds, >15% discounts) prompt for a 4-digit PIN verified server-side against a Branch Manager / Owner user in the same branch, recording both the acting Cashier/Waiter ID and the approving Manager ID in `audit_logs`.
- **Evaluator Zero-Friction Entry:** Default landing loads the seeded *Downtown Flagship* branch with an open shift and active sample tables, plus the persistent Evaluator Control Bar.
- **Deterministic Split Penny Allocation:** Equal $N$-way splits allocate `total_cents % N` remainder cents to the final check(s).
- **Integer Basis-Points Tax & Service Charge Math:** Discounts apply to subtotal first (`net_subtotal_cents = subtotal_cents - discount_cents`); service charges and taxes compute independently on `net_subtotal_cents` using integer basis points (e.g., `825` = `8.25%`) with half-up integer rounding (`intdiv(amount * bps + 5000, 10000)`).
- **Reopening an Order from `Billing`:** An order in `Billing` can be reopened to `Open` (to fire additional kitchen rounds or void items) only while zero `BillSplit` checks are `Paid` (not `PartiallyPaid`); reopening invalidates and deletes unpaid `BillSplit` rows so splits are freshly recalculated on the next bill request.
- **Evaluator Role Switcher & Split-Screen Auth:** The top-bar Role Switcher authenticates the seeded persona for that role (`Auth::login($seededRoleUser)`), while `SplitScreenDemoWorkspace` authorizes both the POS and KDS panels for the active branch so a single browser viewport can fire orders and bump kitchen tickets simultaneously.

### Left to the Builder
- Exact Tailwind / `shadcn/ui` color tokens, typography pairing, and light/dark KDS theme palette details.
- Specific `motion.dev` spring/easing constants and stagger timings.
- Culinary names, prices, and recipe ingredient quantities for the *Aurelia Dining Group* demo seeders.
- Exact directory layout of React feature components under `resources/js/` (e.g., `resources/js/pages/` + `resources/js/modules/`).
