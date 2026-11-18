# Phase 1: Foundation, Enterprise Business Model, Master Catalog & Shift Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the Laravel 12/13 + Inertia.js 2 (React 19 + TypeScript) Modular Monolith and build the Phase 1 foundation: multi-branch enterprise configuration, 8-role RBAC + 4-digit Manager PIN verification, master menu catalog with branch overrides & real-time 86'ing, shift/cash-drawer gating, *Aurelia Dining Group* demo seeders, and the persistent `EvaluatorControlBar`.

**Architecture:** Organizes backend domain logic under `app/Modules/{Restaurant,Identity,Menu,Shifts,Audit}` with strict Pest `arch()` boundary tests, integer-cent money helpers, PHP 8.3+ backed-enum state machines, and `afterCommit` Reverb events. Frontend uses Inertia.js 2 with React 19, TypeScript, Tailwind CSS, `shadcn/ui`, and `motion.dev` inside an `AppShellLayout` hosting the zero-friction evaluator bar.

**Tech Stack:** Laravel 12/13, PHP 8.3+, Inertia.js 2, React 19, TypeScript, Tailwind CSS, `shadcn/ui`, `motion.dev`, MySQL 8.4+ / SQLite (WAL), Redis + Laravel Horizon, Laravel Reverb + Echo, Pest PHP.

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

1. **Basis-point half-up rounding boundary:** `TaxCalculator::compute(netSubtotalCents: 1250, rateBps: 825)` must return `103` cents (`103.125` rounded half-up) and `TaxCalculator::compute(netSubtotalCents: 1000, rateBps: 825)` must return `83` (`82.5` rounded half-up) without any floating-point arithmetic (pinned in Task 1).
2. **Cross-branch Manager PIN rejection:** A valid 4-digit Manager PIN belonging to a `BranchManager` at *Waterfront Patio* (`branch_id = 2`) must throw `InvalidManagerPinException` when authorizing an override at *Downtown Flagship* (`branch_id = 1`) (pinned in Task 3).
3. **Branch 86'd override isolation:** Marking a `MenuItemVariant` `is_available = false` ("86'd") or setting `price_override_cents = 2400` at *Airport Express* must leave its availability `true` and effective price (`1900`) untouched at *Downtown Flagship*, and must dispatch `ItemAvailabilityChanged` `afterCommit` (pinned in Task 4).
4. **Duplicate open shift prevention & negative cash rejection:** Attempting to open a second `ShiftState::Open` shift for the same cashier at the same branch, or passing `opening_cash_cents < 0`, must throw `DomainException` in `OpenShiftAction` (pinned in Task 5).
5. **Blind shift close variance flagging:** Closing a shift with `counted_cash_cents` differing from `expected_cash_cents` by more than `branch.cash_variance_tolerance_cents` (`500` cents) must transition the shift to `ShiftState::VarianceFlagged` and dispatch `ShiftVarianceFlagged` `afterCommit`, whereas a difference `<= 500` transitions directly to `ShiftState::Closed` (pinned in Task 5).

---

## File Structure

- `composer.json` / `package.json` — Laravel 12/13, Horizon, Reverb, Pest, React 19, TypeScript, Inertia 2, Tailwind, `shadcn/ui`, `motion`, `laravel-echo`, `pusher-js`.
- `app/Support/Money/TaxCalculator.php` — Pure integer-cent discount, service charge, and basis-point half-up tax calculation helper + `OrderTotalsData`.
- `tests/Architecture/ModuleBoundariesTest.php` — Pest `arch()` rules enforcing `declare(strict_types=1)` and thin controllers.
- `app/Modules/Restaurant/` — `Branch` model, `BranchConfigData` DTO, `UpdateBranchSettingsAction`.
- `app/Modules/Identity/` — `StaffRole` enum (8 roles), `VerifyManagerPinAction`, `SwitchEvaluatorPersonaAction`, `InvalidManagerPinException`.
- `app/Modules/Audit/` — `AuditLog` model, `RecordAuditLogAction` for immutable compliance entries.
- `app/Modules/Menu/` — `PrepStation` enum, catalog & modifier models, `BranchMenuOverride`, `ItemAvailabilityChanged` event, `ToggleBranchItemAvailabilityAction`, `SetBranchPriceOverrideAction`, `GetBranchCatalogQuery`.
- `app/Modules/Shifts/` — `ShiftState` & `CashMovementType` enums, `Shift` & `CashDrawerMovement` models, `ShiftVarianceFlagged` event, `OpenShiftAction`, `RecordCashMovementAction`, `CloseShiftAction`, `ApproveShiftVarianceAction`, `RequireOpenShiftMiddleware`.
- `database/seeders/AureliaEnterpriseSeeder.php` — Zero-friction seed data for 3 branches, 8 role users (PIN `1234`), master menu across 4 prep stations, and an active open shift at *Downtown Flagship*.
- `resources/js/layouts/AppShellLayout.tsx` & `resources/js/components/evaluator/EvaluatorControlBar.tsx` — Persistent evaluator role/branch/simulation bar + shared Inertia shell.

