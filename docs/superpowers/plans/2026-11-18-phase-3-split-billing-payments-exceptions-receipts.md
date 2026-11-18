# Phase 3: Split-Billing Engine, Payment Integrity, Exception Paths & Receipts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the financial settlement engine: bill request & reopen guardrails, 3-mode split billing (Unified, Item/Seat Split, and Equal $N$-Way with deterministic penny allocation), idempotent `SELECT ... FOR UPDATE` payment capture with partial-settlement recovery, Manager-PIN refunds, thermal receipt payloads, and blind cash-drawer shift reconciliation UI.

**Architecture:** Extends the Modular Monolith under `app/Modules/Billing/` interacting strictly via Actions with `Orders`, `Floor`, `Shifts`, `Identity`, and `Audit`. Uses a `PaymentGatewayInterface` backed by `SimulatedPaymentGateway` (honoring Evaluator Control Bar failure simulation flags), integer-cent remainder distribution so `SUM(bill_splits.total_cents) === order.total_cents`, and `afterCommit` Reverb events (`OrderBillSplitUpdated`, `PaymentCaptured`).

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

1. **Deterministic $N$-way split penny remainder:** Splitting an order with `total_cents = 10000` (`$100.00`) equally across `N = 3` checks via `SplitOrderBillAction` must yield check totals `[3333, 3333, 3334]` summing to exactly `10000` (pinned in Task 2).
2. **Item/seat split total invariant:** Splitting an order with a `10%` discount, `5%` service charge, and `8.25%` tax across Check A and Check B by item assignment (including fractional shared items) must guarantee `CheckA.total_cents + CheckB.total_cents === Order.total_cents`, allocating any 1-cent rounding difference to the final check (pinned in Task 2).
3. **Idempotent duplicate payment retry:** Calling `SettleBillSplitAction` twice with the same `idempotency_key` must return the original `PaymentTransaction` without creating a second charge or double-incrementing the shift's `expected_cash_cents` (pinned in Task 3).
4. **Partial payment failure & `PartiallyPaid` lock:** When Check A succeeds (`Card`) and Check B declines (`Card` with simulator decline enabled), the order transitions to `OrderState::PartiallyPaid`, Check A stays `BillSplitState::Paid`, calling `ReopenOrderFromBillingAction` throws `CannotReopenPartiallyPaidOrderException`, and settling Check B with `Cash` advances the order to `OrderState::Paid` and table to `TableState::Dirty` (pinned in Task 1 & Task 3).
5. **Post-payment Manager-PIN refund & cash drawer deduction:** Calling `RefundPaymentAction` on a `5000`-cent cash payment with a valid Manager PIN inserts an immutable `PaymentTransaction` (`amount_cents = -5000`, `PaymentState::Refunded`), decrements the active shift's `expected_cash_cents` by `5000`, and records an `AuditLog`; attempting to refund more than the remaining captured amount throws `RefundExceedsCapturedAmountException` (pinned in Task 4).

---

## File Structure

- `database/migrations/2026_11_18_000009_create_bill_splits_and_payment_transactions_tables.php` — `bill_splits`, `bill_split_items`, `payment_transactions` (unique `idempotency_key`).
- `app/Modules/Billing/Enums/{SplitMode,BillSplitState,PaymentState,TenderMethod}.php` — Billing & payment state machines.
- `app/Modules/Billing/Models/{BillSplit,BillSplitItem,PaymentTransaction}.php` — Billing persistence models.
- `app/Modules/Billing/Contracts/PaymentGatewayInterface.php` & `app/Modules/Billing/Gateways/SimulatedPaymentGateway.php` — Pluggable gateway contract with deterministic decline simulation.
- `app/Modules/Billing/Events/{OrderBillSplitUpdated,PaymentCaptured}.php` — `afterCommit` Reverb events on `.pos`.
- `app/Modules/Billing/Actions/` — `RequestOrderBillAction`, `ReopenOrderFromBillingAction`, `SplitOrderBillAction`, `SettleBillSplitAction`, `RefundPaymentAction`, `BuildThermalReceiptAction`.
- `app/Http/Controllers/{BillingController,ShiftReconciliationController}.php` — Thin endpoints for splitting, settling, refunding, receipt rendering, and shift close/approve.
- `resources/js/modules/billing/{SplitBillDrawer.tsx,PaymentSettlementModal.tsx,ThermalReceiptDialog.tsx,RefundModal.tsx}` & `resources/js/pages/Shifts/ShiftReconciliationModal.tsx` — Interactive billing & shift UI.

