<?php

declare(strict_types=1);

use App\Models\User;
use App\Modules\Identity\Enums\StaffRole;
use App\Modules\Inventory\Enums\MeasurementUnit;
use App\Modules\Inventory\Enums\StockMovementType;
use App\Modules\Inventory\Jobs\DeductOrderInventoryJob;
use App\Modules\Inventory\Models\BranchIngredientStock;
use App\Modules\Inventory\Models\Ingredient;
use App\Modules\Inventory\Models\RecipeItem;
use App\Modules\Inventory\Models\StockMovement;
use App\Modules\Kitchen\Actions\BumpKitchenItemStatusAction;
use App\Modules\Kitchen\Actions\ServeKitchenTicketExpoAction;
use App\Modules\Kitchen\Enums\ItemPrepState;
use App\Modules\Kitchen\Enums\VoidReason;
use App\Modules\Menu\Enums\PrepStation;
use App\Modules\Menu\Events\ItemAvailabilityChanged;
use App\Modules\Menu\Models\BranchMenuOverride;
use App\Modules\Menu\Models\MenuCategory;
use App\Modules\Menu\Models\MenuItem;
use App\Modules\Menu\Models\MenuItemVariant;
use App\Modules\Orders\Actions\AddDraftOrderItemAction;
use App\Modules\Orders\Actions\FireOrderRoundAction;
use App\Modules\Orders\Actions\OpenOrderTabAction;
use App\Modules\Orders\Actions\VoidOrderItemAction;
use App\Modules\Orders\DTOs\OrderItemInputData;
use App\Modules\Orders\Enums\ServiceType;
use App\Modules\Restaurant\Models\Branch;
use App\Modules\Shifts\Actions\OpenShiftAction;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Queue;

it('deducts recipe ingredients via Horizon job idempotently without double-deducting on retry', function (): void {
    $branch = Branch::create(['code' => 'DTF', 'name' => 'Downtown Flagship']);
    $waiter = User::factory()->create(['branch_id' => $branch->id, 'role' => StaffRole::Waiter]);
    $chef = User::factory()->create(['branch_id' => $branch->id, 'role' => StaffRole::Chef]);
    $expo = User::factory()->create(['branch_id' => $branch->id, 'role' => StaffRole::KitchenExpediter]);
    $shift = app(OpenShiftAction::class)->execute($branch->id, $waiter->id, 20000);

    $category = MenuCategory::create(['name' => 'Grill', 'slug' => 'grill', 'sort_order' => 1]);
    $item = MenuItem::create([
        'menu_category_id' => $category->id,
        'name' => 'Wagyu Burger',
        'slug' => 'wagyu-burger',
        'prep_station' => PrepStation::Grill,
    ]);
    $variant = MenuItemVariant::create([
        'menu_item_id' => $item->id,
        'name' => 'Standard',
        'sku' => 'WAG-STD',
        'base_price_cents' => 2400,
    ]);

    $beef = Ingredient::create([
        'code' => 'ING-BEEF',
        'name' => 'Dry-Aged Beef',
        'unit' => MeasurementUnit::Grams,
        'default_unit_cost_cents' => 4,
    ]);

    RecipeItem::create([
        'menu_item_variant_id' => $variant->id,
        'ingredient_id' => $beef->id,
        'quantity_required' => 200,
    ]);

    BranchIngredientStock::create([
        'branch_id' => $branch->id,
        'ingredient_id' => $beef->id,
        'quantity_on_hand' => 1000,
        'auto_86_threshold' => 150,
        'unit_cost_cents' => 4,
    ]);

    $order = app(OpenOrderTabAction::class)->execute($branch->id, $shift->id, $waiter->id, ServiceType::Takeaway);
    $orderItem = app(AddDraftOrderItemAction::class)->execute($order->id, new OrderItemInputData($variant->id, 2));
    $ticket = app(FireOrderRoundAction::class)->execute($order->id, $waiter->id);

    app(BumpKitchenItemStatusAction::class)->execute($orderItem->id, ItemPrepState::InPrep, $chef->id);
    app(BumpKitchenItemStatusAction::class)->execute($orderItem->id, ItemPrepState::Ready, $chef->id);
    app(ServeKitchenTicketExpoAction::class)->execute($ticket->id, $expo->id);

    // Simulate Horizon retry / duplicate worker delivery for the same kitchen ticket
    $duplicateJob = new DeductOrderInventoryJob(
        branchId: $branch->id,
        referenceType: 'kitchen_ticket',
        referenceId: $ticket->id,
        variantQuantities: [$variant->id => 2],
        movementType: StockMovementType::OrderSale,
        actorUserId: $expo->id,
    );
    app()->call([$duplicateJob, 'handle']);

    $stock = BranchIngredientStock::query()
        ->where('branch_id', $branch->id)
        ->where('ingredient_id', $beef->id)
        ->firstOrFail();

    $movements = StockMovement::query()
        ->where('branch_id', $branch->id)
        ->where('reference_type', 'kitchen_ticket')
        ->where('reference_id', (string) $ticket->id)
        ->get();

    expect($stock->quantity_on_hand)->toBe(600)
        ->and($movements)->toHaveCount(1)
        ->and($movements->first()->quantity_delta)->toBe(-400)
        ->and($movements->first()->total_cost_cents)->toBe(1600);
});

