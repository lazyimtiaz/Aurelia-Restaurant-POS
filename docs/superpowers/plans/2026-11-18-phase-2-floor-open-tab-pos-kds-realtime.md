# Phase 2: Live Service Loop — Floor, Open-Tab Multi-Round POS & Station-to-Expediter KDS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the live restaurant service loop: interactive Floor Map with atomic table transfers, Open-Tab multi-round Dine-In and Takeaway POS ordering, Station-to-Expediter Kitchen Display System (KDS) with live SLA timers and Web Audio chimes, Laravel Reverb real-time channel synchronization, and the Split-Screen POS ↔ KDS Evaluator Workspace.

**Architecture:** Extends the Modular Monolith with `app/Modules/{Floor,Orders,Kitchen}` governed by `TableState`, `OrderState`, `TicketState`, and `ItemPrepState` PHP 8.3 enums. All mutations execute inside `DB::transaction()` with `lockForUpdate()`, snapshot item/modifier prices on round fire, gate post-fire voids behind `VerifyManagerPinAction`, and emit `afterCommit` Reverb events over private branch channels (`private-branch.{branchId}.{pos,kds,floor}`).

**Tech Stack:** Laravel 12/13, PHP 8.3+, Inertia.js 2, React 19, TypeScript, Tailwind CSS, `shadcn/ui`, `motion.dev`, MySQL 8.4+ / SQLite (WAL), Laravel Reverb + Echo, Pest PHP.