---

### Task 1: Project Scaffolding, Money Math & Module Boundary Architecture Tests

**Files:**
- Create: `composer.json`, `package.json`, `bootstrap/app.php`, `config/database.php`, `config/broadcasting.php`, `config/horizon.php` (via Laravel installer / scaffolding)
- Create: `app/Support/Money/OrderTotalsData.php`
- Create: `app/Support/Money/TaxCalculator.php`
- Test: `tests/Unit/Support/TaxCalculatorTest.php`
- Test: `tests/Architecture/ModuleBoundariesTest.php`

**Interfaces:**
- Consumes: Standard Laravel 12/13 & Pest PHP installation.
- Produces:
  - `App\Support\Money\OrderTotalsData` (`readonly` DTO: `int $subtotalCents`, `int $discountCents`, `int $netSubtotalCents`, `int $serviceChargeCents`, `int $taxCents`, `int $totalCents`)
  - `App\Support\Money\TaxCalculator::compute(int $netSubtotalCents, int $rateBps): int`
  - `App\Support\Money\TaxCalculator::calculateOrderTotals(int $subtotalCents, int $discountCents, int $serviceChargeBps, int $taxRateBps): OrderTotalsData`

- [ ] **Step 1: Scaffold Laravel 12/13 + Inertia 2 React/TS + Pest + Reverb + Horizon + `shadcn/ui` + `motion`**

Run Laravel project setup in the workspace root (preserving `docs/`), install `laravel/reverb`, `laravel/horizon`, `inertiajs/inertia-laravel`, `pestphp/pest`, `pestphp/pest-plugin-laravel`, and install frontend deps (`react`, `react-dom`, `@inertiajs/react`, `typescript`, `tailwindcss`, `motion`, `lucide-react`, `laravel-echo`, `pusher-js`, and `shadcn/ui` CLI init). Configure SQLite WAL mode in `AppServiceProvider::boot()` when driver is `sqlite` and ensure `.env.testing` uses SQLite `:memory:`.

- [ ] **Step 2: Write the failing tests for `TaxCalculator` and `ModuleBoundariesTest`**

```php
// tests/Unit/Support/TaxCalculatorTest.php
it('computes half-up basis point tax and service charge without floats', function (): void {
    expect(TaxCalculator::compute(1250, 825))->toBe(103); // 103.125 -> 103
    expect(TaxCalculator::compute(1000, 825))->toBe(83);  // 82.5 -> 83 (half-up)
    expect(TaxCalculator::compute(0, 825))->toBe(0);
});

it('applies discount before computing independent service charge and tax', function (): void {
    $totals = TaxCalculator::calculateOrderTotals(
        subtotalCents: 10000,
        discountCents: 1000,
        serviceChargeBps: 500,
        taxRateBps: 825,
    );

    expect($totals->netSubtotalCents)->toBe(9000)
        ->and($totals->serviceChargeCents)->toBe(450)
        ->and($totals->taxCents)->toBe(743)
        ->and($totals->totalCents)->toBe(10193);
});
```

