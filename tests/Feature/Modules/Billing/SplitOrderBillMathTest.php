<?php

declare(strict_types=1);

use App\Models\User;
use App\Modules\Billing\Actions\RequestOrderBillAction;
use App\Modules\Billing\Actions\SplitOrderBillAction;
use App\Modules\Billing\DTOs\SeatItemAllocationData;
use App\Modules\Billing\DTOs\SplitOrderBillData;
use App\Modules\Billing\Enums\BillSplitState;
use App\Modules\Billing\Enums\SplitMode;
use App\Modules\Billing\Events\OrderBillSplitUpdated;
use App\Modules\Billing\Exceptions\CannotReopenPartiallyPaidOrderException;
use App\Modules\Billing\Models\BillSplit;
use App\Modules\Identity\Enums\StaffRole;
use App\Modules\Menu\Enums\PrepStation;
use App\Modules\Menu\Models\MenuCategory;
use App\Modules\Menu\Models\MenuItem;
use App\Modules\Menu\Models\MenuItemVariant;
use App\Modules\Orders\Actions\AddDraftOrderItemAction;
use App\Modules\Orders\Actions\ApplyOrderDiscountAction;
use App\Modules\Orders\Actions\FireOrderRoundAction;
use App\Modules\Orders\Actions\OpenOrderTabAction;
use App\Modules\Orders\DTOs\OrderItemInputData;
use App\Modules\Orders\Enums\ServiceType;
use App\Modules\Orders\Models\Order;
use App\Modules\Restaurant\Models\Branch;
use App\Modules\Shifts\Actions\OpenShiftAction;
use Illuminate\Support\Facades\Event;

it('distributes equal N-way splits deterministically so remainders land on final checks with zero drift', function (): void {
    Event::fake([OrderBillSplitUpdated::class]);

    $branch = Branch::create(['code' => 'DTF', 'name' => 'Downtown Flagship', 'tax_rate_bps' => 0, 'service_charge_bps' => 0]);
    $cashier = User::factory()->create(['branch_id' => $branch->id, 'role' => StaffRole::Cashier]);
    $shift = app(OpenShiftAction::class)->execute($branch->id, $cashier->id, 20000);

    $cat = MenuCategory::create(['name' => 'Mains', 'slug' => 'mains', 'sort_order' => 1]);
    $dish = MenuItem::create(['menu_category_id' => $cat->id, 'name' => 'Platter', 'slug' => 'platter', 'prep_station' => PrepStation::Grill]);
    $v100 = MenuItemVariant::create(['menu_item_id' => $dish->id, 'name' => '$100', 'sku' => 'PLT-100', 'base_price_cents' => 10000]);
    $v10001 = MenuItemVariant::create(['menu_item_id' => $dish->id, 'name' => '$100.01', 'sku' => 'PLT-101', 'base_price_cents' => 10001]);

    $order1 = app(OpenOrderTabAction::class)->execute($branch->id, $shift->id, $cashier->id, ServiceType::Takeaway, customerName: 'Party A');
    app(AddDraftOrderItemAction::class)->execute($order1->id, new OrderItemInputData($v100->id, 1));
    app(FireOrderRoundAction::class)->execute($order1->id, $cashier->id);
    app(RequestOrderBillAction::class)->execute($order1->id);

    $splits3 = app(SplitOrderBillAction::class)->execute(new SplitOrderBillData(
        orderId: $order1->id,
        mode: SplitMode::Equal,
        equalWays: 3,
    ));

    expect($splits3->pluck('total_cents')->all())->toBe([3333, 3333, 3334])
        ->and($splits3->sum('total_cents'))->toBe(10000);

    Event::assertDispatched(OrderBillSplitUpdated::class);

    $order2 = app(OpenOrderTabAction::class)->execute($branch->id, $shift->id, $cashier->id, ServiceType::Takeaway, customerName: 'Party B');
    app(AddDraftOrderItemAction::class)->execute($order2->id, new OrderItemInputData($v10001->id, 1));
    app(FireOrderRoundAction::class)->execute($order2->id, $cashier->id);
    app(RequestOrderBillAction::class)->execute($order2->id);

    $splits4 = app(SplitOrderBillAction::class)->execute(new SplitOrderBillData(
        orderId: $order2->id,
        mode: SplitMode::Equal,
        equalWays: 4,
    ));

    expect($splits4->pluck('total_cents')->all())->toBe([2500, 2500, 2500, 2501])
        ->and($splits4->sum('total_cents'))->toBe(10001);
});

