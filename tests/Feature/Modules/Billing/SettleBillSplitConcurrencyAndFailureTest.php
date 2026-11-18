<?php

declare(strict_types=1);

use App\Models\User;
use App\Modules\Billing\Actions\RequestOrderBillAction;
use App\Modules\Billing\Actions\SettleBillSplitAction;
use App\Modules\Billing\Actions\SplitOrderBillAction;
use App\Modules\Billing\DTOs\SettleBillSplitData;
use App\Modules\Billing\DTOs\SplitOrderBillData;
use App\Modules\Billing\Enums\BillSplitState;
use App\Modules\Billing\Enums\PaymentState;
use App\Modules\Billing\Enums\SplitMode;
use App\Modules\Billing\Enums\TenderMethod;
use App\Modules\Billing\Events\PaymentCaptured;
use App\Modules\Floor\Enums\TableState;
use App\Modules\Floor\Events\TableOccupancyChanged;
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
use App\Modules\Orders\Models\Order;
use App\Modules\Restaurant\Models\Branch;
use App\Modules\Shifts\Actions\OpenShiftAction;
use App\Modules\Shifts\Models\Shift;
use Illuminate\Support\Facades\Event;

it('returns the existing PaymentTransaction idempotently when called twice with the same idempotency_key', function (): void {
    $branch = Branch::create(['code' => 'DTF', 'name' => 'Downtown Flagship', 'tax_rate_bps' => 0, 'service_charge_bps' => 0]);
    $cashier = User::factory()->create(['branch_id' => $branch->id, 'role' => StaffRole::Cashier]);
    $shift = app(OpenShiftAction::class)->execute($branch->id, $cashier->id, 20000);

    $cat = MenuCategory::create(['name' => 'Mains', 'slug' => 'mains', 'sort_order' => 1]);
    $dish = MenuItem::create(['menu_category_id' => $cat->id, 'name' => 'Steak', 'slug' => 'steak', 'prep_station' => PrepStation::Grill]);
    $variant = MenuItemVariant::create(['menu_item_id' => $dish->id, 'name' => '300g', 'sku' => 'STK-1', 'base_price_cents' => 5000]);

    $order = app(OpenOrderTabAction::class)->execute($branch->id, $shift->id, $cashier->id, ServiceType::Takeaway, customerName: 'Idemp');
    app(AddDraftOrderItemAction::class)->execute($order->id, new OrderItemInputData($variant->id, 1));
    app(FireOrderRoundAction::class)->execute($order->id, $cashier->id);
    $billingOrder = app(RequestOrderBillAction::class)->execute($order->id);
    $split = $billingOrder->billSplits->firstOrFail();

    $settle = app(SettleBillSplitAction::class);
    $tx1 = $settle->execute(new SettleBillSplitData(
        billSplitId: $split->id,
        shiftId: $shift->id,
        actorUserId: $cashier->id,
        tenderMethod: TenderMethod::Cash,
        amountTenderedCents: 6000,
        tipCents: 500,
        idempotencyKey: 'uuid-123',
    ));

    expect($tx1->state)->toBe(PaymentState::Captured)
        ->and($tx1->amount_cents)->toBe(5500)
        ->and($tx1->change_cents)->toBe(500)
        ->and(Shift::query()->findOrFail($shift->id)->expected_cash_cents)->toBe(25500);

    $tx2 = $settle->execute(new SettleBillSplitData(
        billSplitId: $split->id,
        shiftId: $shift->id,
        actorUserId: $cashier->id,
        tenderMethod: TenderMethod::Cash,
        amountTenderedCents: 6000,
        tipCents: 500,
        idempotencyKey: 'uuid-123',
    ));

    expect($tx2->id)->toBe($tx1->id)
        ->and(Shift::query()->findOrFail($shift->id)->expected_cash_cents)->toBe(25500);
});

