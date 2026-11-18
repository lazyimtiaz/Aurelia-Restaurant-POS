<?php

declare(strict_types=1);

use App\Models\User;
use App\Modules\Audit\Models\AuditLog;
use App\Modules\Identity\Enums\StaffRole;
use App\Modules\Inventory\Actions\ReceiveSupplierStockAction;
use App\Modules\Inventory\Actions\RecordManualWastageAction;
use App\Modules\Inventory\Enums\MeasurementUnit;
use App\Modules\Inventory\Enums\StockMovementType;
use App\Modules\Inventory\Models\BranchIngredientStock;
use App\Modules\Inventory\Models\Ingredient;
use App\Modules\Inventory\Models\RecipeItem;
use App\Modules\Inventory\Models\StockMovement;
use App\Modules\Menu\Enums\PrepStation;
use App\Modules\Menu\Events\ItemAvailabilityChanged;
use App\Modules\Menu\Models\BranchMenuOverride;
use App\Modules\Menu\Models\MenuCategory;
use App\Modules\Menu\Models\MenuItem;
use App\Modules\Menu\Models\MenuItemVariant;
use App\Modules\Restaurant\Models\Branch;
use Illuminate\Support\Facades\Event;

it('receives supplier stock, increments branch quantity_on_hand, and re-enables 86d variants when above threshold', function (): void {
    Event::fake([ItemAvailabilityChanged::class]);

    $branch = Branch::create(['code' => 'DTF', 'name' => 'Downtown Flagship']);
    $manager = User::factory()->create(['branch_id' => $branch->id, 'role' => StaffRole::InventoryManager]);

    $category = MenuCategory::create(['name' => 'Woodfire', 'slug' => 'woodfire', 'sort_order' => 1]);
    $item = MenuItem::create([
        'menu_category_id' => $category->id,
        'name' => 'Wagyu Burger',
        'slug' => 'wagyu-burger',
        'prep_station' => PrepStation::Grill,
    ]);
    $variant = MenuItemVariant::create([
        'menu_item_id' => $item->id,
        'name' => 'Single',
        'sku' => 'WAG-1',
        'base_price_cents' => 1900,
    ]);

    BranchMenuOverride::create([
        'branch_id' => $branch->id,
        'menu_item_variant_id' => $variant->id,
        'is_available' => false,
        'eighty_sixed_reason' => 'Out of Wagyu patties',
    ]);

    $beef = Ingredient::create([
        'code' => 'ING-WAGYU',
        'name' => 'Wagyu Beef',
        'unit' => MeasurementUnit::Grams,
        'default_unit_cost_cents' => 4,
    ]);

    RecipeItem::create([
        'menu_item_variant_id' => $variant->id,
        'ingredient_id' => $beef->id,
        'quantity_required' => 180,
    ]);

    BranchIngredientStock::create([
        'branch_id' => $branch->id,
        'ingredient_id' => $beef->id,
        'quantity_on_hand' => 0,
        'auto_86_threshold' => 500,
        'unit_cost_cents' => 4,
    ]);

    $updatedStock = app(ReceiveSupplierStockAction::class)->execute(
        branchId: $branch->id,
        ingredientId: $beef->id,
        quantity: 2000,
        unitCostCents: 4,
        supplierRef: 'PO-2026-001',
        actorUserId: $manager->id,
    );

    expect($updatedStock->quantity_on_hand)->toBe(2000)
        ->and(StockMovement::query()
            ->where('branch_id', $branch->id)
            ->where('ingredient_id', $beef->id)
            ->where('movement_type', StockMovementType::SupplierReceipt->value)
            ->exists())->toBeTrue()
        ->and(BranchMenuOverride::query()
            ->where('branch_id', $branch->id)
            ->where('menu_item_variant_id', $variant->id)
            ->firstOrFail()
            ->is_available)->toBeTrue();

    Event::assertDispatched(ItemAvailabilityChanged::class, function (ItemAvailabilityChanged $event) use ($branch, $variant): bool {
        return $event->branchId === $branch->id
            && $event->variantId === $variant->id
            && $event->isAvailable === true;
    });
});

it('records manual wastage inside lockForUpdate, logs audit, and rejects non-positive wastage quantities', function (): void {
    $branch = Branch::create(['code' => 'DTF', 'name' => 'Downtown Flagship']);
    $manager = User::factory()->create(['branch_id' => $branch->id, 'role' => StaffRole::InventoryManager]);

    $ribeye = Ingredient::create([
        'code' => 'ING-RIBEYE',
        'name' => 'Prime Ribeye',
        'unit' => MeasurementUnit::Grams,
        'default_unit_cost_cents' => 7,
    ]);

    BranchIngredientStock::create([
        'branch_id' => $branch->id,
        'ingredient_id' => $ribeye->id,
        'quantity_on_hand' => 3000,
        'auto_86_threshold' => 300,
        'unit_cost_cents' => 7,
    ]);

    expect(fn () => app(RecordManualWastageAction::class)->execute(
        branchId: $branch->id,
        ingredientId: $ribeye->id,
        quantity: 0,
        reason: 'Invalid',
        actorUserId: $manager->id,
    ))->toThrow(InvalidArgumentException::class);

    $updatedStock = app(RecordManualWastageAction::class)->execute(
        branchId: $branch->id,
        ingredientId: $ribeye->id,
        quantity: 600,
        reason: 'Walk-in cooler temperature spike',
        actorUserId: $manager->id,
    );

    $movement = StockMovement::query()
        ->where('branch_id', $branch->id)
        ->where('ingredient_id', $ribeye->id)
        ->where('movement_type', StockMovementType::Wastage->value)
        ->firstOrFail();

    expect($updatedStock->quantity_on_hand)->toBe(2400)
        ->and($movement->quantity_delta)->toBe(-600)
        ->and($movement->unit_cost_cents)->toBe(7)
        ->and($movement->total_cost_cents)->toBe(4200)
        ->and(AuditLog::query()
            ->where('branch_id', $branch->id)
            ->where('event_type', 'inventory_wastage_recorded')
            ->exists())->toBeTrue();
});