it('splits by item and shared fractional item while preserving exact order discount, service charge, and tax sum', function (): void {
    $branch = Branch::create(['code' => 'DTF', 'name' => 'Downtown Flagship', 'tax_rate_bps' => 825, 'service_charge_bps' => 500]);
    $cashier = User::factory()->create(['branch_id' => $branch->id, 'role' => StaffRole::Cashier]);
    $shift = app(OpenShiftAction::class)->execute($branch->id, $cashier->id, 20000);

    $cat = MenuCategory::create(['name' => 'Mains', 'slug' => 'mains', 'sort_order' => 1]);
    $d1 = MenuItem::create(['menu_category_id' => $cat->id, 'name' => 'Salad', 'slug' => 'salad', 'prep_station' => PrepStation::ColdSalad]);
    $v1 = MenuItemVariant::create(['menu_item_id' => $d1->id, 'name' => 'Reg', 'sku' => 'SLD-1', 'base_price_cents' => 1550]);
    $d2 = MenuItem::create(['menu_category_id' => $cat->id, 'name' => 'Steak', 'slug' => 'steak', 'prep_station' => PrepStation::Grill]);
    $v2 = MenuItemVariant::create(['menu_item_id' => $d2->id, 'name' => '300g', 'sku' => 'STK-1', 'base_price_cents' => 4200]);
    $d3 = MenuItem::create(['menu_category_id' => $cat->id, 'name' => 'Shared App', 'slug' => 'app', 'prep_station' => PrepStation::Grill]);
    $v3 = MenuItemVariant::create(['menu_item_id' => $d3->id, 'name' => 'Share', 'sku' => 'APP-1', 'base_price_cents' => 1901]);

    $order = app(OpenOrderTabAction::class)->execute($branch->id, $shift->id, $cashier->id, ServiceType::Takeaway, customerName: 'Shared Table');
    $item1 = app(AddDraftOrderItemAction::class)->execute($order->id, new OrderItemInputData($v1->id, 1));
    $item2 = app(AddDraftOrderItemAction::class)->execute($order->id, new OrderItemInputData($v2->id, 1));
    $item3 = app(AddDraftOrderItemAction::class)->execute($order->id, new OrderItemInputData($v3->id, 1));
    app(FireOrderRoundAction::class)->execute($order->id, $cashier->id);

    app(ApplyOrderDiscountAction::class)->execute($order->id, 1000, $cashier->id); // 10%
    $order = Order::query()->findOrFail($order->id);

    app(RequestOrderBillAction::class)->execute($order->id);

    $splits = app(SplitOrderBillAction::class)->execute(new SplitOrderBillData(
        orderId: $order->id,
        mode: SplitMode::ItemSeat,
        seatGroups: [
            'Seat 1' => [
                new SeatItemAllocationData($item1->id, 1, 1),
                new SeatItemAllocationData($item3->id, 1, 2),
            ],
            'Seat 2' => [
                new SeatItemAllocationData($item2->id, 1, 1),
                new SeatItemAllocationData($item3->id, 1, 2),
            ],
        ],
    ));

    expect($splits)->toHaveCount(2)
        ->and($splits->sum('subtotal_cents'))->toBe($order->subtotal_cents)
        ->and($splits->sum('discount_cents'))->toBe($order->discount_cents)
        ->and($splits->sum('service_charge_cents'))->toBe($order->service_charge_cents)
        ->and($splits->sum('tax_cents'))->toBe($order->tax_cents)
        ->and($splits->sum('total_cents'))->toBe($order->total_cents);

    foreach ($splits as $split) {
        expect($split->subtotal_cents - $split->discount_cents + $split->service_charge_cents + $split->tax_cents)
            ->toBe($split->total_cents);
    }
});

it('rejects re-splitting an order once any check has already been paid', function (): void {
    $branch = Branch::create(['code' => 'DTF', 'name' => 'Downtown Flagship']);
    $cashier = User::factory()->create(['branch_id' => $branch->id, 'role' => StaffRole::Cashier]);
    $shift = app(OpenShiftAction::class)->execute($branch->id, $cashier->id, 20000);

    $cat = MenuCategory::create(['name' => 'Mains', 'slug' => 'mains', 'sort_order' => 1]);
    $dish = MenuItem::create(['menu_category_id' => $cat->id, 'name' => 'Steak', 'slug' => 'steak', 'prep_station' => PrepStation::Grill]);
    $variant = MenuItemVariant::create(['menu_item_id' => $dish->id, 'name' => '300g', 'sku' => 'STK-1', 'base_price_cents' => 4000]);

    $order = app(OpenOrderTabAction::class)->execute($branch->id, $shift->id, $cashier->id, ServiceType::Takeaway, customerName: 'Locked');
    app(AddDraftOrderItemAction::class)->execute($order->id, new OrderItemInputData($variant->id, 1));
    app(FireOrderRoundAction::class)->execute($order->id, $cashier->id);
    app(RequestOrderBillAction::class)->execute($order->id);

    BillSplit::query()->where('order_id', $order->id)->firstOrFail()->update(['state' => BillSplitState::Paid]);

    expect(fn () => app(SplitOrderBillAction::class)->execute(new SplitOrderBillData(
        orderId: $order->id,
        mode: SplitMode::Equal,
        equalWays: 2,
    )))->toThrow(CannotReopenPartiallyPaidOrderException::class);
});