it('auto-86s dependent menu variants and broadcasts ItemAvailabilityChanged when stock hits auto_86_threshold', function (): void {
    Event::fake([ItemAvailabilityChanged::class]);

    $branch = Branch::create(['code' => 'DTF', 'name' => 'Downtown Flagship']);
    $waiter = User::factory()->create(['branch_id' => $branch->id, 'role' => StaffRole::Waiter]);
    $chef = User::factory()->create(['branch_id' => $branch->id, 'role' => StaffRole::Chef]);
    $expo = User::factory()->create(['branch_id' => $branch->id, 'role' => StaffRole::KitchenExpediter]);
    $shift = app(OpenShiftAction::class)->execute($branch->id, $waiter->id, 20000);

    $category = MenuCategory::create(['name' => 'Grill', 'slug' => 'grill', 'sort_order' => 1]);
    $item = MenuItem::create([
        'menu_category_id' => $category->id,
        'name' => 'Wagyu Burger',
        'slug' => 'wagyu-burger',
        'prep_station' => PrepStation::Grill,
    ]);
    $variant = MenuItemVariant::create([
        'menu_item_id' => $item->id,
        'name' => 'Standard',
        'sku' => 'WAG-STD',
        'base_price_cents' => 2400,
    ]);

    $beef = Ingredient::create([
        'code' => 'ING-BEEF',
        'name' => 'Dry-Aged Beef',
        'unit' => MeasurementUnit::Grams,
        'default_unit_cost_cents' => 4,
    ]);

    RecipeItem::create([
        'menu_item_variant_id' => $variant->id,
        'ingredient_id' => $beef->id,
        'quantity_required' => 200,
    ]);

    BranchIngredientStock::create([
        'branch_id' => $branch->id,
        'ingredient_id' => $beef->id,
        'quantity_on_hand' => 450,
        'auto_86_threshold' => 250,
        'unit_cost_cents' => 4,
    ]);

    $order = app(OpenOrderTabAction::class)->execute($branch->id, $shift->id, $waiter->id, ServiceType::Takeaway);
    $orderItem = app(AddDraftOrderItemAction::class)->execute($order->id, new OrderItemInputData($variant->id, 1));
    $ticket = app(FireOrderRoundAction::class)->execute($order->id, $waiter->id);

    app(BumpKitchenItemStatusAction::class)->execute($orderItem->id, ItemPrepState::InPrep, $chef->id);
    app(BumpKitchenItemStatusAction::class)->execute($orderItem->id, ItemPrepState::Ready, $chef->id);
    app(ServeKitchenTicketExpoAction::class)->execute($ticket->id, $expo->id);

    $override = BranchMenuOverride::query()
        ->where('branch_id', $branch->id)
        ->where('menu_item_variant_id', $variant->id)
        ->firstOrFail();

    expect($override->is_available)->toBeFalse()
        ->and(BranchIngredientStock::query()
            ->where('branch_id', $branch->id)
            ->where('ingredient_id', $beef->id)
            ->firstOrFail()
            ->quantity_on_hand)->toBe(250);

    Event::assertDispatched(ItemAvailabilityChanged::class, function (ItemAvailabilityChanged $event) use ($branch, $variant): bool {
        return $event->branchId === $branch->id
            && $event->variantId === $variant->id
            && $event->isAvailable === false;
    });
});