---

### Task 1: Billing Lifecycle (`RequestOrderBillAction` & `ReopenOrderFromBillingAction` Guard)

**Files:**
- Create: `database/migrations/2026_11_18_000009_create_bill_splits_and_payment_transactions_tables.php`
- Create: `app/Modules/Billing/Enums/{SplitMode,BillSplitState,PaymentState,TenderMethod}.php`
- Create: `app/Modules/Billing/Exceptions/CannotReopenPartiallyPaidOrderException.php`
- Create: `app/Modules/Billing/Models/{BillSplit,BillSplitItem,PaymentTransaction}.php`
- Create: `app/Modules/Billing/Actions/{RequestOrderBillAction,ReopenOrderFromBillingAction}.php`
- Test: `tests/Feature/Modules/Billing/BillingLifecycleGuardTest.php`

**Interfaces:**
- Consumes: `Order`, `OrderState` (Phase 2 Task 2), `DiningTable`, `TableState` (Phase 2 Task 1).
- Produces:
  - `App\Modules\Billing\Enums\SplitMode`: `'unified'`, `'item_seat'`, `'equal'`
  - `App\Modules\Billing\Enums\BillSplitState`: `'pending'`, `'paid'`, `'failed'`
  - `App\Modules\Billing\Enums\PaymentState`: `'captured'`, `'failed'`, `'refunded'`
  - `App\Modules\Billing\Enums\TenderMethod`: `'cash'`, `'card'`, `'qr'`
  - `App\Modules\Billing\Actions\RequestOrderBillAction::execute(int $orderId): Order`
  - `App\Modules\Billing\Actions\ReopenOrderFromBillingAction::execute(int $orderId): Order`

- [ ] **Step 1: Write the failing test**

