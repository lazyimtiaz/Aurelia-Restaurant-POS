# Phase 4: Recipe Inventory COGS, Executive Analytics & Audit Trail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the enterprise operational loop with recipe-driven branch inventory management, asynchronous Horizon COGS deduction & auto-86 depletion broadcasts, cross-branch Owner/Manager analytics, immutable audit trail inspection, and a GitHub Actions CI pipeline validating both SQLite and MySQL 8.4.

**Architecture:** Adds `app/Modules/Inventory` (ingredients, recipes, supplier receipts, wastage, and idempotent `DeductOrderInventoryJob` on Horizon's `inventory` queue) and `app/Modules/Reporting` (aggregate SQL queries compatible with both MySQL 8.4+ and SQLite returning `readonly` dashboard DTOs), surfaced in the `ExecutiveWorkspace` React dashboard alongside the `AuditTrailTable`.

**Tech Stack:** Laravel 12/13, PHP 8.3+, Inertia.js 2, React 19, TypeScript, Tailwind CSS, `shadcn/ui`, `motion.dev`, MySQL 8.4+ / SQLite (WAL), Redis + Laravel Horizon, Laravel Reverb + Echo, Pest PHP, GitHub Actions.

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

1. **Idempotent Horizon recipe deduction:** Executing `DeductOrderInventoryJob` twice for the same `kitchen_ticket_id` (or `voided_order_item_id`) must deduct branch ingredient stock exactly once via a unique idempotency constraint on `(branch_id, reference_type, reference_id, ingredient_id)` in `stock_movements` (pinned in Task 2).
2. **Auto-86 threshold trigger on stock depletion:** When `DeductOrderInventoryJob` drops a branch ingredient's `quantity_on_hand` to or below `auto_86_threshold`, every `MenuItemVariant` whose recipe requires that ingredient must automatically update `BranchMenuOverride.is_available = false` at that branch and broadcast `ItemAvailabilityChanged` `afterCommit` (pinned in Task 2).
3. **Post-prep void wastage vs. pre-prep void stock preservation:** Voiding an `ItemPrepState::Queued` item (prep not started) must NOT dispatch wastage stock deduction, whereas voiding an `InPrep` or `Ready` item must dispatch `DeductOrderInventoryJob` with `StockMovementType::Wastage` and snapshot `unit_cost_cents` (pinned in Task 2).
4. **Cross-branch P&L and COGS aggregation accuracy:** `GetExecutiveDashboardMetricsQuery` must compute net revenue, theoretical COGS %, average order value (AOV), void leakage cents, and cash drawer variance per branch without cross-branch contamination or N+1 query explosions (pinned in Task 3).
5. **SQLite & MySQL 8.4 parity in CI:** Every migration, `lockForUpdate()` call, date/hour grouping query, and Pest test suite must pass on both SQLite and a MySQL 8.4 service container in GitHub Actions (pinned in Task 5).

---

## File Structure

- `database/migrations/2026_11_18_000010_create_inventory_and_recipes_tables.php` — `ingredients`, `branch_ingredient_stocks`, `recipe_items`, `stock_movements` (unique idempotency index).
- `app/Modules/Inventory/` — `StockMovementType` & `MeasurementUnit` enums, `Ingredient`, `BranchIngredientStock`, `RecipeItem`, `StockMovement` models, `ReceiveSupplierStockAction`, `RecordManualWastageAction`, `DeductRecipeIngredientsAction`, `DeductOrderInventoryJob` (Horizon `inventory` queue).
- `app/Modules/Reporting/` — `ExecutiveDashboardData`, `BranchComparisonRowData`, `HourlySalesPointData` DTOs and `GetExecutiveDashboardMetricsQuery`.
- `app/Http/Controllers/{ExecutiveDashboardController,InventoryController,AuditLogController}.php` — Thin controllers for executive KPIs, supplier stock-in/wastage, and audit log filtering.
- `resources/js/pages/Executive/ExecutiveWorkspace.tsx` & `resources/js/modules/executive/{BranchComparisonCards.tsx,RevenueAndPeakHoursChart.tsx,InventoryStockDrawer.tsx,AuditTrailTable.tsx}` — Owner/Manager/Inventory/Admin dashboard UI.
- `.github/workflows/ci.yml` & `config/horizon.php` — Dual-DB CI matrix (SQLite + MySQL 8.4), Horizon queue configuration, and README documentation.

---

### Task 1: Inventory Module (Ingredients, Recipes, Supplier Stock-In & Manual Wastage)

**Files:**
- Create: `database/migrations/2026_11_18_000010_create_inventory_and_recipes_tables.php`
- Create: `app/Modules/Inventory/Enums/{StockMovementType,MeasurementUnit}.php`
- Create: `app/Modules/Inventory/Models/{Ingredient,BranchIngredientStock,RecipeItem,StockMovement}.php`
- Create: `app/Modules/Inventory/Actions/{ReceiveSupplierStockAction,RecordManualWastageAction}.php`
- Modify: `database/seeders/AureliaEnterpriseSeeder.php` (seed ingredients, recipes per menu variant, and branch stock levels)
- Test: `tests/Feature/Modules/Inventory/StockAndRecipeTest.php`

**Interfaces:**
- Consumes: `Branch` (Phase 1 Task 2), `MenuItemVariant` & `ToggleBranchItemAvailabilityAction` (Phase 1 Task 4), `RecordAuditLogAction` (Phase 1 Task 3).
- Produces:
  - `App\Modules\Inventory\Enums\StockMovementType`: `'supplier_receipt'`, `'order_sale'`, `'wastage'`, `'restock'`, `'manual_adjustment'`
  - `App\Modules\Inventory\Enums\MeasurementUnit`: `'grams'`, `'milliliters'`, `'units'`
  - `App\Modules\Inventory\Actions\ReceiveSupplierStockAction::execute(int $branchId, int $ingredientId, int $quantity, int $unitCostCents, string $supplierRef, int $actorUserId): BranchIngredientStock`
  - `App\Modules\Inventory\Actions\RecordManualWastageAction::execute(int $branchId, int $ingredientId, int $quantity, string $reason, int $actorUserId): BranchIngredientStock`

- [ ] **Step 1: Write the failing test**

In `tests/Feature/Modules/Inventory/StockAndRecipeTest.php`:
- `it('receives supplier stock, increments branch quantity_on_hand, and re-enables 86d variants when above threshold')`: start with stock `0` below `auto_86_threshold = 500`, variant `is_available = false`; execute `ReceiveSupplierStockAction` adding `2000` units; assert `quantity_on_hand === 2000`, `StockMovement` created with `StockMovementType::SupplierReceipt`, and dependent variant auto-restored to `is_available = true`.
- `it('records manual wastage inside lockForUpdate, logs audit, and rejects negative stock quantities')`: assert `RecordManualWastageAction` decrements `quantity_on_hand`, snapshots `unit_cost_cents`, writes `AuditLog`, and throws `DomainException` if `quantity <= 0`.

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test --filter=StockAndRecipeTest`
Expected: FAIL (`Ingredient` / `ReceiveSupplierStockAction` not found).

- [ ] **Step 3: Implement migration, enums, models, actions, and demo recipe seeding**

Store ingredient quantities in integer base units (`quantity_on_hand`, `auto_86_threshold`, `quantity_required`) and costs in `unit_cost_cents` (`BIGINT` / `INTEGER`). Add a unique composite index on `stock_movements(branch_id, reference_type, reference_id, ingredient_id)` so idempotent Horizon deductions are enforced at the database layer across both MySQL 8.4 and SQLite.

- [ ] **Step 4: Run test to verify it passes**

Run: `php artisan test --filter=StockAndRecipeTest`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add database/migrations/2026_11_18_000010* database/seeders/AureliaEnterpriseSeeder.php app/Modules/Inventory tests/Feature/Modules/Inventory/StockAndRecipeTest.php
git commit -m "feat(inventory): add ingredients, recipes, supplier receipts, and manual wastage"
```

---

### Task 2: Horizon Asynchronous Recipe Deduction (`DeductOrderInventoryJob`) & Auto-86 Depletion Broadcast

**Files:**
- Create: `app/Modules/Inventory/Actions/DeductRecipeIngredientsAction.php`
- Create: `app/Modules/Inventory/Jobs/DeductOrderInventoryJob.php`
- Modify: `app/Modules/Kitchen/Actions/ServeKitchenTicketExpoAction.php` (dispatch `DeductOrderInventoryJob` on ticket completion)
- Modify: `app/Modules/Orders/Actions/VoidOrderItemAction.php` (dispatch `DeductOrderInventoryJob` with `StockMovementType::Wastage` only when `was_in_prep_at_void` is true)
- Modify: `app/Modules/Billing/Actions/RefundPaymentAction.php` (dispatch `DeductOrderInventoryJob` restock/wastage hook if requested)
- Test: `tests/Feature/Modules/Inventory/DeductOrderInventoryJobTest.php`

**Interfaces:**
- Consumes: `KitchenTicket`, `OrderItem`, `VoidOrderItemAction`, `ServeKitchenTicketExpoAction` (Phase 2), `RefundPaymentAction` (Phase 3), `ToggleBranchItemAvailabilityAction` (Phase 1 Task 4).
- Produces:
  - `App\Modules\Inventory\Actions\DeductRecipeIngredientsAction::execute(int $branchId, string $referenceType, int $referenceId, array $variantQuantities, StockMovementType $movementType, int $actorUserId): void`
  - `App\Modules\Inventory\Jobs\DeductOrderInventoryJob` (`implements ShouldQueue, ShouldDispatchAfterCommit`, `$queue = 'inventory'`)

- [ ] **Step 1: Write the failing test**

In `tests/Feature/Modules/Inventory/DeductOrderInventoryJobTest.php`:
- `it('deducts recipe ingredients via Horizon job idempotently without double-deducting on retry')` (**pins Review Focus #1**): recipe needs `200g` beef (`unit_cost_cents: 4`) per burger; branch has `1000g`. Serve a ticket with 2 burgers (`400g` total) and execute `DeductOrderInventoryJob::handle()` twice; assert `quantity_on_hand === 600` (not `200`), `stock_movements` count for that ticket is `1`, and `total_cost_cents === 1600`.
- `it('auto-86s dependent menu variants and broadcasts ItemAvailabilityChanged when stock hits auto_86_threshold')` (**pins Review Focus #2**): branch beef stock is `450g`, `auto_86_threshold = 250g`; serve 1 burger (`200g` deducted -> `250g <= 250g`) under `Event::fake([ItemAvailabilityChanged::class])`; assert dependent burger variants become `is_available = false` at that branch and `ItemAvailabilityChanged` fires `afterCommit`.
- `it('skips inventory deduction for pre-prep Queued voids and deducts Wastage for InPrep/Ready voids')` (**pins Review Focus #3**): voiding a `Queued` item must NOT dispatch `DeductOrderInventoryJob`; voiding an `InPrep` item dispatches `DeductOrderInventoryJob` with `StockMovementType::Wastage`.

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test --filter=DeductOrderInventoryJobTest`
Expected: FAIL (`DeductOrderInventoryJob` not found).

- [ ] **Step 3: Implement `DeductRecipeIngredientsAction`, `DeductOrderInventoryJob`, and queue dispatch hooks**

`DeductRecipeIngredientsAction` runs inside `DB::transaction()`, sorts ingredient IDs deterministically before calling `lockForUpdate()` on `branch_ingredient_stocks`, checks for existing `stock_movements` matching `(branch_id, reference_type, reference_id, ingredient_id)` to guarantee idempotency across retries, inserts `StockMovement` with snapshotted `unit_cost_cents`, decrements `quantity_on_hand` (clamping floor or recording deficit cleanly), and calls `ToggleBranchItemAvailabilityAction` for any variant whose recipe ingredient hits `<= auto_86_threshold`. Also honor the Evaluator Bar's `trigger_low_stock_auto_86` simulation flag by dropping the ordered dish's primary ingredient to threshold during demo runs when toggled.

- [ ] **Step 4: Run test to verify it passes**

Run: `php artisan test --filter=DeductOrderInventoryJobTest`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/Modules/Inventory app/Modules/Kitchen/Actions/ServeKitchenTicketExpoAction.php app/Modules/Orders/Actions/VoidOrderItemAction.php app/Modules/Billing/Actions/RefundPaymentAction.php tests/Feature/Modules/Inventory/DeductOrderInventoryJobTest.php
git commit -m "feat(inventory): add idempotent Horizon COGS deduction job and auto-86 triggers"
```

---

### Task 3: Reporting Module (Cross-Branch Revenue, COGS %, Peak Hours, AOV, Voids & Cash Variance Queries)

**Files:**
- Create: `app/Modules/Reporting/DTOs/{ExecutiveDashboardData,BranchComparisonRowData,HourlySalesPointData}.php`
- Create: `app/Modules/Reporting/Queries/GetExecutiveDashboardMetricsQuery.php`
- Test: `tests/Feature/Modules/Reporting/ExecutiveDashboardMetricsTest.php`

**Interfaces:**
- Consumes: `Branch` (Phase 1 Task 2), `Shift` (Phase 1 Task 5), `Order` & `OrderItem` (Phase 2), `PaymentTransaction` (Phase 3), `StockMovement` (Task 1).
- Produces:
  - `App\Modules\Reporting\DTOs\ExecutiveDashboardData` (`int $totalRevenueCents`, `int $totalOrdersCount`, `int $averageOrderValueCents`, `int $totalCogsCents`, `int $cogsPercentBps`, `int $totalVoidsCents`, `int $netCashVarianceCents`, `array $branchComparisons`, `array $hourlySales`, `array $topProducts`)
  - `App\Modules\Reporting\Queries\GetExecutiveDashboardMetricsQuery::execute(?int $branchId = null, ?string $dateFrom = null, ?string $dateTo = null): ExecutiveDashboardData`

- [ ] **Step 1: Write the failing test**

In `tests/Feature/Modules/Reporting/ExecutiveDashboardMetricsTest.php`:
- `it('computes accurate cross-branch revenue, AOV, COGS %, voids, and cash variance without branch contamination')` (**pins Review Focus #4**): seed Branch 1 with 2 paid orders (`total_cents`: `10000`, `20000`), 1 voided item (`1500`), COGS `9000` (`30%` = `3000` bps), and a closed shift with variance `-400`; seed Branch 2 with 1 paid order (`5000`); query filtered for Branch 1 -> assert `totalRevenueCents === 30000`, `averageOrderValueCents === 15000`, `cogsPercentBps === 3000`, `totalVoidsCents === 1500`, `netCashVarianceCents === -400`; query unfiltered (`branchId: null`) -> assert `totalRevenueCents === 35000` and `branchComparisons` has all active branches.
- `it('executes cleanly on both SQLite and MySQL-compatible SQL without raw PG functions')`: verify `hourlySales` groups cleanly by hour (`0..23`) using database-portable hour extraction or PHP aggregation over filtered rows.

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test --filter=ExecutiveDashboardMetricsTest`
Expected: FAIL (`GetExecutiveDashboardMetricsQuery` not found).

- [ ] **Step 3: Implement Reporting DTOs and `GetExecutiveDashboardMetricsQuery`**

Ensure zero `float` math (compute `cogsPercentBps` and `averageOrderValueCents` with `intdiv`) and avoid PostgreSQL-specific functions (`EXTRACT` / `DATE_TRUNC`). Aggregate hourly points in PHP from indexed `created_at` + `total_cents` columns or portable SQL, keeping query count constant (`<= 6` queries total).

- [ ] **Step 4: Run test to verify it passes**

Run: `php artisan test --filter=ExecutiveDashboardMetricsTest`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/Modules/Reporting tests/Feature/Modules/Reporting
git commit -m "feat(reporting): add cross-branch revenue, COGS %, peak hours, and variance queries"
```

---

### Task 4: React `ExecutiveWorkspace` (Owner/Manager Analytics, Inventory Ledger & Immutable Audit Log Inspector)

**Files:**
- Create: `app/Http/Controllers/{ExecutiveDashboardController,InventoryController,AuditLogController}.php`
- Modify: `routes/web.php`
- Create: `resources/js/types/executive.ts`
- Create: `resources/js/pages/Executive/ExecutiveWorkspace.tsx`
- Create: `resources/js/modules/executive/{BranchComparisonCards.tsx,RevenueAndPeakHoursChart.tsx,InventoryStockDrawer.tsx,AuditTrailTable.tsx}`
- Modify: `resources/js/components/evaluator/EvaluatorControlBar.tsx` (add link/auto-navigation for Owner/Manager/Inventory/Admin roles)
- Test: `tests/Feature/Http/ExecutiveWorkspaceInertiaTest.php`

**Interfaces:**
- Consumes: `GetExecutiveDashboardMetricsQuery` (Task 3), `ReceiveSupplierStockAction`, `RecordManualWastageAction` (Task 1), `AuditLog` (Phase 1 Task 3).
- Produces:
  - Endpoints: `GET /executive`, `POST /inventory/receive`, `POST /inventory/wastage`, `GET /audit-logs`.

- [ ] **Step 1: Write the failing test**

In `tests/Feature/Http/ExecutiveWorkspaceInertiaTest.php`:
- `it('renders ExecutiveWorkspace with branch comparison metrics, inventory stock, and audit logs for Owner/Manager/Admin/InventoryManager roles')`: assert `200` and Inertia component `'Executive/ExecutiveWorkspace'`.
- `it('denies access to ExecutiveWorkspace for Chef or Cashier roles via policy/middleware')`: switch persona to `Cashier` / `Chef` and assert `403`.
- `it('receives supplier stock and logs manual wastage via InventoryController')`: POST `/inventory/receive` and `/inventory/wastage` and verify database updates.

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test --filter=ExecutiveWorkspaceInertiaTest`
Expected: FAIL (`ExecutiveDashboardController` / routes not defined).

- [ ] **Step 3: Implement controllers, routes, and React `ExecutiveWorkspace` components**

Build `ExecutiveWorkspace.tsx` with `shadcn/ui` Tabs (`Overview & P&L`, `Branch Comparison`, `Inventory & Recipes`, `Audit Trail`), responsive SVG/Tailwind peak-hours & branch comparison charts animated with `motion.dev`, KPI summary cards (Revenue, AOV, Food Cost %, Voids & Cash Variance), `InventoryStockDrawer` for receiving supplier stock and logging wastage (highlighting auto-86'd items live via `useBranchEcho` on `.manager`), and `AuditTrailTable` filtering PIN overrides, refunds, voids, and shift variances.

- [ ] **Step 4: Run tests and TypeScript check to verify they pass**

Run: `php artisan test --filter=ExecutiveWorkspaceInertiaTest && npm run types`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/Http/Controllers/ExecutiveDashboardController.php app/Http/Controllers/InventoryController.php app/Http/Controllers/AuditLogController.php routes/web.php resources/js tests/Feature/Http/ExecutiveWorkspaceInertiaTest.php
git commit -m "feat(executive,ui): build Owner/Manager dashboard, inventory ledger, and audit inspector"
```

---

### Task 5: GitHub Actions Dual-Database CI Pipeline (SQLite + MySQL 8.4, Redis, Pest & TypeScript Check)

**Files:**
- Modify: `config/horizon.php` (configure `inventory`, `analytics`, `notifications` supervisors)
- Create: `.github/workflows/ci.yml`
- Create: `README.md` (evaluator quick-start, dual-DB instructions, Reverb + Horizon dev commands, architecture overview)

**Interfaces:**
- Consumes: Complete test suite across Phases 1–4.
- Produces: Reproducible CI pipeline testing Pest (Unit, Feature, Architecture, Concurrency) against both **SQLite** and **MySQL 8.4**, plus `tsc --noEmit` and Vite production build verification.

- [ ] **Step 1: Write `.github/workflows/ci.yml` and configure `config/horizon.php`**

Configure GitHub Actions workflow with two jobs/matrix legs (**pins Review Focus #5**):
- `backend-tests` matrix: `db: [sqlite, mysql]` — `mysql:8.4` service container on port `3306` + `redis:7` service container; PHP 8.3/8.4 setup; run `php artisan migrate:fresh --force && php artisan test`.
- `frontend-checks`: Node 22, `npm ci`, `npm run types` (`tsc --noEmit`), `npm run build`.
Ensure `config/horizon.php` defines supervisors listening on `['inventory', 'analytics', 'notifications', 'default']`.

- [ ] **Step 2: Run full local verification suite (SQLite + TypeScript + Vite build)**

Run: `php artisan test && npm run types && npm run build`
Expected: PASS across all Pest suites (Unit, Architecture, Feature), zero TypeScript errors, clean Vite production bundle.

- [ ] **Step 3: Document evaluator setup & architecture in `README.md`**

Include single-command local startup (`composer run dev` / `php artisan reverb:start`, `php artisan horizon`, `php artisan serve`, `npm run dev`), demo Manager PIN (`1234`), Split-Screen URL (`/demo/split-screen`), and domain architecture diagram.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml config/horizon.php README.md
git commit -m "ci: add GitHub Actions SQLite and MySQL 8.4 Pest + TypeScript pipeline and README"
```
