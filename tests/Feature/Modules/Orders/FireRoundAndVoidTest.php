<?php

declare(strict_types=1);

use App\Models\User;
use App\Modules\Audit\Models\AuditLog;
use App\Modules\Identity\Enums\StaffRole;
use App\Modules\Identity\Exceptions\InvalidManagerPinException;
use App\Modules\Kitchen\Enums\ItemPrepState;
use App\Modules\Kitchen\Enums\TicketState;
use App\Modules\Kitchen\Enums\VoidReason;
use App\Modules\Kitchen\Events\OrderItemVoided;
use App\Modules\Kitchen\Events\OrderRoundFired;
use App\Modules\Kitchen\Models\KitchenTicket;
use App\Modules\Menu\Actions\SetBranchPriceOverrideAction;
use App\Modules\Menu\Enums\PrepStation;
use App\Modules\Menu\Models\MenuCategory;
use App\Modules\Menu\Models\MenuItem;
use App\Modules\Menu\Models\MenuItemVariant;
use App\Modules\Orders\Actions\AddDraftOrderItemAction;
use App\Modules\Orders\Actions\FireOrderRoundAction;
use App\Modules\Orders\Actions\OpenOrderTabAction;
use App\Modules\Orders\Actions\RemoveDraftOrderItemAction;
use App\Modules\Orders\Actions\VoidOrderItemAction;
use App\Modules\Orders\DTOs\OrderItemInputData;
use App\Modules\Orders\Enums\OrderState;
use App\Modules\Orders\Enums\ServiceType;
use App\Modules\Orders\Exceptions\NoDraftItemsToFireException;
use App\Modules\Restaurant\Models\Branch;
use App\Modules\Shifts\Actions\OpenShiftAction;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Hash;

it('fires draft items as Round 1 KitchenTicket, allows Round 2 separately, and throws NoDraftItemsToFireException when empty', function (): void {
    Event::fake([OrderRoundFired::class]);

    $branch = Branch::create(['code' => 'DTF', 'name' => 'Downtown Flagship']);
    $waiter = User::factory()->create(['branch_id' => $branch->id, 'role' => StaffRole::Waiter]);
    $shift = app(OpenShiftAction::class)->execute($branch->id, $waiter->id, 20000);

    $cat = MenuCategory::create(['name' => 'Mains', 'slug' => 'mains', 'sort_order' => 1]);
    $dish1 = MenuItem::create(['menu_category_id' => $cat->id, 'name' => 'Spritz', 'slug' => 'spritz', 'prep_station' => PrepStation::Bar]);
    $var1 = MenuItemVariant::create(['menu_item_id' => $dish1->id, 'name' => 'Glass', 'sku' => 'BAR-1', 'base_price_cents' => 1200]);
    $dish2 = MenuItem::create(['menu_category_id' => $cat->id, 'name' => 'Steak', 'slug' => 'steak', 'prep_station' => PrepStation::Grill]);
    $var2 = MenuItemVariant::create(['menu_item_id' => $dish2->id, 'name' => '300g', 'sku' => 'GRL-1', 'base_price_cents' => 4000]);

    $order = app(OpenOrderTabAction::class)->execute(
        branchId: $branch->id,
        shiftId: $shift->id,
        serverId: $waiter->id,
        serviceType: ServiceType::Takeaway,
        customerName: 'Guest 1',
    );

    app(AddDraftOrderItemAction::class)->execute($order->id, new OrderItemInputData($var1->id, 1));
    $ticket1 = app(FireOrderRoundAction::class)->execute($order->id, $waiter->id);

    expect($ticket1->round_number)->toBe(1)
        ->and($ticket1->state)->toBe(TicketState::Fired)
        ->and($order->refresh()->state)->toBe(OrderState::Open);

    Event::assertDispatchedTimes(OrderRoundFired::class, 1);

    expect(fn () => app(FireOrderRoundAction::class)->execute($order->id, $waiter->id))
        ->toThrow(NoDraftItemsToFireException::class);

    expect(KitchenTicket::query()->where('order_id', $order->id)->count())->toBe(1);
    Event::assertDispatchedTimes(OrderRoundFired::class, 1);

    app(AddDraftOrderItemAction::class)->execute($order->id, new OrderItemInputData($var2->id, 1));
    $ticket2 = app(FireOrderRoundAction::class)->execute($order->id, $waiter->id);

    expect($ticket2->round_number)->toBe(2)
        ->and(KitchenTicket::query()->where('order_id', $order->id)->count())->toBe(2);
    Event::assertDispatchedTimes(OrderRoundFired::class, 2);
});