it('preserves Check A as Paid and moves Order to PartiallyPaid when Check B declines, then completes on retry', function (): void {
    Event::fake([PaymentCaptured::class, TableOccupancyChanged::class]);

    $branch = Branch::create(['code' => 'DTF', 'name' => 'Downtown Flagship', 'tax_rate_bps' => 0, 'service_charge_bps' => 0]);
    $zone = FloorZone::create(['branch_id' => $branch->id, 'name' => 'Main', 'sort_order' => 1]);
    $table = DiningTable::create(['branch_id' => $branch->id, 'floor_zone_id' => $zone->id, 'code' => 'T1', 'capacity' => 4, 'state' => TableState::Available]);
    $cashier = User::factory()->create(['branch_id' => $branch->id, 'role' => StaffRole::Cashier]);
    $shift = app(OpenShiftAction::class)->execute($branch->id, $cashier->id, 20000);

    $cat = MenuCategory::create(['name' => 'Mains', 'slug' => 'mains', 'sort_order' => 1]);
    $dish = MenuItem::create(['menu_category_id' => $cat->id, 'name' => 'Platter', 'slug' => 'platter', 'prep_station' => PrepStation::Grill]);
    $variant = MenuItemVariant::create(['menu_item_id' => $dish->id, 'name' => 'For 2', 'sku' => 'PLT-2', 'base_price_cents' => 10000]);

    $order = app(OpenOrderTabAction::class)->execute($branch->id, $shift->id, $cashier->id, ServiceType::DineIn, $table->id, 2);
    app(AddDraftOrderItemAction::class)->execute($order->id, new OrderItemInputData($variant->id, 1));
    app(FireOrderRoundAction::class)->execute($order->id, $cashier->id);
    app(RequestOrderBillAction::class)->execute($order->id);

    $splits = app(SplitOrderBillAction::class)->execute(new SplitOrderBillData($order->id, SplitMode::Equal, equalWays: 2));
    $checkA = $splits[0];
    $checkB = $splits[1];

    $settle = app(SettleBillSplitAction::class);

    $txA = $settle->execute(new SettleBillSplitData(
        billSplitId: $checkA->id,
        shiftId: $shift->id,
        actorUserId: $cashier->id,
        tenderMethod: TenderMethod::Card,
        amountTenderedCents: 5000,
        tipCents: 0,
        idempotencyKey: 'key-check-a',
        simulateDecline: false,
    ));

    expect($txA->state)->toBe(PaymentState::Captured)
        ->and($checkA->refresh()->state)->toBe(BillSplitState::Paid)
        ->and($order->refresh()->state)->toBe(OrderState::PartiallyPaid)
        ->and($table->refresh()->state)->toBe(TableState::Billing);

    $txBFail = $settle->execute(new SettleBillSplitData(
        billSplitId: $checkB->id,
        shiftId: $shift->id,
        actorUserId: $cashier->id,
        tenderMethod: TenderMethod::Card,
        amountTenderedCents: 5000,
        tipCents: 0,
        idempotencyKey: 'key-check-b-fail',
        simulateDecline: true,
    ));

    expect($txBFail->state)->toBe(PaymentState::Failed)
        ->and($checkB->refresh()->state)->toBe(BillSplitState::Failed)
        ->and($checkA->refresh()->state)->toBe(BillSplitState::Paid)
        ->and($order->refresh()->state)->toBe(OrderState::PartiallyPaid)
        ->and($table->refresh()->state)->toBe(TableState::Billing);

    $txBRetry = $settle->execute(new SettleBillSplitData(
        billSplitId: $checkB->id,
        shiftId: $shift->id,
        actorUserId: $cashier->id,
        tenderMethod: TenderMethod::Cash,
        amountTenderedCents: 5000,
        tipCents: 0,
        idempotencyKey: 'key-check-b-retry',
    ));

    expect($txBRetry->state)->toBe(PaymentState::Captured)
        ->and($checkB->refresh()->state)->toBe(BillSplitState::Paid)
        ->and($order->refresh()->state)->toBe(OrderState::Paid)
        ->and($table->refresh()->state)->toBe(TableState::Dirty);

    Event::assertDispatched(PaymentCaptured::class);
    Event::assertDispatched(TableOccupancyChanged::class);
});

it('settles a Takeaway order without a dining table cleanly without attempting table transitions', function (): void {
    Event::fake([PaymentCaptured::class]);

    $branch = Branch::create(['code' => 'DTF', 'name' => 'Downtown Flagship', 'tax_rate_bps' => 0, 'service_charge_bps' => 0]);
    $cashier = User::factory()->create(['branch_id' => $branch->id, 'role' => StaffRole::Cashier]);
    $shift = app(OpenShiftAction::class)->execute($branch->id, $cashier->id, 20000);

    $cat = MenuCategory::create(['name' => 'Bar', 'slug' => 'bar', 'sort_order' => 1]);
    $drink = MenuItem::create(['menu_category_id' => $cat->id, 'name' => 'Spritz', 'slug' => 'spritz', 'prep_station' => PrepStation::Bar]);
    $variant = MenuItemVariant::create(['menu_item_id' => $drink->id, 'name' => 'Glass', 'sku' => 'BAR-1', 'base_price_cents' => 1250]);

    $order = app(OpenOrderTabAction::class)->execute($branch->id, $shift->id, $cashier->id, ServiceType::Takeaway, customerName: 'Robin');
    app(AddDraftOrderItemAction::class)->execute($order->id, new OrderItemInputData($variant->id, 1));
    app(FireOrderRoundAction::class)->execute($order->id, $cashier->id);
    $billingOrder = app(RequestOrderBillAction::class)->execute($order->id);

    $tx = app(SettleBillSplitAction::class)->execute(new SettleBillSplitData(
        billSplitId: $billingOrder->billSplits->firstOrFail()->id,
        shiftId: $shift->id,
        actorUserId: $cashier->id,
        tenderMethod: TenderMethod::Qr,
        amountTenderedCents: 1250,
        tipCents: 0,
        idempotencyKey: 'takeaway-qr-1',
    ));

    expect($tx->state)->toBe(PaymentState::Captured)
        ->and(Order::query()->findOrFail($order->id)->state)->toBe(OrderState::Paid);

    Event::assertDispatched(PaymentCaptured::class);
});