```php
// tests/Architecture/ModuleBoundariesTest.php
arch('domain modules and support enforce strict types')
    ->expect(['App\Modules', 'App\Support'])
    ->toUseStrictTypes();

arch('controllers do not import eloquent models directly for writes or queries')
    ->expect('App\Http\Controllers')
    ->not->toUse(['Illuminate\Support\Facades\DB']);
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `php artisan test tests/Unit/Support/TaxCalculatorTest.php`
Expected: FAIL (`Class "App\Support\Money\TaxCalculator" not found`).

- [ ] **Step 4: Implement `OrderTotalsData` and `TaxCalculator`**

Create `app/Support/Money/OrderTotalsData.php` and `app/Support/Money/TaxCalculator.php`:
```php
public static function compute(int $netSubtotalCents, int $rateBps): int
{
    if ($netSubtotalCents <= 0 || $rateBps <= 0) {
        return 0;
    }

    return intdiv(($netSubtotalCents * $rateBps) + 5000, 10000);
}
```
Validate `$discountCents >= 0` and `$discountCents <= $subtotalCents` in `calculateOrderTotals()`, throwing `InvalidArgumentException` otherwise.

- [ ] **Step 5: Run tests to verify they pass**

Run: `php artisan test tests/Unit/Support/TaxCalculatorTest.php tests/Architecture/ModuleBoundariesTest.php`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "chore: scaffold laravel inertia stack, integer money calculator, and arch tests"
```

---

### Task 2: Restaurant Management Module (`Branches`, Tax/Service Rules & Operating Config)

**Files:**
- Create: `database/migrations/2026_11_18_000001_create_branches_table.php`
- Create: `app/Modules/Restaurant/Models/Branch.php`
- Create: `app/Modules/Restaurant/DTOs/BranchConfigData.php`
- Create: `app/Modules/Restaurant/Actions/UpdateBranchSettingsAction.php`
- Test: `tests/Feature/Modules/Restaurant/BranchSettingsTest.php`

**Interfaces:**
- Consumes: `declare(strict_types=1)` foundation from Task 1.
- Produces:
  - `App\Modules\Restaurant\Models\Branch` (`id`, `code`, `name`, `timezone`, `tax_rate_bps`, `service_charge_bps`, `discount_pin_threshold_bps`, `cash_variance_tolerance_cents`, `operating_hours` JSON, `is_active`)
  - `App\Modules\Restaurant\DTOs\BranchConfigData` (`string $name`, `int $taxRateBps`, `int $serviceChargeBps`, `int $discountPinThresholdBps`, `int $cashVarianceToleranceCents`, `bool $isActive`)
  - `App\Modules\Restaurant\Actions\UpdateBranchSettingsAction::execute(Branch $branch, BranchConfigData $data): Branch`

- [ ] **Step 1: Write the failing test**

In `tests/Feature/Modules/Restaurant/BranchSettingsTest.php`, test `it('updates branch tax, service charge, and governance thresholds inside a transaction')`: create a `Branch` (`tax_rate_bps: 825`, `service_charge_bps: 500`, `discount_pin_threshold_bps: 1500`, `cash_variance_tolerance_cents: 500`), execute `UpdateBranchSettingsAction` with `taxRateBps: 900`, `discountPinThresholdBps: 1000`, `cashVarianceToleranceCents: 250`, and assert persisted integer values; also test rejecting negative basis points (`InvalidArgumentException`).

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test --filter=BranchSettingsTest`
Expected: FAIL (`Class "App\Modules\Restaurant\Models\Branch" not found`).

- [ ] **Step 3: Create migration, `Branch` model, `BranchConfigData` DTO, and `UpdateBranchSettingsAction`**

Migration uses standard MySQL/SQLite column types (`string('code')->unique()`, `unsignedInteger` for `*_bps` and `*_cents`, `json('operating_hours')->nullable()`). `UpdateBranchSettingsAction::execute()` validates non-negative integer invariants and updates within `DB::transaction()`.

- [ ] **Step 4: Run test to verify it passes**

Run: `php artisan test --filter=BranchSettingsTest`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add database/migrations/2026_11_18_000001_create_branches_table.php app/Modules/Restaurant tests/Feature/Modules/Restaurant
git commit -m "feat(restaurant): add branches schema, config DTO, and update settings action"
```

---

### Task 3: Identity, 8-Role RBAC, 4-Digit Manager PIN Verification & Audit Log Foundation

