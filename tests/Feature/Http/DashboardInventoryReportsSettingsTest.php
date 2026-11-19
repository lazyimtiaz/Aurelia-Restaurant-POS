<?php

declare(strict_types=1);

use App\Modules\Identity\Enums\StaffRole;
use App\Modules\Inventory\Enums\StockMovementType;
use App\Modules\Inventory\Models\BranchIngredientStock;
use App\Modules\Inventory\Models\Ingredient;
use App\Modules\Inventory\Models\StockMovement;
use App\Modules\Restaurant\Models\Branch;
use Database\Seeders\AureliaEnterpriseSeeder;
use Inertia\Testing\AssertableInertia as Assert;

it('renders DashboardPage, ReportsPage, InventoryPage, and SettingsPage for authorized roles while enforcing 403 for Chef/Cashier', function (): void {
    $this->seed(AureliaEnterpriseSeeder::class);
    $this->withoutVite();

    // Cashier blocked from dashboard, inventory, reports, settings
    signInAndUnlockAs($this, StaffRole::Cashier, '1111');
    $this->get('/dashboard')->assertForbidden();
    $this->get('/inventory')->assertForbidden();
    $this->get('/reports')->assertForbidden();
    $this->get('/settings')->assertForbidden();

    // Inventory Manager allowed on /inventory and /reports, blocked from /dashboard and /settings
    signInAndUnlockAs($this, StaffRole::InventoryManager, '5555');
    $this->get('/inventory')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Inventory/InventoryPage')
            ->has('inventory.stocks')
        );
    $this->get('/reports')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Reports/ReportsPage')
            ->has('metrics')
            ->has('auditLogs')
        );
    $this->get('/dashboard')->assertForbidden();
    $this->get('/settings')->assertForbidden();

    // Restaurant Owner accesses /dashboard and /settings cleanly
    signInAndUnlockAs($this, StaffRole::RestaurantOwner, '1234');
    $this->get('/dashboard')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Dashboard/DashboardPage')
            ->has('overview.metrics')
            ->has('overview.tableStatusCounts')
        );

    $this->get('/settings')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Settings/SettingsPage')
            ->has('branchSettings')
        );
});

it('receives supplier stock, logs manual wastage, filters audit logs, and updates branch settings over HTTP', function (): void {
    $this->seed(AureliaEnterpriseSeeder::class);
    $this->withoutVite();

    signInAndUnlockAs($this, StaffRole::BranchManager, '1234');

    $branch = Branch::query()->where('code', 'DTF')->firstOrFail();
    $wagyu = Ingredient::query()->where('code', 'ING-WAGYU')->firstOrFail();

    $initialStock = BranchIngredientStock::query()
        ->where('branch_id', $branch->id)
        ->where('ingredient_id', $wagyu->id)
        ->firstOrFail()
        ->quantity_on_hand;

    $this->post('/inventory/receive', [
        'ingredient_id' => $wagyu->id,
        'quantity' => 1500,
        'unit_cost_cents' => 3,
        'supplier_ref' => 'PO-HTTP-900',
    ])->assertRedirect();

    $this->post('/inventory/wastage', [
        'ingredient_id' => $wagyu->id,
        'quantity' => 400,
        'reason' => 'Trimmed fat cap spoilage',
    ])->assertRedirect();

    $afterWastage = BranchIngredientStock::query()
        ->where('branch_id', $branch->id)
        ->where('ingredient_id', $wagyu->id)
        ->firstOrFail()
        ->quantity_on_hand;

    expect($afterWastage)->toBe($initialStock + 1100)
        ->and(StockMovement::query()
            ->where('branch_id', $branch->id)
            ->where('ingredient_id', $wagyu->id)
            ->where('movement_type', StockMovementType::Wastage->value)
            ->exists())->toBeTrue();

    $this->getJson('/audit-logs?event_type=inventory_wastage_recorded')
        ->assertOk()
        ->assertJsonFragment(['event_type' => 'inventory_wastage_recorded']);

    $this->put('/settings/branch', [
        'name' => 'Downtown Flagship Updated',
        'timezone' => 'America/New_York',
        'tax_rate_bps' => 850,
        'service_charge_bps' => 600,
        'discount_pin_threshold_bps' => 1500,
        'cash_variance_tolerance_cents' => 500,
    ])->assertRedirect();

    expect($branch->refresh()->tax_rate_bps)->toBe(850);
});