it('skips inventory deduction for pre-prep Queued voids and deducts Wastage for InPrep/Ready voids', function (): void {
    $branch = Branch::create(['code' => 'DTF', 'name' => 'Downtown Flagship']);
    User::factory()->create([
        'branch_id' => $branch->id,
        'role' => StaffRole::BranchManager,
        'pin_hash' => Hash::make('1234'),
    ]);
    $waiter = User::factory()->create(['branch_id' => $branch->id, 'role' => StaffRole::Waiter]);
    $chef = User::factory()->create(['branch_id' => $branch->id, 'role' => StaffRole::Chef]);
    $shift = app(OpenShiftAction::class)->execute($branch->id, $waiter->id, 20000);

    $category = MenuCategory::create(['name' => 'Grill', 'slug' => 'grill', 'sort_order' => 1]);
    $item = MenuItem::create([
        'menu_category_id' => $category->id,
        'name' => 'Prime Ribeye',
        'slug' => 'prime-ribeye',
        'prep_station' => PrepStation::Grill,
    ]);
    $variant = MenuItemVariant::create([
        'menu_item_id' => $item->id,
        'name' => '300g',
        'sku' => 'RIB-300',
        'base_price_cents' => 4200,
    ]);

    $ribeye = Ingredient::create([
        'code' => 'ING-RIB',
        'name' => 'Ribeye Steak',
        'unit' => MeasurementUnit::Grams,
        'default_unit_cost_cents' => 6,
    ]);

    RecipeItem::create([
        'menu_item_variant_id' => $variant->id,
        'ingredient_id' => $ribeye->id,
        'quantity_required' => 300,
    ]);

    BranchIngredientStock::create([
        'branch_id' => $branch->id,
        'ingredient_id' => $ribeye->id,
        'quantity_on_hand' => 1500,
        'auto_86_threshold' => 200,
        'unit_cost_cents' => 6,
    ]);

    $order = app(OpenOrderTabAction::class)->execute($branch->id, $shift->id, $waiter->id, ServiceType::Takeaway);
    $queuedItem = app(AddDraftOrderItemAction::class)->execute($order->id, new OrderItemInputData($variant->id, 1));
    $inPrepItem = app(AddDraftOrderItemAction::class)->execute($order->id, new OrderItemInputData($variant->id, 1));
    app(FireOrderRoundAction::class)->execute($order->id, $waiter->id);

    Queue::fake();

    app(VoidOrderItemAction::class)->execute($queuedItem->id, '1234', VoidReason::CustomerChangedMind, $waiter->id);
    Queue::assertNotPushed(DeductOrderInventoryJob::class);

    app(BumpKitchenItemStatusAction::class)->execute($inPrepItem->id, ItemPrepState::InPrep, $chef->id);
    app(VoidOrderItemAction::class)->execute($inPrepItem->id, '1234', VoidReason::KitchenError, $waiter->id);

    Queue::assertPushedOn('inventory', DeductOrderInventoryJob::class, function (DeductOrderInventoryJob $job) use ($inPrepItem): bool {
        return $job->referenceType === 'voided_order_item'
            && $job->referenceId === $inPrepItem->id
            && $job->movementType === StockMovementType::Wastage;
    });

    // Execute the wastage job directly to verify unit cost snapshot and stock decrement
    $wastageJob = new DeductOrderInventoryJob(
        branchId: $branch->id,
        referenceType: 'voided_order_item',
        referenceId: $inPrepItem->id,
        variantQuantities: [$variant->id => 1],
        movementType: StockMovementType::Wastage,
        actorUserId: $waiter->id,
    );
    app()->call([$wastageJob, 'handle']);

    $stock = BranchIngredientStock::query()
        ->where('branch_id', $branch->id)
        ->where('ingredient_id', $ribeye->id)
        ->firstOrFail();

    $movement = StockMovement::query()
        ->where('reference_type', 'voided_order_item')
        ->where('reference_id', (string) $inPrepItem->id)
        ->firstOrFail();

    expect($stock->quantity_on_hand)->toBe(1200)
        ->and($movement->movement_type)->toBe(StockMovementType::Wastage)
        ->and($movement->unit_cost_cents)->toBe(6)
        ->and($movement->total_cost_cents)->toBe(1800);
});