**Spec:** [2026-11-18-restaurant-pos-userflow-business-model-design.md](file:///c:/Users/DELL/Desktop/Laravel%20Portfolio/Restaurant%20POS/docs/superpowers/specs/2026-11-18-restaurant-pos-userflow-business-model-design.md)

## Global Constraints

- PHP 8.3+ with `declare(strict_types=1);` in all `app/Modules/` and `app/Support/` files; Laravel 12/13.
- React 19 + TypeScript via Inertia.js 2, Tailwind CSS, `shadcn/ui`, `motion.dev`.
- Database compatibility across **MySQL 8.4+ and SQLite** (WAL mode); **zero PostgreSQL dependencies**.
- All money stored and computed in integer cents (`*_cents`); tax/service/discount rates in integer basis points (`*_bps`); never use `float`.
- All domain mutations run in explicit Action classes inside `DB::transaction()`; no fat controllers or Eloquent `booted()` side effects.
- Every Reverb broadcast and Horizon job dispatches `afterCommit` (`ShouldDispatchAfterCommit` or `DB::afterCommit()`).
- Dedicated Horizon queues: `inventory`, `analytics`, `notifications`.
- Private branch-scoped Reverb channels: `private-branch.{branchId}.{kds,pos,floor,manager}`.

## Review Focus

1. **Concurrent table occupation / atomic transfer lock:** Two attempts to open a tab on or transfer an order to the same `TableState::Available` table serialize via `lockForUpdate()`, causing the second attempt to fail with `TableNotAvailableException` without corrupting table or order state (pinned in Task 1).
2. **Firing an empty round or re-firing already queued items:** Calling `FireOrderRoundAction` when an order has zero `ItemPrepState::Draft` items must throw `NoDraftItemsToFireException` without creating a `KitchenTicket` or dispatching `OrderRoundFired` (pinned in Task 3).
3. **Price/modifier snapshot immutability after fire:** Changing a branch's `price_override_cents` after Round 1 is fired must leave Round 1 `Queued`/`InPrep`/`Ready` `OrderItem` prices untouched, while newly added Round 2 `Draft` items use the updated price (pinned in Task 3).
4. **Post-fire void vs. pre-fire removal gate:** Removing an `ItemPrepState::Draft` item succeeds without a PIN; voiding a `Queued`/`InPrep`/`Ready` item without a valid Branch Manager PIN throws `InvalidManagerPinException`, whereas a valid PIN sets `ItemPrepState::Voided`, recalculates order totals, logs to `audit_logs`, and broadcasts `OrderItemVoided` `afterCommit` (pinned in Task 3).
5. **Expediter serve guard on partial station completion:** Calling `ServeKitchenTicketExpoAction` while `Grill` items are `Ready` and `Bar` items remain `InPrep` must throw `TicketNotReadyForExpoException`; when the final non-voided item hits `Ready` (or is voided), the ticket advances automatically to `TicketState::Ready` (pinned in Task 4).

---

## File Structure

- `app/Modules/Floor/` — `TableState` enum, `FloorZone` & `DiningTable` models, `TableOccupancyChanged` event, `UpdateTableStateAction`, `TransferTableAction`.
- `app/Modules/Orders/` — `OrderState` & `ServiceType` enums, `Order`, `OrderItem`, `OrderItemModifier` models, `OpenOrderTabAction`, `AddDraftOrderItemAction`, `RemoveDraftOrderItemAction`, `ApplyOrderDiscountAction`, `RecalculateOrderTotalsAction`, `FireOrderRoundAction`, `VoidOrderItemAction`.
- `app/Modules/Kitchen/` — `TicketState`, `ItemPrepState`, `VoidReason` enums, `KitchenTicket` model, `OrderRoundFired`, `OrderItemVoided`, `KitchenItemStatusUpdated`, `TicketExpoServed` events, `BumpKitchenItemStatusAction`, `ServeKitchenTicketExpoAction`, `GetActiveKdsTicketsQuery`.
- `routes/channels.php` — Branch-scoped private Reverb authorization for `private-branch.{branchId}.{kds,pos,floor,manager}` (also honoring Evaluator Split-Screen authorization).
- `app/Http/Controllers/{FloorController,PosController,KdsController,SplitScreenDemoController}.php` — Thin Inertia/HTTP endpoints delegating exclusively to Actions/Queries.
- `resources/js/hooks/useBranchEcho.ts` — Shared Laravel Echo subscription hook for branch channels.
- `resources/js/pages/{Floor/FloorWorkspace.tsx,Pos/PosWorkspace.tsx,Kds/KdsWorkspace.tsx,Evaluator/SplitScreenDemoWorkspace.tsx}` — Role-specific interactive workspaces and Split-Screen demo view.

---

### Task 1: Floor Management Module (`TableState`, Seating & Atomic `TransferTableAction`)

**Files:**
- Create: `database/migrations/2026_11_18_000006_create_floor_zones_and_tables.php`
- Create: `app/Modules/Floor/Enums/TableState.php`
- Create: `app/Modules/Floor/Exceptions/TableNotAvailableException.php`
- Create: `app/Modules/Floor/Models/{FloorZone,DiningTable}.php`
- Create: `app/Modules/Floor/Events/{TableOccupancyChanged,ServiceRequested}.php`
- Create: `app/Modules/Floor/Actions/{UpdateTableStateAction,TransferTableAction,RequestTableServiceAction}.php`
- Modify: `database/seeders/AureliaEnterpriseSeeder.php` (seed zones & tables per branch)
- Test: `tests/Feature/Modules/Floor/TableLifecycleAndTransferTest.php`

**Interfaces:**
- Consumes: `Branch` (Phase 1 Task 2).
- Produces:
  - `App\Modules\Floor\Enums\TableState`: `'available'`, `'reserved'`, `'occupied'`, `'billing'`, `'dirty'`
  - `App\Modules\Floor\Events\TableOccupancyChanged` (`ShouldBroadcastNow`, `ShouldDispatchAfterCommit` on `private-branch.{branchId}.floor` and `private-branch.{branchId}.pos`)
  - `App\Modules\Floor\Events\ServiceRequested` (`ShouldBroadcastNow`, `ShouldDispatchAfterCommit` on `private-branch.{branchId}.floor`)
  - `App\Modules\Floor\Actions\UpdateTableStateAction::execute(int $tableId, TableState $targetState, ?int $guestCount = null): DiningTable`
  - `App\Modules\Floor\Actions\TransferTableAction::execute(int $orderId, int $targetTableId, bool $markSourceDirty = false): DiningTable`
  - `App\Modules\Floor\Actions\RequestTableServiceAction::execute(int $tableId, string $requestType, int $actorUserId): void`

- [ ] **Step 1: Write the failing test**

In `tests/Feature/Modules/Floor/TableLifecycleAndTransferTest.php`:
- `it('rejects occupying an already occupied table under pessimistic locking')` (**pins Review Focus #1**): occupy `Table A`, call `UpdateTableStateAction::execute($tableA->id, TableState::Occupied)` again and assert `TableNotAvailableException`.
- `it('atomically transfers an open order tab from occupied Table A to available Table B and broadcasts TableOccupancyChanged after commit')` (**pins Review Focus #1**): create open order on `Table A`, execute `TransferTableAction::execute($order->id, $tableB->id, markSourceDirty: false)` under `Event::fake([TableOccupancyChanged::class])`; assert `order.table_id === $tableB->id`, `Table A` is `Available` (or `Dirty` when `markSourceDirty: true`), `Table B` is `Occupied`, and transferring to an already `Occupied` `Table C` throws `TableNotAvailableException` leaving `Table A` untouched.

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test --filter=TableLifecycleAndTransferTest`
Expected: FAIL (`TableState` / `TransferTableAction` not found).

- [ ] **Step 3: Implement migration, `TableState`, models, `TableOccupancyChanged`, `ServiceRequested`, and actions**

`TransferTableAction` locks source table, target table, and order row in ascending ID order using `lockForUpdate()` inside `DB::transaction()` (preventing deadlocks), verifies target is `Available` or `Reserved` within the same `branch_id`, updates `order.table_id`, updates both tables, and dispatches `TableOccupancyChanged` `afterCommit`. `RequestTableServiceAction` validates the table belongs to the branch and dispatches `ServiceRequested` (`ShouldDispatchAfterCommit`) on `private-branch.{branchId}.floor`. Update `AureliaEnterpriseSeeder` with 3 zones (*Main Dining*, *Patio*, *Bar Counter*) and 10 tables per branch.

- [ ] **Step 4: Run test to verify it passes**

Run: `php artisan test --filter=TableLifecycleAndTransferTest`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add database/migrations/2026_11_18_000006* database/seeders/AureliaEnterpriseSeeder.php app/Modules/Floor tests/Feature/Modules/Floor
git commit -m "feat(floor): add dining tables lifecycle, zones, and atomic TransferTableAction"
```

---

### Task 2: Orders Module (`OrderState`, Dine-In Open Tab vs. Takeaway, Draft Cart & Tax/Discount Math)

**Files:**
- Create: `database/migrations/2026_11_18_000007_create_orders_and_order_items_tables.php`
- Create: `app/Modules/Orders/Enums/{OrderState,ServiceType}.php`
- Create: `app/Modules/Orders/Models/{Order,OrderItem,OrderItemModifier}.php`
- Create: `app/Modules/Orders/DTOs/OrderItemInputData.php`
- Create: `app/Modules/Orders/Actions/{OpenOrderTabAction,AddDraftOrderItemAction,RemoveDraftOrderItemAction,ApplyOrderDiscountAction,RecalculateOrderTotalsAction}.php`
- Test: `tests/Feature/Modules/Orders/OrderTabAndDraftCartTest.php`

**Interfaces:**
- Consumes: `TaxCalculator` (Phase 1 Task 1), `VerifyManagerPinAction` (Phase 1 Task 3), `GetBranchCatalogQuery` (Phase 1 Task 4), `Shift` (Phase 1 Task 5), `DiningTable` & `TableState` (Task 1).
- Produces:
  - `App\Modules\Orders\Enums\OrderState`: `'draft'`, `'open'`, `'billing'`, `'partially_paid'`, `'paid'`, `'voided'`
  - `App\Modules\Orders\Enums\ServiceType`: `'dine_in'`, `'takeaway'`, `'pickup'`
  - `App\Modules\Orders\Actions\OpenOrderTabAction::execute(int $branchId, int $shiftId, int $serverId, ServiceType $serviceType, ?int $tableId = null, int $guestCount = 1, ?string $customerName = null): Order`
  - `App\Modules\Orders\Actions\AddDraftOrderItemAction::execute(int $orderId, OrderItemInputData $input): OrderItem`
  - `App\Modules\Orders\Actions\RemoveDraftOrderItemAction::execute(int $orderItemId): Order`
  - `App\Modules\Orders\Actions\ApplyOrderDiscountAction::execute(int $orderId, int $discountBps, int $actorUserId, ?string $managerPin = null): Order`
  - `App\Modules\Orders\Actions\RecalculateOrderTotalsAction::execute(Order $order): Order`

- [ ] **Step 1: Write the failing test**

In `tests/Feature/Modules/Orders/OrderTabAndDraftCartTest.php`:
- `it('opens a dine-in tab locking the table as Occupied and rejects opening without an active Open shift')`: verify `OpenOrderTabAction` succeeds with open shift and sets table `Occupied`, and throws `DomainException` when shift is `Closed`.
- `it('rejects adding an 86d unavailable branch menu item to the cart')`: mark variant `is_available = false` at branch, assert `AddDraftOrderItemAction` throws `DomainException`.
- `it('gates discounts above branch discount_pin_threshold_bps (1500 bps) behind Manager PIN verification')`: `1000` bps (`10%`) succeeds without PIN; `2000` bps (`20%`) without PIN throws `InvalidManagerPinException`; `2000` bps with valid PIN `'1234'` updates `discount_cents`, recalculates `service_charge_cents`, `tax_cents`, `total_cents` via `TaxCalculator`, and logs `AuditLog`.

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test --filter=OrderTabAndDraftCartTest`
Expected: FAIL (`OrderState` / `OpenOrderTabAction` not found).

- [ ] **Step 3: Implement migrations, enums, models, DTO, and actions**

`orders` table stores `branch_id`, `shift_id`, `table_id` (nullable), `server_id`, `order_number`, `service_type`, `state`, `guest_count`, `customer_name`, `subtotal_cents`, `discount_bps`, `discount_cents`, `service_charge_cents`, `tax_cents`, `total_cents`. `order_items` stores `order_id`, `kitchen_ticket_id` (nullable until fired), `menu_item_variant_id`, `item_name_snapshot`, `variant_name_snapshot`, `prep_station`, `prep_state`, `quantity`, `unit_price_cents`, `modifiers_total_cents`, `line_total_cents`, `seat_number`, `special_instructions`. `RecalculateOrderTotalsAction` excludes `ItemPrepState::Voided` items and calls `TaxCalculator::calculateOrderTotals()`.

- [ ] **Step 4: Run test to verify it passes**

Run: `php artisan test --filter=OrderTabAndDraftCartTest`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add database/migrations/2026_11_18_000007* app/Modules/Orders tests/Feature/Modules/Orders/OrderTabAndDraftCartTest.php
git commit -m "feat(orders): add dine-in/takeaway order tabs, draft cart, and PIN-gated discount math"
```

---

### Task 3: Multi-Round Kitchen Ticket Firing (`FireOrderRoundAction`) & Post-Fire Manager-PIN Voids (`VoidOrderItemAction`)

**Files:**
- Create: `database/migrations/2026_11_18_000008_create_kitchen_tickets_table.php`
- Create: `app/Modules/Kitchen/Enums/{TicketState,ItemPrepState,VoidReason}.php`
- Create: `app/Modules/Kitchen/Models/KitchenTicket.php`
- Create: `app/Modules/Kitchen/Events/{OrderRoundFired,OrderItemVoided}.php`
- Create: `app/Modules/Orders/Exceptions/NoDraftItemsToFireException.php`
- Create: `app/Modules/Orders/Actions/{FireOrderRoundAction,VoidOrderItemAction}.php`
- Test: `tests/Feature/Modules/Orders/FireRoundAndVoidTest.php`

**Interfaces:**
- Consumes: `Order`, `OrderItem`, `RecalculateOrderTotalsAction` (Task 2), `VerifyManagerPinAction` & `RecordAuditLogAction` (Phase 1 Task 3).
- Produces:
  - `App\Modules\Kitchen\Enums\TicketState`: `'fired'`, `'in_prep'`, `'ready'`, `'served'`
  - `App\Modules\Kitchen\Enums\ItemPrepState`: `'draft'`, `'queued'`, `'in_prep'`, `'ready'`, `'served'`, `'voided'`
  - `App\Modules\Kitchen\Enums\VoidReason`: `'customer_changed_mind'`, `'kitchen_error'`, `'order_mistake'`
  - `App\Modules\Orders\Actions\FireOrderRoundAction::execute(int $orderId, int $actorUserId): KitchenTicket`
  - `App\Modules\Orders\Actions\VoidOrderItemAction::execute(int $orderItemId, string $managerPin, VoidReason $reason, int $actorUserId): OrderItem`

- [ ] **Step 1: Write the failing test**

In `tests/Feature/Modules/Orders/FireRoundAndVoidTest.php`:
- `it('fires draft items as Round 1 KitchenTicket, allows firing Round 2 separately, and throws NoDraftItemsToFireException when no drafts exist')` (**pins Review Focus #2**): add 2 draft items, call `FireOrderRoundAction`, assert `KitchenTicket` (`round_number: 1`, `TicketState::Fired`), `Order.state === OrderState::Open`, and `OrderRoundFired` dispatched once; calling `FireOrderRoundAction` again immediately throws `NoDraftItemsToFireException`; adding another item and firing creates `round_number: 2`.
- `it('preserves Round 1 fired item price snapshots when branch price override changes before Round 2')` (**pins Review Focus #3**): fire Round 1 at `1900` cents, call `SetBranchPriceOverrideAction` to `2400` cents, add same dish to Round 2 and fire; assert Round 1 item has `unit_price_cents === 1900` and Round 2 item has `unit_price_cents === 2400`.
- `it('requires Manager PIN to void fired items, updates totals, logs audit, and broadcasts OrderItemVoided after commit')` (**pins Review Focus #4**): calling `RemoveDraftOrderItemAction` on fired item fails; calling `VoidOrderItemAction` with wrong PIN throws `InvalidManagerPinException`; calling with `'1234'` transitions item to `ItemPrepState::Voided`, recalculates `order.total_cents`, records `AuditLog`, and broadcasts `OrderItemVoided`.

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test --filter=FireRoundAndVoidTest`
Expected: FAIL (`KitchenTicket` / `FireOrderRoundAction` not found).

- [ ] **Step 3: Implement migration, enums, model, events, and actions**

`FireOrderRoundAction` acquires `lockForUpdate()` on `Order`, checks for `Draft` items (throws `NoDraftItemsToFireException` if empty), computes next `round_number`, creates `KitchenTicket` (`fired_at = now()`), attaches all `Draft` items to `kitchen_ticket_id` in `ItemPrepState::Queued`, transitions `Order` from `Draft → Open`, and dispatches `OrderRoundFired` `afterCommit`. `VoidOrderItemAction` verifies Manager PIN via `VerifyManagerPinAction`, locks order & item, marks item `Voided` (recording `void_reason` and `was_in_prep_at_void` boolean for Phase 4 wastage tracking), recalculates totals, and broadcasts `OrderItemVoided` `afterCommit`.

- [ ] **Step 4: Run test to verify it passes**

Run: `php artisan test --filter=FireRoundAndVoidTest`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add database/migrations/2026_11_18_000008* app/Modules/Kitchen app/Modules/Orders tests/Feature/Modules/Orders/FireRoundAndVoidTest.php
git commit -m "feat(orders,kitchen): support multi-round ticket firing, snapshots, and PIN-gated voids"
```

---

### Task 4: Kitchen Station Prep & Expediter Handoff (`BumpKitchenItemStatusAction` & `ServeKitchenTicketExpoAction`)

**Files:**
- Create: `app/Modules/Kitchen/Exceptions/TicketNotReadyForExpoException.php`
- Create: `app/Modules/Kitchen/Events/{KitchenItemStatusUpdated,TicketExpoServed}.php`
- Create: `app/Modules/Kitchen/Actions/{BumpKitchenItemStatusAction,ServeKitchenTicketExpoAction}.php`
- Create: `app/Modules/Kitchen/Queries/GetActiveKdsTicketsQuery.php`
- Modify: `routes/channels.php`
- Test: `tests/Feature/Modules/Kitchen/KdsStationToExpoFlowTest.php`

**Interfaces:**
- Consumes: `KitchenTicket`, `OrderItem`, `TicketState`, `ItemPrepState`, `PrepStation` (Task 3 & Phase 1 Task 4).
- Produces:
  - `App\Modules\Kitchen\Actions\BumpKitchenItemStatusAction::execute(int $orderItemId, ItemPrepState $targetState, int $chefId): KitchenTicket`
  - `App\Modules\Kitchen\Actions\ServeKitchenTicketExpoAction::execute(int $kitchenTicketId, int $expediterId): KitchenTicket`
  - `App\Modules\Kitchen\Queries\GetActiveKdsTicketsQuery::execute(int $branchId, ?PrepStation $station = null): Collection`

- [ ] **Step 1: Write the failing test**

In `tests/Feature/Modules/Kitchen/KdsStationToExpoFlowTest.php`:
- `it('advances ticket to Ready only when all non-voided items across stations reach Ready and blocks premature Expo serve')` (**pins Review Focus #5**): fire a ticket with 1 `Grill` item and 1 `Bar` item. Bump `Grill` item `Queued → InPrep` (assert ticket `TicketState::InPrep`) and `InPrep → Ready` (ticket stays `InPrep`). Call `ServeKitchenTicketExpoAction` and assert `TicketNotReadyForExpoException`. Bump `Bar` item to `Ready` (assert ticket automatically transitions to `TicketState::Ready` and broadcasts `KitchenItemStatusUpdated`). Call `ServeKitchenTicketExpoAction` and assert ticket & items transition to `Served` and `TicketExpoServed` broadcasts to `.kds`, `.pos`, and `.floor`.
- `it('filters active KDS tickets by PrepStation while keeping consolidated view for Expo')`: assert `GetActiveKdsTicketsQuery` returns only `Grill` items when filtered by `PrepStation::Grill`.

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test --filter=KdsStationToExpoFlowTest`
Expected: FAIL (`BumpKitchenItemStatusAction` not found).

- [ ] **Step 3: Implement events, actions, query, and Reverb channel authorization in `routes/channels.php`**

`BumpKitchenItemStatusAction` locks the `KitchenTicket` row (`lockForUpdate()`), enforces strict forward transitions (`Queued → InPrep → Ready`), updates `OrderItem`, recalculates parent ticket state (`InPrep` if any item is `InPrep` or `Ready`; `Ready` if all non-voided items on the ticket are `Ready`), and dispatches `KitchenItemStatusUpdated` `afterCommit`. Also handle the edge case where voiding the last non-ready item on a ticket advances the ticket to `Ready` if remaining items are all `Ready`. Authorize `private-branch.{branchId}.{kds,pos,floor,manager}` in `routes/channels.php` verifying user's branch access and role (allowing both POS & KDS channels when the user is on the demo evaluator session or has matching role).

- [ ] **Step 4: Run test to verify it passes**

Run: `php artisan test --filter=KdsStationToExpoFlowTest`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/Modules/Kitchen routes/channels.php tests/Feature/Modules/Kitchen
git commit -m "feat(kitchen): implement station item bumping, expediter serve gate, and Reverb channels"
```

---

### Task 5: Interactive React `FloorWorkspace` & `PosWorkspace` (Multi-Round Cart, Modifiers, Table Transfer & Reverb Sync)

**Files:**
- Create: `app/Http/Controllers/{FloorController,PosController}.php`
- Modify: `routes/web.php`
- Create: `resources/js/hooks/useBranchEcho.ts`
- Create: `resources/js/types/pos.ts`
- Create: `resources/js/pages/Floor/FloorWorkspace.tsx`
- Create: `resources/js/pages/Pos/PosWorkspace.tsx`
- Create: `resources/js/modules/pos/{ProductGrid.tsx,ModifierSheet.tsx,MultiRoundCart.tsx,ManagerPinModal.tsx,TableTransferDialog.tsx}`
- Test: `tests/Feature/Http/PosAndFloorInertiaTest.php`

**Interfaces:**
- Consumes: Floor & Order Actions/Queries (Tasks 1–3), `GetBranchCatalogQuery` (Phase 1 Task 4), `RequireOpenShiftMiddleware` (Phase 1 Task 5).
- Produces:
  - Endpoints: `GET /floor`, `POST /floor/tables/{table}/state`, `POST /floor/tables/{table}/service-request`, `POST /floor/orders/{order}/transfer`, `GET /pos`, `POST /pos/orders`, `POST /pos/orders/{order}/items`, `DELETE /pos/order-items/{item}`, `POST /pos/orders/{order}/fire`, `POST /pos/orders/{order}/discount`, `POST /pos/order-items/{item}/void`.
  - React hook `useBranchEcho(branchId: number, channels: ('pos' | 'kds' | 'floor' | 'manager')[], handlers)`

- [ ] **Step 1: Write the failing test**

In `tests/Feature/Http/PosAndFloorInertiaTest.php`:
- `it('renders FloorWorkspace and PosWorkspace with active branch tables, catalog, and open order tabs')`: assert Inertia component names `'Floor/FloorWorkspace'` and `'Pos/PosWorkspace'` and expected props.
- `it('fires a round and voids an item over HTTP endpoints protected by open shift middleware')`: verify end-to-end HTTP POST flow from `/pos/orders` → `/items` → `/fire` → `/void` (returning `422` on invalid PIN, `200`/redirect on valid PIN `'1234'`).

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test --filter=PosAndFloorInertiaTest`
Expected: FAIL (`FloorController` / route not defined).

- [ ] **Step 3: Implement thin controllers, routes, Echo hook, and React workspaces**

Controllers validate via FormRequests and delegate exclusively to Domain Actions (`arch()` compliant). Build `FloorWorkspace.tsx` (zone tabs, animated `motion.dev` table cards showing occupancy, guest count, ready-food alert badge, and `TableTransferDialog`) and `PosWorkspace.tsx` (category navigation, search, 86'd real-time badge updates via `useBranchEcho`, `ModifierSheet`, `MultiRoundCart` clearly separating `Draft` items vs. `Fired Round N` items, and `ManagerPinModal` for >15% discounts and post-fire voids).

- [ ] **Step 4: Run test and TypeScript check to verify they pass**

Run: `php artisan test --filter=PosAndFloorInertiaTest && npm run types`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/Http/Controllers/FloorController.php app/Http/Controllers/PosController.php routes/web.php resources/js tests/Feature/Http/PosAndFloorInertiaTest.php
git commit -m "feat(ui): build FloorWorkspace, PosWorkspace, and real-time Echo listeners"
```

---

### Task 6: Touch-Optimized `KdsWorkspace` (Station Filters, SLA Timers, Web Audio Chime) & `SplitScreenDemoWorkspace`

**Files:**
- Create: `app/Http/Controllers/{KdsController,SplitScreenDemoController}.php`
- Modify: `routes/web.php`
- Create: `resources/js/pages/Kds/KdsWorkspace.tsx`
- Create: `resources/js/pages/Evaluator/SplitScreenDemoWorkspace.tsx`
- Create: `resources/js/modules/kds/{TicketCard.tsx,SlaTimerBadge.tsx,useKdsAudioAlert.ts}`
- Modify: `resources/js/components/evaluator/EvaluatorControlBar.tsx` (wire Split-Screen mode toggle & active nav links)
- Test: `tests/Feature/Http/KdsAndSplitScreenInertiaTest.php`

**Interfaces:**
- Consumes: `GetActiveKdsTicketsQuery`, `BumpKitchenItemStatusAction`, `ServeKitchenTicketExpoAction` (Task 4), `PosWorkspace` components (Task 5).
- Produces:
  - Endpoints: `GET /kds`, `POST /kds/items/{item}/bump`, `POST /kds/tickets/{ticket}/serve`, `GET /demo/split-screen`.
  - Shared reusable `<PosPanel />` and `<KdsPanel />` components composed inside `SplitScreenDemoWorkspace.tsx`.

- [ ] **Step 1: Write the failing test**

In `tests/Feature/Http/KdsAndSplitScreenInertiaTest.php`:
- `it('renders KdsWorkspace and SplitScreenDemoWorkspace with live branch catalog, tables, and active kitchen tickets')`: assert Inertia components `'Kds/KdsWorkspace'` and `'Evaluator/SplitScreenDemoWorkspace'`.
- `it('bumps kitchen items and serves completed tickets via HTTP KDS endpoints')`: POST `/kds/items/{id}/bump` and `/kds/tickets/{id}/serve`, verifying `TicketState::Served`.

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test --filter=KdsAndSplitScreenInertiaTest`
Expected: FAIL (`KdsController` / route not defined).

- [ ] **Step 3: Implement controllers, routes, `KdsWorkspace`, and `SplitScreenDemoWorkspace`**

`KdsWorkspace.tsx` renders large touch-friendly cards animated with `motion.dev` (`layout` + entry animations), station filter tabs (`All / Expo`, `Grill`, `Cold/Salad`, `Pastry`, `Bar`), `SlaTimerBadge.tsx` ticking every second (`< 10m` Emerald, `10–15m` Amber, `> 15m` Rose pulse), voided item strike-throughs, and `useKdsAudioAlert.ts` (Web Audio API chime on new `OrderRoundFired` or SLA > 15m breach with mute toggle). `SplitScreenDemoWorkspace.tsx` mounts `<PosPanel />` (left 50%) and `<KdsPanel />` (right 50%) connected to live Echo channels so firing a round on the left animates onto the KDS board on the right immediately.

- [ ] **Step 4: Run full test suite and TypeScript check**

Run: `php artisan test && npm run types`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/Http/Controllers/KdsController.php app/Http/Controllers/SplitScreenDemoController.php routes/web.php resources/js tests/Feature/Http/KdsAndSplitScreenInertiaTest.php
git commit -m "feat(kds,demo): build touch KDS board with SLA chimes and SplitScreenDemoWorkspace"
```
