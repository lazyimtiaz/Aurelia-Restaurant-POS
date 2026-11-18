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

it('renders ExecutiveWorkspace with branch comparison metrics, inventory stock, and audit logs for Owner/Manager/Admin/InventoryManager roles', function (): void {
    $this->seed(AureliaEnterpriseSeeder::class);
    $this->withoutVite();

    $allowedRoles = [
        StaffRole::RestaurantOwner,
        StaffRole::BranchManager,
        StaffRole::EnterpriseSystemAdmin,
        StaffRole::InventoryManager,
    ];

    foreach ($allowedRoles as $role) {
        $this->post('/evaluator/switch-role', ['role' => $role->value])->assertRedirect();

        $this->get('/executive')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Executive/ExecutiveWorkspace')
                ->has('metrics.branchComparisons', 3)
                ->has('metrics.hourlySales', 24)
                ->has('inventory.stocks')
                ->has('auditLogs')
            );
    }
});

it('denies access to ExecutiveWorkspace for Chef or Cashier roles via role check', function (): void {
    $this->seed(AureliaEnterpriseSeeder::class);
    $this->withoutVite();

    foreach ([StaffRole::Cashier, StaffRole::Chef] as $blockedRole) {
        $this->post('/evaluator/switch-role', ['role' => $blockedRole->value])->assertRedirect();

        $this->get('/executive')->assertForbidden();
    }
});

it('receives supplier stock, logs manual wastage, and filters audit logs over HTTP', function (): void {
    $this->seed(AureliaEnterpriseSeeder::class);
    $this->withoutVite();

    $this->post('/evaluator/switch-role', ['role' => StaffRole::InventoryManager->value])->assertRedirect();

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

    $afterReceive = BranchIngredientStock::query()
        ->where('branch_id', $branch->id)
        ->where('ingredient_id', $wagyu->id)
        ->firstOrFail()
        ->quantity_on_hand;

    expect($afterReceive)->toBe($initialStock + 1500);

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
});