it('drops ordered ingredient to auto_86_threshold when low-stock simulation flag is active', function (): void {
    Event::fake([ItemAvailabilityChanged::class]);

    $branch = Branch::create(['code' => 'DTF', 'name' => 'Downtown Flagship']);
    $waiter = User::factory()->create(['branch_id' => $branch->id, 'role' => StaffRole::Waiter]);
    $chef = User::factory()->create(['branch_id' => $branch->id, 'role' => StaffRole::Chef]);
    $expo = User::factory()->create(['branch_id' => $branch->id, 'role' => StaffRole::KitchenExpediter]);
    $shift = app(OpenShiftAction::class)->execute($branch->id, $waiter->id, 20000);

    $category = MenuCategory::create(['name' => 'Grill', 'slug' => 'grill', 'sort_order' => 1]);
    $item = MenuItem::create([
        'menu_category_id' => $category->id,
        'name' => 'Wagyu Burger',
        'slug' => 'wagyu-burger',
        'prep_station' => PrepStation::Grill,
    ]);
    $variant = MenuItemVariant::create([
        'menu_item_id' => $item->id,
        'name' => 'Standard',
        'sku' => 'WAG-SIM',
        'base_price_cents' => 2400,
    ]);

    $beef = Ingredient::create([
        'code' => 'ING-BEEF-SIM',
        'name' => 'Dry-Aged Beef',
        'unit' => MeasurementUnit::Grams,
        'default_unit_cost_cents' => 4,
    ]);

    RecipeItem::create([
        'menu_item_variant_id' => $variant->id,
        'ingredient_id' => $beef->id,
        'quantity_required' => 200,
    ]);

    BranchIngredientStock::create([
        'branch_id' => $branch->id,
        'ingredient_id' => $beef->id,
        'quantity_on_hand' => 10000,
        'auto_86_threshold' => 250,
        'unit_cost_cents' => 4,
    ]);

    $order = app(OpenOrderTabAction::class)->execute($branch->id, $shift->id, $waiter->id, ServiceType::Takeaway);
    $orderItem = app(AddDraftOrderItemAction::class)->execute($order->id, new OrderItemInputData($variant->id, 1));
    $ticket = app(FireOrderRoundAction::class)->execute($order->id, $waiter->id);

    app(BumpKitchenItemStatusAction::class)->execute($orderItem->id, ItemPrepState::InPrep, $chef->id);
    app(BumpKitchenItemStatusAction::class)->execute($orderItem->id, ItemPrepState::Ready, $chef->id);
    app(ServeKitchenTicketExpoAction::class)->execute($ticket->id, $expo->id, forceLowStockSimulation: true);

    expect(BranchIngredientStock::query()
        ->where('branch_id', $branch->id)
        ->where('ingredient_id', $beef->id)
        ->firstOrFail()
        ->quantity_on_hand)->toBe(250)
        ->and(BranchMenuOverride::query()
            ->where('branch_id', $branch->id)
            ->where('menu_item_variant_id', $variant->id)
            ->firstOrFail()
            ->is_available)->toBeFalse();

    Event::assertDispatched(ItemAvailabilityChanged::class);
});
