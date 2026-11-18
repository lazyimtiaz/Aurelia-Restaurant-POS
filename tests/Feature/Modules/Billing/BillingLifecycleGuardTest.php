<?php

declare(strict_types=1);

use App\Models\User;
use App\Modules\Billing\Actions\ReopenOrderFromBillingAction;
use App\Modules\Billing\Actions\RequestOrderBillAction;
use App\Modules\Billing\Enums\BillSplitState;
use App\Modules\Billing\Exceptions\CannotReopenPartiallyPaidOrderException;
use App\Modules\Billing\Models\BillSplit;
use App\Modules\Floor\Enums\TableState;
use App\Modules\Floor\Models\DiningTable;
use App\Modules\Floor\Models\FloorZone;
use App\Modules\Identity\Enums\StaffRole;
use App\Modules\Menu\Enums\PrepStation;
use App\Modules\Menu\Models\MenuCategory;
use App\Modules\Menu\Models\MenuItem;
use App\Modules\Menu\Models\MenuItemVariant;
use App\Modules\Orders\Actions\AddDraftOrderItemAction;
use App\Modules\Orders\Actions\FireOrderRoundAction;
use App\Modules\Orders\Actions\OpenOrderTabAction;
use App\Modules\Orders\DTOs\OrderItemInputData;
use App\Modules\Orders\Enums\OrderState;
use App\Modules\Orders\Enums\ServiceType;
use App\Modules\Restaurant\Models\Branch;
use App\Modules\Shifts\Actions\OpenShiftAction;

it('transitions an Open order and its Occupied table to Billing, blocks new items, and clears unpaid splits on Reopen', function (): void {
    $branch = Branch::create(['code' => 'DTF', 'name' => 'Downtown Flagship']);
    $zone = FloorZone::create(['branch_id' => $branch->id, 'name' => 'Main', 'sort_order' => 1]);
    $table = DiningTable::create(['branch_id' => $branch->id, 'floor_zone_id' => $zone->id, 'code' => 'T1', 'capacity' => 4, 'state' => TableState::Available]);
    $waiter = User::factory()->create(['branch_id' => $branch->id, 'role' => StaffRole::Waiter]);
    $shift = app(OpenShiftAction::class)->execute($branch->id, $waiter->id, 20000);

    $cat = MenuCategory::create(['name' => 'Mains', 'slug' => 'mains', 'sort_order' => 1]);
    $dish = MenuItem::create(['menu_category_id' => $cat->id, 'name' => 'Steak', 'slug' => 'steak', 'prep_station' => PrepStation::Grill]);
    $variant = MenuItemVariant::create(['menu_item_id' => $dish->id, 'name' => '300g', 'sku' => 'STK-1', 'base_price_cents' => 4000]);

    $order = app(OpenOrderTabAction::class)->execute($branch->id, $shift->id, $waiter->id, ServiceType::DineIn, $table->id, 2);
    app(AddDraftOrderItemAction::class)->execute($order->id, new OrderItemInputData($variant->id, 1));
    app(FireOrderRoundAction::class)->execute($order->id, $waiter->id);

    $billingOrder = app(RequestOrderBillAction::class)->execute($order->id);

    expect($billingOrder->state)->toBe(OrderState::Billing)
        ->and($table->refresh()->state)->toBe(TableState::Billing)
        ->and(BillSplit::query()->where('order_id', $order->id)->count())->toBe(1);

    expect(fn () => app(AddDraftOrderItemAction::class)->execute($order->id, new OrderItemInputData($variant->id, 1)))
        ->toThrow(DomainException::class);

    $reopened = app(ReopenOrderFromBillingAction::class)->execute($order->id);

    expect($reopened->state)->toBe(OrderState::Open)
        ->and($table->refresh()->state)->toBe(TableState::Occupied)
        ->and(BillSplit::query()->where('order_id', $order->id)->count())->toBe(0);
});

it('blocks reopening when any BillSplit is Paid or order is PartiallyPaid', function (): void {
    $branch = Branch::create(['code' => 'DTF', 'name' => 'Downtown Flagship']);
    $waiter = User::factory()->create(['branch_id' => $branch->id, 'role' => StaffRole::Waiter]);
    $shift = app(OpenShiftAction::class)->execute($branch->id, $waiter->id, 20000);

    $cat = MenuCategory::create(['name' => 'Mains', 'slug' => 'mains', 'sort_order' => 1]);
    $dish = MenuItem::create(['menu_category_id' => $cat->id, 'name' => 'Steak', 'slug' => 'steak', 'prep_station' => PrepStation::Grill]);
    $variant = MenuItemVariant::create(['menu_item_id' => $dish->id, 'name' => '300g', 'sku' => 'STK-1', 'base_price_cents' => 4000]);

    $order = app(OpenOrderTabAction::class)->execute($branch->id, $shift->id, $waiter->id, ServiceType::Takeaway, customerName: 'Alex');
    app(AddDraftOrderItemAction::class)->execute($order->id, new OrderItemInputData($variant->id, 1));
    app(FireOrderRoundAction::class)->execute($order->id, $waiter->id);

    app(RequestOrderBillAction::class)->execute($order->id);
    $split = BillSplit::query()->where('order_id', $order->id)->firstOrFail();
    $split->update(['state' => BillSplitState::Paid]);
    $order->update(['state' => OrderState::PartiallyPaid]);

    expect(fn () => app(ReopenOrderFromBillingAction::class)->execute($order->id))
        ->toThrow(CannotReopenPartiallyPaidOrderException::class);
});
