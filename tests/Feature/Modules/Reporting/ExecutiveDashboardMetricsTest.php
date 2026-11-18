<?php

declare(strict_types=1);

use App\Models\User;
use App\Modules\Identity\Enums\StaffRole;
use App\Modules\Inventory\Enums\MeasurementUnit;
use App\Modules\Inventory\Enums\StockMovementType;
use App\Modules\Inventory\Models\Ingredient;
use App\Modules\Inventory\Models\StockMovement;
use App\Modules\Kitchen\Enums\ItemPrepState;
use App\Modules\Menu\Enums\PrepStation;
use App\Modules\Menu\Models\MenuCategory;
use App\Modules\Menu\Models\MenuItem;
use App\Modules\Menu\Models\MenuItemVariant;
use App\Modules\Orders\Enums\OrderState;
use App\Modules\Orders\Enums\ServiceType;
use App\Modules\Orders\Models\Order;
use App\Modules\Orders\Models\OrderItem;
use App\Modules\Reporting\Queries\GetExecutiveDashboardMetricsQuery;
use App\Modules\Restaurant\Models\Branch;
use App\Modules\Shifts\Enums\ShiftState;
use App\Modules\Shifts\Models\Shift;
use Carbon\CarbonImmutable;

it('computes accurate cross-branch revenue, AOV, COGS %, voids, and cash variance without branch contamination', function (): void {
    $branch1 = Branch::create(['code' => 'DTF', 'name' => 'Downtown Flagship']);
    $branch2 = Branch::create(['code' => 'WFP', 'name' => 'Waterfront Patio']);

    $waiter1 = User::factory()->create(['branch_id' => $branch1->id, 'role' => StaffRole::Waiter]);
    $waiter2 = User::factory()->create(['branch_id' => $branch2->id, 'role' => StaffRole::Waiter]);

    $closedShift1 = Shift::create([
        'branch_id' => $branch1->id,
        'user_id' => $waiter1->id,
        'state' => ShiftState::VarianceFlagged,
        'opening_cash_cents' => 20000,
        'expected_cash_cents' => 30000,
        'counted_cash_cents' => 29600,
        'variance_cents' => -400,
        'opened_at' => now()->subHours(8),
        'closed_at' => now()->subHour(),
    ]);

    $closedShift2 = Shift::create([
        'branch_id' => $branch2->id,
        'user_id' => $waiter2->id,
        'state' => ShiftState::Closed,
        'opening_cash_cents' => 20000,
        'expected_cash_cents' => 25000,
        'counted_cash_cents' => 25000,
        'variance_cents' => 0,
        'opened_at' => now()->subHours(8),
        'closed_at' => now()->subHour(),
    ]);

    $category = MenuCategory::create(['name' => 'Mains', 'slug' => 'mains', 'sort_order' => 1]);
    $item = MenuItem::create([
        'menu_category_id' => $category->id,
        'name' => 'Prime Steak',
        'slug' => 'prime-steak',
        'prep_station' => PrepStation::Grill,
    ]);
    $variant = MenuItemVariant::create([
        'menu_item_id' => $item->id,
        'name' => '300g',
        'sku' => 'STK-300',
        'base_price_cents' => 5000,
    ]);

    $order1 = Order::create([
        'branch_id' => $branch1->id,
        'shift_id' => $closedShift1->id,
        'server_id' => $waiter1->id,
        'order_number' => 'DTF-001',
        'service_type' => ServiceType::DineIn,
        'state' => OrderState::Paid,
        'subtotal_cents' => 10000,
        'total_cents' => 10000,
        'opened_at' => now()->subHours(3),
        'closed_at' => now()->subHours(2),
    ]);

    OrderItem::create([
        'order_id' => $order1->id,
        'menu_item_variant_id' => $variant->id,
        'item_name_snapshot' => 'Prime Steak',
        'variant_name_snapshot' => '300g',
        'prep_station' => PrepStation::Grill,
        'prep_state' => ItemPrepState::Served,
        'quantity' => 2,
        'unit_price_cents' => 5000,
        'modifiers_total_cents' => 0,
        'line_total_cents' => 10000,
    ]);

    $order2 = Order::create([
        'branch_id' => $branch1->id,
        'shift_id' => $closedShift1->id,
        'server_id' => $waiter1->id,
        'order_number' => 'DTF-002',
        'service_type' => ServiceType::DineIn,
        'state' => OrderState::Paid,
        'subtotal_cents' => 20000,
        'total_cents' => 20000,
        'opened_at' => now()->subHours(2),
        'closed_at' => now()->subHour(),
    ]);

    OrderItem::create([
        'order_id' => $order2->id,
        'menu_item_variant_id' => $variant->id,
        'item_name_snapshot' => 'Prime Steak',
        'variant_name_snapshot' => '300g',
        'prep_station' => PrepStation::Grill,
        'prep_state' => ItemPrepState::Voided,
        'quantity' => 1,
        'unit_price_cents' => 1500,
        'modifiers_total_cents' => 0,
        'line_total_cents' => 1500,
        'was_in_prep_at_void' => true,
    ]);

    $orderBranch2 = Order::create([
        'branch_id' => $branch2->id,
        'shift_id' => $closedShift2->id,
        'server_id' => $waiter2->id,
        'order_number' => 'WFP-001',
        'service_type' => ServiceType::Takeaway,
        'state' => OrderState::Paid,
        'subtotal_cents' => 5000,
        'total_cents' => 5000,
        'opened_at' => now()->subHour(),
        'closed_at' => now()->subMinutes(10),
    ]);

    $beef = Ingredient::create([
        'code' => 'ING-BEEF-RPT',
        'name' => 'Beef',
        'unit' => MeasurementUnit::Grams,
        'default_unit_cost_cents' => 3,
    ]);

    StockMovement::create([
        'branch_id' => $branch1->id,
        'ingredient_id' => $beef->id,
        'movement_type' => StockMovementType::OrderSale,
        'reference_type' => 'kitchen_ticket',
        'reference_id' => '901',
        'quantity_delta' => -3000,
        'unit_cost_cents' => 3,
        'total_cost_cents' => 9000,
        'actor_user_id' => $waiter1->id,
    ]);

    StockMovement::create([
        'branch_id' => $branch2->id,
        'ingredient_id' => $beef->id,
        'movement_type' => StockMovementType::OrderSale,
        'reference_type' => 'kitchen_ticket',
        'reference_id' => '902',
        'quantity_delta' => -500,
        'unit_cost_cents' => 3,
        'total_cost_cents' => 1500,
        'actor_user_id' => $waiter2->id,
    ]);

    $query = app(GetExecutiveDashboardMetricsQuery::class);

    $branch1Metrics = $query->execute(branchId: $branch1->id);

    expect($branch1Metrics->totalRevenueCents)->toBe(30000)
        ->and($branch1Metrics->totalOrdersCount)->toBe(2)
        ->and($branch1Metrics->averageOrderValueCents)->toBe(15000)
        ->and($branch1Metrics->totalCogsCents)->toBe(9000)
        ->and($branch1Metrics->cogsPercentBps)->toBe(3000)
        ->and($branch1Metrics->totalVoidsCents)->toBe(1500)
        ->and($branch1Metrics->netCashVarianceCents)->toBe(-400)
        ->and($branch1Metrics->topProducts)->not->toBeEmpty()
        ->and($branch1Metrics->topProducts[0]->quantitySold)->toBe(2);

    $consolidated = $query->execute(branchId: null);

    expect($consolidated->totalRevenueCents)->toBe(35000)
        ->and($consolidated->totalOrdersCount)->toBe(3)
        ->and($consolidated->totalCogsCents)->toBe(10500)
        ->and($consolidated->cogsPercentBps)->toBe(3000)
        ->and($consolidated->branchComparisons)->toHaveCount(2);
});