**Files:**
- Create: `database/migrations/2026_11_18_000002_add_role_branch_pin_to_users_table.php`
- Create: `database/migrations/2026_11_18_000003_create_audit_logs_table.php`
- Create: `app/Modules/Identity/Enums/StaffRole.php`
- Create: `app/Modules/Identity/Exceptions/InvalidManagerPinException.php`
- Create: `app/Modules/Audit/Models/AuditLog.php`
- Create: `app/Modules/Audit/Events/CriticalAuditLogged.php`
- Create: `app/Modules/Audit/Actions/RecordAuditLogAction.php`
- Create: `app/Modules/Identity/Actions/VerifyManagerPinAction.php`
- Modify: `app/Models/User.php`
- Test: `tests/Feature/Modules/Identity/VerifyManagerPinTest.php`

**Interfaces:**
- Consumes: `Branch` (Task 2).
- Produces:
  - `App\Modules\Identity\Enums\StaffRole`: `'enterprise_system_admin'`, `'restaurant_owner'`, `'branch_manager'`, `'cashier'`, `'waiter'`, `'chef'`, `'kitchen_expediter'`, `'inventory_manager'` + helper `canAuthorizeManagerPin(): bool` (`BranchManager`, `RestaurantOwner`, `EnterpriseSystemAdmin`).
  - `App\Modules\Audit\Events\CriticalAuditLogged` (`ShouldBroadcastNow`, `ShouldDispatchAfterCommit` on `private-branch.{branchId}.manager`)
  - `App\Modules\Audit\Actions\RecordAuditLogAction::execute(int $branchId, int $actorUserId, ?int $approverUserId, string $eventType, string $auditableType, int|string $auditableId, array $payload = [], bool $isCritical = false): AuditLog`
  - `App\Modules\Identity\Actions\VerifyManagerPinAction::execute(int $branchId, string $pin, int $actorUserId, string $actionType, array $context = []): User`

- [ ] **Step 1: Write the failing test**