In `tests/Feature/Modules/Billing/BillingLifecycleGuardTest.php`:
- `it('transitions an Open order and its Occupied table to Billing and clears unpaid splits on Reopen')`: open dine-in order with fired items, call `RequestOrderBillAction`, assert `order.state === OrderState::Billing`, `table.state === TableState::Billing`, and a default unified `BillSplit` exists; calling `AddDraftOrderItemAction` while in `Billing` throws `DomainException`. Call `ReopenOrderFromBillingAction` and assert `order.state === OrderState::Open`, `table.state === TableState::Occupied`, and unpaid `BillSplit` rows are deleted.
- `it('blocks reopening when any BillSplit is Paid or order is PartiallyPaid')` (**pins Review Focus #4**): mark a `BillSplit` `Paid` (or order `PartiallyPaid`), call `ReopenOrderFromBillingAction`, and assert `CannotReopenPartiallyPaidOrderException`.

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test --filter=BillingLifecycleGuardTest`
Expected: FAIL (`BillSplit` / `RequestOrderBillAction` not found).

- [ ] **Step 3: Implement migration, enums, models, and lifecycle actions**

Create `bill_splits` (`order_id`, `sequence_number`, `label`, `split_mode`, `state`, `subtotal_cents`, `discount_cents`, `service_charge_cents`, `tax_cents`, `tip_cents`, `total_cents`), `bill_split_items` (`bill_split_id`, `order_item_id`, `share_numerator`, `share_denominator`, `allocated_subtotal_cents`), and `payment_transactions` (`branch_id`, `shift_id`, `order_id`, `bill_split_id`, `parent_transaction_id`, `idempotency_key` unique, `tender_method`, `state`, `amount_cents` signed integer, `tip_cents`, `tendered_cents`, `change_cents`, `failure_reason`, `gateway_reference`, `processed_by_user_id`). Also guard `AddDraftOrderItemAction` and `FireOrderRoundAction` in Phase 2 against `OrderState::Billing` / `PartiallyPaid` / `Paid`.

- [ ] **Step 4: Run test to verify it passes**

Run: `php artisan test --filter=BillingLifecycleGuardTest`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add database/migrations/2026_11_18_000009* app/Modules/Billing tests/Feature/Modules/Billing/BillingLifecycleGuardTest.php
git commit -m "feat(billing): add billing schema, state enums, and bill request/reopen guards"
```

---

### Task 2: Split-Bill Engine (`SplitOrderBillAction`: Unified, Item/Seat & Equal $N$-Way Deterministic Penny Allocation)

**Files:**
- Create: `app/Modules/Billing/DTOs/{SplitOrderBillData,SeatItemAllocationData}.php`
- Create: `app/Modules/Billing/Events/OrderBillSplitUpdated.php`
- Create: `app/Modules/Billing/Actions/SplitOrderBillAction.php`
- Test: `tests/Feature/Modules/Billing/SplitOrderBillMathTest.php`

**Interfaces:**
- Consumes: `Order`, `BillSplit`, `BillSplitItem`, `SplitMode`, `TaxCalculator` (Phase 1 Task 1).
- Produces:
  - `App\Modules\Billing\DTOs\SeatItemAllocationData` (`int $orderItemId`, `int $shareNumerator = 1`, `int $shareDenominator = 1`)
  - `App\Modules\Billing\DTOs\SplitOrderBillData` (`int $orderId`, `SplitMode $mode`, `?int $equalWays = null`, `array $seatGroups = []`)
  - `App\Modules\Billing\Actions\SplitOrderBillAction::execute(SplitOrderBillData $data): Collection`

- [ ] **Step 1: Write the failing test**

In `tests/Feature/Modules/Billing/SplitOrderBillMathTest.php`:
- `it('distributes equal N-way splits deterministically so remainders land on final checks with zero drift')` (**pins Review Focus #1**): order with `total_cents = 10000`, `SplitMode::Equal`, `equalWays = 3`; assert returned `BillSplit` totals are `[3333, 3333, 3334]` and `sum === 10000`; also test `10001` across `4` ways -> `[2500, 2500, 2500, 2501]` (`sum === 10001`).
- `it('splits by item and shared fractional item while preserving exact order discount, service charge, and tax sum')` (**pins Review Focus #2**): order with 3 non-voided items, `1000` bps (`10%`) discount, `500` bps (`5%`) service charge, `825` bps (`8.25%`) tax; assign Item 1 + half of Item 3 (`1/2`) to Check A and Item 2 + half of Item 3 (`1/2`) to Check B; assert `CheckA.total_cents + CheckB.total_cents === $order->total_cents` and every item share sum equals `1/1`.
- `it('rejects re-splitting an order once any check has already been paid')`: throw `CannotReopenPartiallyPaidOrderException`.

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test --filter=SplitOrderBillMathTest`
Expected: FAIL (`SplitOrderBillAction` not found).

- [ ] **Step 3: Implement DTOs, `OrderBillSplitUpdated`, and `SplitOrderBillAction`**

Use a deterministic allocation algorithm inside `DB::transaction()` with `lockForUpdate()` on `Order`:
```php
// Equal N-way allocation across total_cents, subtotal_cents, discount_cents, service_charge_cents, tax_cents:
$base = intdiv($amountCents, $ways);
$remainder = $amountCents % $ways;
// Check index i (0..$ways-1) gets $base + ($i >= $ways - $remainder ? 1 : 0)
```
For `SplitMode::ItemSeat`, validate that every non-voided `OrderItem` has fractional shares summing to exactly `1.0` (by exact common denominator check without floats), allocate each check's proportional `subtotal_cents`, `discount_cents`, `service_charge_cents`, and `tax_cents`, and reconcile any rounding delta (`order->field_cents - sum(splits->field_cents)`) onto the final check so totals match the order to the exact cent. Broadcast `OrderBillSplitUpdated` `afterCommit` on `private-branch.{branchId}.pos`.

- [ ] **Step 4: Run test to verify it passes**

Run: `php artisan test --filter=SplitOrderBillMathTest`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/Modules/Billing/DTOs app/Modules/Billing/Events/OrderBillSplitUpdated.php app/Modules/Billing/Actions/SplitOrderBillAction.php tests/Feature/Modules/Billing/SplitOrderBillMathTest.php
git commit -m "feat(billing): implement 3-mode split-bill engine with deterministic cent allocation"
```

---

### Task 3: Idempotent Payment Settlement (`SettleBillSplitAction`), Simulated Gateway & Partial Failure Recovery

**Files:**
- Create: `app/Modules/Billing/Contracts/PaymentGatewayInterface.php`
- Create: `app/Modules/Billing/Gateways/{GatewayChargeResult,SimulatedPaymentGateway}.php`
- Create: `app/Modules/Billing/DTOs/SettleBillSplitData.php`
- Create: `app/Modules/Billing/Events/PaymentCaptured.php`
- Create: `app/Modules/Billing/Actions/SettleBillSplitAction.php`
- Modify: `app/Providers/AppServiceProvider.php` (bind `PaymentGatewayInterface` -> `SimulatedPaymentGateway`)
- Test: `tests/Feature/Modules/Billing/SettleBillSplitConcurrencyAndFailureTest.php`

**Interfaces:**
- Consumes: `BillSplit`, `PaymentTransaction`, `Shift`, `RecordCashMovementAction` (Phase 1 Task 5), `DiningTable`, `TableOccupancyChanged` (Phase 2 Task 1).
- Produces:
  - `App\Modules\Billing\Contracts\PaymentGatewayInterface::charge(TenderMethod $method, int $amountCents, string $idempotencyKey, bool $simulateDecline = false): GatewayChargeResult`
  - `App\Modules\Billing\DTOs\SettleBillSplitData` (`int $billSplitId`, `int $shiftId`, `int $actorUserId`, `TenderMethod $tenderMethod`, `int $amountTenderedCents`, `int $tipCents`, `string $idempotencyKey`, `bool $simulateDecline = false`)
  - `App\Modules\Billing\Actions\SettleBillSplitAction::execute(SettleBillSplitData $data): PaymentTransaction`

- [ ] **Step 1: Write the failing test**

In `tests/Feature/Modules/Billing/SettleBillSplitConcurrencyAndFailureTest.php`:
- `it('returns the existing PaymentTransaction idempotently when called twice with the same idempotency_key')` (**pins Review Focus #3**): settle a `5000`-cent `Cash` split with `amountTenderedCents: 6000`, `tipCents: 500`, `idempotencyKey: 'uuid-123'`; assert `change_cents === 500`, shift `expected_cash_cents` increased by `5500` (`5000 + 500 tip` net drawer inflow); call `SettleBillSplitAction` a second time with `'uuid-123'` and assert same `PaymentTransaction.id` returned and shift `expected_cash_cents` did NOT double-increment.
- `it('preserves Check A as Paid and moves Order to PartiallyPaid when Check B declines, then completes on retry')` (**pins Review Focus #4**): split order into Check A (`5000`) and Check B (`5000`). Settle Check A via `Card` (`simulateDecline: false`) -> `BillSplitState::Paid`, `OrderState::PartiallyPaid`. Settle Check B via `Card` with `simulateDecline: true` -> records `PaymentState::Failed`, Check B becomes `BillSplitState::Failed`, Order stays `OrderState::PartiallyPaid`, Table stays `TableState::Billing`. Retry Check B via `Cash` (`idempotencyKey: 'uuid-retry'`) -> Check B becomes `Paid`, Order becomes `OrderState::Paid`, Table becomes `TableState::Dirty`, and `PaymentCaptured` + `TableOccupancyChanged` broadcast `afterCommit`.
- `it('settles a Takeaway order without a dining table cleanly without attempting table transitions')`: create `ServiceType::Takeaway` order (`table_id: null`), request bill, settle via `Card`, assert `Order.state === OrderState::Paid` and `PaymentCaptured` dispatched.

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test --filter=SettleBillSplitConcurrencyAndFailureTest`
Expected: FAIL (`SettleBillSplitAction` not found).

- [ ] **Step 3: Implement Gateway contract, `SimulatedPaymentGateway`, `PaymentCaptured`, and `SettleBillSplitAction`**

Inside `DB::transaction()`:
1. Check `PaymentTransaction::where('idempotency_key', $data->idempotencyKey)->first()`; if found, return immediately.
2. Acquire `lockForUpdate()` on `Order`, `BillSplit`, and `Shift` (verifying `ShiftState::Open` and `BillSplitState !== Paid`).
3. Call `PaymentGatewayInterface::charge(...)`.
4. If gateway fails: insert `PaymentTransaction` (`PaymentState::Failed`), mark `BillSplit` `Failed`, transition `Order` to `PartiallyPaid` if any sibling check is `Paid`, and return the failed transaction (committed cleanly so partial failure history is durable).
5. If gateway succeeds: insert `PaymentTransaction` (`Captured`), record `CashDrawerMovement` (`CashSale`) if `TenderMethod::Cash`, mark `BillSplit` `Paid`; if all sibling `BillSplit` rows are `Paid`, mark `Order` `Paid` and dine-in `DiningTable` `Dirty`; broadcast `PaymentCaptured` (+ `TableOccupancyChanged` if table transitioned) `afterCommit`.

- [ ] **Step 4: Run test to verify it passes**

Run: `php artisan test --filter=SettleBillSplitConcurrencyAndFailureTest`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/Modules/Billing app/Providers/AppServiceProvider.php tests/Feature/Modules/Billing/SettleBillSplitConcurrencyAndFailureTest.php
git commit -m "feat(billing): implement idempotent SettleBillSplitAction with partial-payment recovery"
```

---

### Task 4: Manager-PIN Refunds (`RefundPaymentAction`) & Thermal Receipt Payload Generator

**Files:**
- Create: `app/Modules/Billing/Exceptions/RefundExceedsCapturedAmountException.php`
- Create: `app/Modules/Billing/DTOs/{RefundPaymentData,ThermalReceiptData}.php`
- Create: `app/Modules/Billing/Actions/{RefundPaymentAction,BuildThermalReceiptAction}.php`
- Test: `tests/Feature/Modules/Billing/RefundAndReceiptTest.php`

**Interfaces:**
- Consumes: `VerifyManagerPinAction` & `RecordAuditLogAction` (Phase 1 Task 3), `RecordCashMovementAction` (Phase 1 Task 5), `PaymentTransaction` (Task 3).
- Produces:
  - `App\Modules\Billing\DTOs\RefundPaymentData` (`int $paymentTransactionId`, `int $refundAmountCents`, `string $managerPin`, `int $actorUserId`, `string $reason`, `bool $wastage, int $activeShiftId`)
  - `App\Modules\Billing\Actions\RefundPaymentAction::execute(RefundPaymentData $data): PaymentTransaction`
  - `App\Modules\Billing\Actions\BuildThermalReceiptAction::execute(int $billSplitId): ThermalReceiptData`

- [ ] **Step 1: Write the failing test**

In `tests/Feature/Modules/Billing/RefundAndReceiptTest.php`:
- `it('creates an immutable negative Refunded transaction, adjusts cash drawer, logs audit, and blocks over-refunds')` (**pins Review Focus #5**): capture `5000`-cent cash payment; call `RefundPaymentAction` for `5000` cents with valid Manager PIN `'1234'`; assert new `PaymentTransaction` row (`amount_cents: -5000`, `state: PaymentState::Refunded`, `parent_transaction_id: $original->id`), shift `expected_cash_cents` decremented by `5000`, and `AuditLog` written. Calling `RefundPaymentAction` again for `100` cents throws `RefundExceedsCapturedAmountException`; calling with invalid PIN throws `InvalidManagerPinException`.
- `it('builds an itemized thermal receipt payload with branch info, split share, tax, tip, and tender summary')`: call `BuildThermalReceiptAction::execute($billSplit->id)` and assert exact cents breakdown.

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test --filter=RefundAndReceiptTest`
Expected: FAIL (`RefundPaymentAction` / `BuildThermalReceiptAction` not found).

- [ ] **Step 3: Implement DTOs, exception, `RefundPaymentAction`, and `BuildThermalReceiptAction`**

`RefundPaymentAction` verifies Manager PIN first, locks the original `PaymentTransaction` and active `Shift`, sums prior refunds referencing `parent_transaction_id`, asserts `$refundAmountCents > 0 && $refundAmountCents <= ($original->amount_cents - $alreadyRefunded)`, inserts negative `PaymentTransaction`, records `CashMovementType::CashRefund` if original tender was `Cash`, writes `AuditLog`, and sets a `refunded_with_wastage` attribute/event hook ready for Phase 4 inventory adjustment.

- [ ] **Step 4: Run test to verify it passes**

Run: `php artisan test --filter=RefundAndReceiptTest`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/Modules/Billing tests/Feature/Modules/Billing/RefundAndReceiptTest.php
git commit -m "feat(billing): add PIN-gated immutable refunds and thermal receipt payload builder"
```

---

### Task 5: React Split-Bill Drawer, Payment & Failure Recovery Modal, Thermal Receipt View & Shift Reconciliation UI

**Files:**
- Create: `app/Http/Controllers/{BillingController,ShiftReconciliationController}.php`
- Modify: `routes/web.php`
- Create: `resources/js/types/billing.ts`
- Create: `resources/js/modules/billing/{SplitBillDrawer.tsx,PaymentSettlementModal.tsx,ThermalReceiptDialog.tsx,RefundModal.tsx}`
- Create: `resources/js/pages/Shifts/ShiftReconciliationModal.tsx`
- Modify: `resources/js/pages/Pos/PosWorkspace.tsx` (integrate Billing button, Split Drawer, Payment Modal, Receipt History)
- Test: `tests/Feature/Http/BillingAndShiftReconciliationTest.php`

**Interfaces:**
- Consumes: All Billing & Shift Actions (Tasks 1–4 & Phase 1 Task 5).
- Produces:
  - Endpoints: `POST /billing/orders/{order}/request-bill`, `POST /billing/orders/{order}/reopen`, `POST /billing/orders/{order}/split`, `POST /billing/splits/{billSplit}/pay`, `POST /billing/payments/{payment}/refund`, `GET /billing/splits/{billSplit}/receipt`, `POST /shifts/open`, `POST /shifts/{shift}/close`, `POST /shifts/{shift}/approve-variance`.

- [ ] **Step 1: Write the failing test**

In `tests/Feature/Http/BillingAndShiftReconciliationTest.php`:
- `it('executes split billing, simulated decline recovery, receipt fetch, and blind shift variance close over HTTP')`: POST `/request-bill`, POST `/split` (`equal`, `ways: 2`), POST `/pay` with `simulate_card_decline` session flag enabled (`422` or failed state response on Check 1), switch to `Cash` and settle Check 1 & Check 2 (`200`), GET `/receipt` (`200` with JSON/Inertia receipt data), and POST `/shifts/{shift}/close` with blind count outside tolerance verifying `ShiftState::VarianceFlagged`.

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test --filter=BillingAndShiftReconciliationTest`
Expected: FAIL (`BillingController` / routes not found).

- [ ] **Step 3: Implement thin controllers, routes, and interactive React billing & shift components**

Build `SplitBillDrawer.tsx` (`shadcn/ui` Sheet + `motion.dev` animated check columns for `Unified`, `Equal N-Way`, and `By Item/Seat` tap assignment), `PaymentSettlementModal.tsx` (showing per-check statuses, `PartiallyPaid` recovery banner when a split fails, tender tabs `Cash`/`Card`/`QR`, tip chips, and deterministic `idempotency_key` per attempt), `ThermalReceiptDialog.tsx` (monospace 80mm receipt styling + `window.print()` trigger), `RefundModal.tsx` (Manager PIN input + restock/wastage radio), and `ShiftReconciliationModal.tsx` (blind cash count input hiding `expected_cash_cents` until submission).

- [ ] **Step 4: Run full test suite and TypeScript check**

Run: `php artisan test && npm run types`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/Http/Controllers/BillingController.php app/Http/Controllers/ShiftReconciliationController.php routes/web.php resources/js tests/Feature/Http/BillingAndShiftReconciliationTest.php
git commit -m "feat(billing,ui): build interactive split-bill drawer, failure recovery modal, thermal receipt, and blind shift close"
```