it('preserves Round 1 fired item price snapshots when branch price override changes before Round 2', function (): void {
    $branch = Branch::create(['code' => 'DTF', 'name' => 'Downtown Flagship']);
    $manager = User::factory()->create(['branch_id' => $branch->id, 'role' => StaffRole::BranchManager]);
    $waiter = User::factory()->create(['branch_id' => $branch->id, 'role' => StaffRole::Waiter]);
    $shift = app(OpenShiftAction::class)->execute($branch->id, $waiter->id, 20000);

    $cat = MenuCategory::create(['name' => 'Mains', 'slug' => 'mains', 'sort_order' => 1]);
    $dish = MenuItem::create(['menu_category_id' => $cat->id, 'name' => 'Burger', 'slug' => 'burger', 'prep_station' => PrepStation::Grill]);
    $variant = MenuItemVariant::create(['menu_item_id' => $dish->id, 'name' => 'Single', 'sku' => 'BRG-1', 'base_price_cents' => 1900]);

    $order = app(OpenOrderTabAction::class)->execute($branch->id, $shift->id, $waiter->id, ServiceType::Takeaway, customerName: 'Alex');
    $itemRound1 = app(AddDraftOrderItemAction::class)->execute($order->id, new OrderItemInputData($variant->id, 1));
    app(FireOrderRoundAction::class)->execute($order->id, $waiter->id);

    app(SetBranchPriceOverrideAction::class)->execute($branch->id, $variant->id, 2400, $manager->id);

    $itemRound2 = app(AddDraftOrderItemAction::class)->execute($order->id, new OrderItemInputData($variant->id, 1));
    app(FireOrderRoundAction::class)->execute($order->id, $waiter->id);

    expect($itemRound1->refresh()->unit_price_cents)->toBe(1900)
        ->and($itemRound2->refresh()->unit_price_cents)->toBe(2400);
});

it('requires Manager PIN to void fired items, updates totals, logs audit, and broadcasts OrderItemVoided after commit', function (): void {
    Event::fake([OrderItemVoided::class]);

    $branch = Branch::create([
        'code' => 'DTF',
        'name' => 'Downtown Flagship',
        'tax_rate_bps' => 825,
        'service_charge_bps' => 500,
    ]);
    User::factory()->create([
        'branch_id' => $branch->id,
        'role' => StaffRole::BranchManager,
        'pin_hash' => Hash::make('1234'),
    ]);
    $waiter = User::factory()->create(['branch_id' => $branch->id, 'role' => StaffRole::Waiter]);
    $shift = app(OpenShiftAction::class)->execute($branch->id, $waiter->id, 20000);

    $cat = MenuCategory::create(['name' => 'Mains', 'slug' => 'mains', 'sort_order' => 1]);
    $dish = MenuItem::create(['menu_category_id' => $cat->id, 'name' => 'Steak', 'slug' => 'steak', 'prep_station' => PrepStation::Grill]);
    $variant = MenuItemVariant::create(['menu_item_id' => $dish->id, 'name' => '300g', 'sku' => 'STK-1', 'base_price_cents' => 2000]);

    $order = app(OpenOrderTabAction::class)->execute($branch->id, $shift->id, $waiter->id, ServiceType::Takeaway, customerName: 'Taylor');
    $firedItem = app(AddDraftOrderItemAction::class)->execute($order->id, new OrderItemInputData($variant->id, 1));
    app(FireOrderRoundAction::class)->execute($order->id, $waiter->id);

    expect(fn () => app(RemoveDraftOrderItemAction::class)->execute($firedItem->id))
        ->toThrow(DomainException::class);

    expect(fn () => app(VoidOrderItemAction::class)->execute(
        orderItemId: $firedItem->id,
        managerPin: '9999',
        reason: VoidReason::CustomerChangedMind,
        actorUserId: $waiter->id,
    ))->toThrow(InvalidManagerPinException::class);

    $voided = app(VoidOrderItemAction::class)->execute(
        orderItemId: $firedItem->id,
        managerPin: '1234',
        reason: VoidReason::CustomerChangedMind,
        actorUserId: $waiter->id,
    );

    expect($voided->prep_state)->toBe(ItemPrepState::Voided)
        ->and($voided->void_reason)->toBe(VoidReason::CustomerChangedMind)
        ->and($voided->was_in_prep_at_void)->toBeFalse()
        ->and($order->refresh()->total_cents)->toBe(0)
        ->and(AuditLog::query()->where('event_type', 'order_item_voided')->exists())->toBeTrue();

    Event::assertDispatched(OrderItemVoided::class, function (OrderItemVoided $event) use ($branch, $voided): bool {
        return $event->branchId === $branch->id
            && $event->orderItemId === $voided->id
            && $event->reason === VoidReason::CustomerChangedMind;
    });
});