In `tests/Feature/Modules/Identity/VerifyManagerPinTest.php`:
- `it('verifies a valid 4-digit manager PIN for the same branch and records an audit log')`: seed `Branch(1)` with `BranchManager` (`pin_hash = Hash::make('1234')`) and `Cashier`; verify `VerifyManagerPinAction::execute(1, '1234', $cashier->id, 'high_discount')` returns the manager `User` and writes an `AuditLog` with both `actor_user_id` and `approver_user_id`.
- `it('rejects a valid manager PIN belonging to a different branch')` (**pins Review Focus #2**): seed `Branch(1)` and `Branch(2)` with a manager assigned to `Branch(2)` (`pin = '9999'`); assert `VerifyManagerPinAction::execute(1, '9999', $cashier->id, 'post_fire_void')` throws `InvalidManagerPinException` (and logs failed PIN attempt).
- `it('rejects a PIN from a non-manager role such as cashier')`: assert `InvalidManagerPinException`.

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test --filter=VerifyManagerPinTest`
Expected: FAIL (`StaffRole` / `VerifyManagerPinAction` not found).

- [ ] **Step 3: Implement migrations, `StaffRole`, `User` casts, `AuditLog`, `CriticalAuditLogged`, `RecordAuditLogAction`, and `VerifyManagerPinAction`**

Add `branch_id` (nullable FK to `branches` for corporate/owner/admin), `role` (string indexed), `pin_hash` (nullable string), and `assigned_station` (nullable string) to `users`. `RecordAuditLogAction` persists the `AuditLog` and dispatches `CriticalAuditLogged` (`ShouldDispatchAfterCommit`) when `$isCritical` is true. `VerifyManagerPinAction` validates 4-digit format (`/^\d{4}$/`), queries users with `canAuthorizeManagerPin()` roles scoped to `$branchId` (or `RestaurantOwner` whose `branch_id === null` as corporate override), checks `Hash::check($pin, $candidate->pin_hash)`, records a critical `AuditLog` via `RecordAuditLogAction(..., isCritical: true)`, and returns the approving `User`.

- [ ] **Step 4: Run test to verify it passes**

Run: `php artisan test --filter=VerifyManagerPinTest`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add database/migrations/2026_11_18_000002* database/migrations/2026_11_18_000003* app/Models/User.php app/Modules/Identity app/Modules/Audit tests/Feature/Modules/Identity
git commit -m "feat(identity,audit): add 8-role RBAC, 4-digit manager PIN verification, and audit logs"
```

---

### Task 4: Menu Management Module (Master Catalog, Variants, Modifiers, Branch Overrides & Real-Time 86'ing)

**Files:**
- Create: `database/migrations/2026_11_18_000004_create_menu_tables.php`
- Create: `app/Modules/Menu/Enums/PrepStation.php`
- Create: `app/Modules/Menu/Models/{MenuCategory,MenuItem,MenuItemVariant,ModifierGroup,ModifierOption,BranchMenuOverride}.php`
- Create: `app/Modules/Menu/Events/ItemAvailabilityChanged.php`
- Create: `app/Modules/Menu/Actions/{ToggleBranchItemAvailabilityAction,SetBranchPriceOverrideAction}.php`
- Create: `app/Modules/Menu/Queries/GetBranchCatalogQuery.php`
- Test: `tests/Feature/Modules/Menu/BranchCatalogAnd86Test.php`

**Interfaces:**
- Consumes: `Branch` (Task 2), `RecordAuditLogAction` (Task 3).
- Produces:
  - `App\Modules\Menu\Enums\PrepStation`: `'grill'`, `'cold_salad'`, `'pastry'`, `'bar'`
  - `App\Modules\Menu\Events\ItemAvailabilityChanged` (`ShouldBroadcastNow`, `ShouldDispatchAfterCommit`, broadcasts on `private-branch.{branchId}.pos` and `private-branch.{branchId}.manager`)
  - `App\Modules\Menu\Actions\ToggleBranchItemAvailabilityAction::execute(int $branchId, int $variantId, bool $isAvailable, ?string $reason, int $actorUserId): BranchMenuOverride`
  - `App\Modules\Menu\Actions\SetBranchPriceOverrideAction::execute(int $branchId, int $variantId, ?int $priceOverrideCents, int $actorUserId): BranchMenuOverride`
  - `App\Modules\Menu\Queries\GetBranchCatalogQuery::execute(int $branchId): Collection`

- [ ] **Step 1: Write the failing test**

In `tests/Feature/Modules/Menu/BranchCatalogAnd86Test.php`:
- `it('isolates branch 86 availability and price overrides per branch and broadcasts ItemAvailabilityChanged after commit')` (**pins Review Focus #3**): seed a `MenuItemVariant` (`base_price_cents: 1900`, `prep_station: PrepStation::Grill`) across *Downtown Flagship* (`branch 1`) and *Airport Express* (`branch 2`). Execute `ToggleBranchItemAvailabilityAction::execute($branch2->id, $variant->id, false, 'Out of steak', $manager->id)` and `SetBranchPriceOverrideAction::execute($branch2->id, $variant->id, 2400, $manager->id)` under `Event::fake([ItemAvailabilityChanged::class])`. Assert `ItemAvailabilityChanged` was dispatched for `$branch2->id`, `$branch2` catalog shows `effective_price_cents: 2400, is_available: false`, and `$branch1` catalog shows `effective_price_cents: 1900, is_available: true`.

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test --filter=BranchCatalogAnd86Test`
Expected: FAIL (`PrepStation` / `BranchMenuOverride` not found).

- [ ] **Step 3: Implement migration, models, `ItemAvailabilityChanged`, actions, and `GetBranchCatalogQuery`**

Create tables: `menu_categories`, `menu_items` (`prep_station`, `allergen_tags` JSON), `menu_item_variants` (`base_price_cents`), `modifier_groups` & `modifier_options` (`price_delta_cents`), `menu_item_modifier_group` pivot, and `branch_menu_overrides` (unique `(branch_id, menu_item_variant_id)`, `price_override_cents`, `is_available`, `eighty_sixed_reason`). Both override actions run inside `DB::transaction()`, record an `AuditLog`, and dispatch `ItemAvailabilityChanged` (`ShouldDispatchAfterCommit`) `afterCommit`.

- [ ] **Step 4: Run test to verify it passes**

Run: `php artisan test --filter=BranchCatalogAnd86Test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add database/migrations/2026_11_18_000004* app/Modules/Menu tests/Feature/Modules/Menu
git commit -m "feat(menu): add master catalog, modifiers, branch overrides, and real-time 86 events"
```

---

### Task 5: Staff & Shifts Module (`ShiftState`, Open/Close Cash Drawer Gate & Blind Variance Flagging)

**Files:**
- Create: `database/migrations/2026_11_18_000005_create_shifts_and_cash_movements_tables.php`
- Create: `app/Modules/Shifts/Enums/{ShiftState,CashMovementType}.php`
- Create: `app/Modules/Shifts/Models/{Shift,CashDrawerMovement}.php`
- Create: `app/Modules/Shifts/Events/ShiftVarianceFlagged.php`
- Create: `app/Modules/Shifts/Actions/{OpenShiftAction,RecordCashMovementAction,CloseShiftAction,ApproveShiftVarianceAction}.php`
- Create: `app/Http/Middleware/RequireOpenShiftMiddleware.php`
- Test: `tests/Feature/Modules/Shifts/ShiftLifecycleTest.php`

**Interfaces:**
- Consumes: `Branch` (Task 2), `VerifyManagerPinAction` & `RecordAuditLogAction` (Task 3).
- Produces:
  - `App\Modules\Shifts\Enums\ShiftState`: `'open'`, `'closed'`, `'variance_flagged'`
  - `App\Modules\Shifts\Enums\CashMovementType`: `'opening_float'`, `'cash_sale'`, `'cash_refund'`, `'pay_in'`, `'pay_out'`
  - `App\Modules\Shifts\Actions\OpenShiftAction::execute(int $branchId, int $userId, int $openingCashCents): Shift`
  - `App\Modules\Shifts\Actions\RecordCashMovementAction::execute(int $shiftId, CashMovementType $type, int $amountCents, string $reference): CashDrawerMovement`
  - `App\Modules\Shifts\Actions\CloseShiftAction::execute(int $shiftId, int $countedCashCents, ?string $notes = null): Shift`
  - `App\Modules\Shifts\Actions\ApproveShiftVarianceAction::execute(int $shiftId, string $managerPin, int $actorUserId, string $resolutionNote): Shift`

- [ ] **Step 1: Write the failing test**

In `tests/Feature/Modules/Shifts/ShiftLifecycleTest.php`:
- `it('prevents duplicate open shifts for the same staff member at a branch and rejects negative opening cash')` (**pins Review Focus #4**): open shift with `20000` cents, assert second `OpenShiftAction` call throws `DomainException`, and assert negative `openingCashCents = -100` throws `InvalidArgumentException`.
- `it('flags shift variance when blind cash count exceeds branch tolerance and closes cleanly when within tolerance')` (**pins Review Focus #5**): branch tolerance `500` cents; open shift with `20000`, record `CashSale` of `5000` (`expected_cash_cents = 25000`). Closing with `24000` (`variance_cents = -1000`) under `Event::fake([ShiftVarianceFlagged::class])` sets `ShiftState::VarianceFlagged` and broadcasts `ShiftVarianceFlagged` `afterCommit`. A separate shift with `expected = 25000` closed with `24700` (`|-300| <= 500`) transitions straight to `ShiftState::Closed`.
- `it('requires a manager PIN to approve and close a variance-flagged shift')`: call `ApproveShiftVarianceAction` with PIN `'1234'` and assert transition to `ShiftState::Closed` + `AuditLog`.

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test --filter=ShiftLifecycleTest`
Expected: FAIL (`ShiftState` / `OpenShiftAction` not found).

- [ ] **Step 3: Implement migrations, enums, models, `ShiftVarianceFlagged`, actions, and `RequireOpenShiftMiddleware`**

Inside `OpenShiftAction` and `CloseShiftAction`, lock the user's open shift row (`lockForUpdate()`) inside `DB::transaction()`. `CloseShiftAction` computes `variance_cents = $countedCashCents - $shift->expected_cash_cents`; if `abs($varianceCents) > $branch->cash_variance_tolerance_cents`, sets `ShiftState::VarianceFlagged` and dispatches `ShiftVarianceFlagged` `afterCommit`.

- [ ] **Step 4: Run test to verify it passes**

Run: `php artisan test --filter=ShiftLifecycleTest`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add database/migrations/2026_11_18_000005* app/Modules/Shifts app/Http/Middleware/RequireOpenShiftMiddleware.php tests/Feature/Modules/Shifts
git commit -m "feat(shifts): implement shift gate, cash drawer ledger, and blind variance flagging"
```

---

### Task 6: *Aurelia Dining Group* Demo Seeder & Persistent React `EvaluatorControlBar`

**Files:**
- Create: `database/seeders/AureliaEnterpriseSeeder.php`
- Modify: `database/seeders/DatabaseSeeder.php`
- Create: `app/Modules/Identity/Actions/SwitchEvaluatorPersonaAction.php`
- Create: `app/Http/Controllers/EvaluatorDemoController.php`
- Modify: `app/Http/Middleware/HandleInertiaRequests.php`
- Modify: `routes/web.php`
- Create: `resources/js/types/evaluator.ts`
- Create: `resources/js/components/evaluator/EvaluatorControlBar.tsx`
- Create: `resources/js/layouts/AppShellLayout.tsx`
- Create: `resources/js/pages/WelcomeDashboard.tsx`
- Test: `tests/Feature/Evaluator/EvaluatorPersonaSwitchTest.php`

**Interfaces:**
- Consumes: `Branch`, `StaffRole`, `PrepStation`, `OpenShiftAction` (Tasks 2–5).
- Produces:
  - `App\Modules\Identity\Actions\SwitchEvaluatorPersonaAction::execute(int $branchId, StaffRole $role): User`
  - Shared Inertia props `evaluator` (`activeUser`, `activeBranch`, `branches`, `roles`, `activeShift`, `simulations: { simulateCardDecline: boolean, triggerLowStockAuto86: boolean }`)
  - Routes: `GET /`, `POST /evaluator/switch-role`, `POST /evaluator/switch-branch`, `POST /evaluator/simulations`

- [ ] **Step 1: Write the failing test**

In `tests/Feature/Evaluator/EvaluatorPersonaSwitchTest.php`:
- `it('auto-authenticates the seeded cashier at Downtown Flagship on root visit with zero setup')`: seed `AureliaEnterpriseSeeder`, `GET /` returns `200`, asserts Inertia props include `branches` (count 3), `activeBranch.code === 'DTF'`, `activeShift.state === 'open'`, and `activeUser.role === 'cashier'`.
- `it('switches authenticated persona across all 8 roles and branches via EvaluatorDemoController')`: `POST /evaluator/switch-role` with `role: 'chef'` authenticates the branch's seeded `Chef` user; `POST /evaluator/switch-branch` with `branch_id: 2` updates active branch in session.
- `it('toggles simulation flags in session without corrupting state')`: `POST /evaluator/simulations` with `simulate_card_decline: true` persists to shared Inertia props.

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test --filter=EvaluatorPersonaSwitchTest`
Expected: FAIL (`AureliaEnterpriseSeeder` / `/evaluator/switch-role` not found).

- [ ] **Step 3: Implement `AureliaEnterpriseSeeder`, `SwitchEvaluatorPersonaAction`, `EvaluatorDemoController`, and React `EvaluatorControlBar` + `AppShellLayout`**

Seed 3 branches (*Downtown Flagship* `DTF`, *Waterfront Patio* `WFP`, *Airport Express* `APX`), all 8 role users per branch (with Manager PIN `'1234'`), rich menu categories across `Grill`, `ColdSalad`, `Pastry`, `Bar` with modifier groups, and an open shift at *Downtown Flagship*. Build `EvaluatorControlBar.tsx` using `shadcn/ui` select/dropdown/switch + `motion.dev` collapsible pill bar with one-click Role Switcher, Branch Switcher, Split-Screen Demo link, and Failure Simulation toggles.

- [ ] **Step 4: Run tests and TypeScript check to verify they pass**

Run: `php artisan test && npm run types`
Expected: PASS (all Unit, Architecture, and Feature tests pass; zero TypeScript errors).

- [ ] **Step 5: Commit**

```bash
git add database/seeders app/Modules/Identity/Actions/SwitchEvaluatorPersonaAction.php app/Http/Controllers/EvaluatorDemoController.php app/Http/Middleware/HandleInertiaRequests.php routes/web.php resources/js tests/Feature/Evaluator
git commit -m "feat(evaluator): add Aurelia Dining Group demo seeders and persistent EvaluatorControlBar"
```