it('executes cleanly and groups 24-hour sales series across SQLite and MySQL-compatible SQL', function (): void {
    $branch = Branch::create(['code' => 'DTF', 'name' => 'Downtown Flagship']);
    $waiter = User::factory()->create(['branch_id' => $branch->id, 'role' => StaffRole::Waiter]);
    $shift = Shift::create([
        'branch_id' => $branch->id,
        'user_id' => $waiter->id,
        'state' => ShiftState::Open,
        'opening_cash_cents' => 10000,
        'expected_cash_cents' => 10000,
        'opened_at' => now(),
    ]);

    $hour19 = CarbonImmutable::now()->setTime(19, 15, 0);

    $order = new Order([
        'branch_id' => $branch->id,
        'shift_id' => $shift->id,
        'server_id' => $waiter->id,
        'order_number' => 'DTF-H19',
        'service_type' => ServiceType::DineIn,
        'state' => OrderState::Paid,
        'subtotal_cents' => 12500,
        'total_cents' => 12500,
        'opened_at' => $hour19,
        'closed_at' => $hour19,
    ]);
    $order->created_at = $hour19;
    $order->updated_at = $hour19;
    $order->save();

    $metrics = app(GetExecutiveDashboardMetricsQuery::class)->execute($branch->id);

    expect($metrics->hourlySales)->toHaveCount(24)
        ->and($metrics->hourlySales[19]->hour)->toBe(19)
        ->and($metrics->hourlySales[19]->revenueCents)->toBe(12500)
        ->and($metrics->hourlySales[19]->ordersCount)->toBe(1)
        ->and($metrics->hourlySales[0]->revenueCents)->toBe(0);
});
