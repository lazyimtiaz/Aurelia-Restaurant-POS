<?php

declare(strict_types=1);

use App\Models\User;
use App\Modules\Audit\Models\AuditLog;
use App\Modules\Floor\Enums\TableState;
use App\Modules\Floor\Exceptions\TableNotAvailableException;
use App\Modules\Floor\Models\DiningTable;
use App\Modules\Floor\Models\FloorZone;
use App\Modules\Identity\Enums\StaffRole;
use App\Modules\Identity\Exceptions\InvalidManagerPinException;
use App\Modules\Menu\Actions\ToggleBranchItemAvailabilityAction;
use App\Modules\Menu\Enums\PrepStation;
use App\Modules\Menu\Models\MenuCategory;
use App\Modules\Menu\Models\MenuItem;
use App\Modules\Menu\Models\MenuItemVariant;
use App\Modules\Menu\Models\ModifierGroup;
use App\Modules\Menu\Models\ModifierOption;
use App\Modules\Orders\Actions\AddDraftOrderItemAction;
use App\Modules\Orders\Actions\ApplyOrderDiscountAction;
use App\Modules\Orders\Actions\OpenOrderTabAction;
use App\Modules\Orders\Actions\RemoveDraftOrderItemAction;
use App\Modules\Orders\DTOs\OrderItemInputData;
use App\Modules\Orders\Enums\OrderState;
use App\Modules\Orders\Enums\ServiceType;
use App\Modules\Restaurant\Models\Branch;
use App\Modules\Shifts\Actions\CloseShiftAction;
use App\Modules\Shifts\Actions\OpenShiftAction;
use Illuminate\Support\Facades\Hash;

it('opens a dine-in tab locking the table as Occupied and rejects opening without an active Open shift', function (): void {
    $branch = Branch::create(['code' => 'DTF', 'name' => 'Downtown Flagship']);
    $zone = FloorZone::create(['branch_id' => $branch->id, 'name' => 'Main', 'sort_order' => 1]);
    $table = DiningTable::create([
        'branch_id' => $branch->id,
        'floor_zone_id' => $zone->id,
        'code' => 'M1',
        'capacity' => 4,
        'state' => TableState::Available,
    ]);
    $waiter = User::factory()->create(['branch_id' => $branch->id, 'role' => StaffRole::Waiter]);
    $shift = app(OpenShiftAction::class)->execute($branch->id, $waiter->id, 20000);

    $order = app(OpenOrderTabAction::class)->execute(
        branchId: $branch->id,
        shiftId: $shift->id,
        serverId: $waiter->id,
        serviceType: ServiceType::DineIn,
        tableId: $table->id,
        guestCount: 3,
    );

    expect($order->state)->toBe(OrderState::Draft)
        ->and($table->refresh()->state)->toBe(TableState::Occupied)
        ->and($table->current_guest_count)->toBe(3);

    expect(fn () => app(OpenOrderTabAction::class)->execute(
        branchId: $branch->id,
        shiftId: $shift->id,
        serverId: $waiter->id,
        serviceType: ServiceType::DineIn,
        tableId: $table->id,
    ))->toThrow(TableNotAvailableException::class);

    app(CloseShiftAction::class)->execute($shift->id, 20000);

    expect(fn () => app(OpenOrderTabAction::class)->execute(
        branchId: $branch->id,
        shiftId: $shift->id,
        serverId: $waiter->id,
        serviceType: ServiceType::Takeaway,
        customerName: 'Alex',
    ))->toThrow(DomainException::class);
});

it('rejects adding an 86d unavailable branch menu item to the cart and supports removing draft items', function (): void {
    $branch = Branch::create(['code' => 'DTF', 'name' => 'Downtown Flagship']);
    $manager = User::factory()->create(['branch_id' => $branch->id, 'role' => StaffRole::BranchManager]);
    $cashier = User::factory()->create(['branch_id' => $branch->id, 'role' => StaffRole::Cashier]);
    $shift = app(OpenShiftAction::class)->execute($branch->id, $cashier->id, 20000);

    $category = MenuCategory::create(['name' => 'Mains', 'slug' => 'mains', 'sort_order' => 1]);
    $item = MenuItem::create(['menu_category_id' => $category->id, 'name' => 'Burger', 'slug' => 'burger', 'prep_station' => PrepStation::Grill]);
    $variant = MenuItemVariant::create(['menu_item_id' => $item->id, 'name' => 'Single', 'sku' => 'BRG-1', 'base_price_cents' => 1900]);
    $modGroup = ModifierGroup::create(['name' => 'Addons', 'min_select' => 0, 'max_select' => 2]);
    $cheese = ModifierOption::create(['modifier_group_id' => $modGroup->id, 'name' => 'Cheddar', 'price_delta_cents' => 250]);
    $item->modifierGroups()->attach($modGroup->id);

    $order = app(OpenOrderTabAction::class)->execute(
        branchId: $branch->id,
        shiftId: $shift->id,
        serverId: $cashier->id,
        serviceType: ServiceType::Takeaway,
        customerName: 'Sam',
    );

    $draftItem = app(AddDraftOrderItemAction::class)->execute($order->id, new OrderItemInputData(
        menuItemVariantId: $variant->id,
        quantity: 2,
        modifierOptionIds: [$cheese->id],
        seatNumber: 1,
        specialInstructions: 'No pickles',
    ));

    expect($draftItem->line_total_cents)->toBe((1900 + 250) * 2)
        ->and($order->refresh()->subtotal_cents)->toBe(4300);

    $afterDelete = app(RemoveDraftOrderItemAction::class)->execute($draftItem->id);
    expect($afterDelete->subtotal_cents)->toBe(0)
        ->and($afterDelete->total_cents)->toBe(0);

    app(ToggleBranchItemAvailabilityAction::class)->execute($branch->id, $variant->id, false, 'Out of beef', $manager->id);

    expect(fn () => app(AddDraftOrderItemAction::class)->execute($order->id, new OrderItemInputData(
        menuItemVariantId: $variant->id,
        quantity: 1,
    )))->toThrow(DomainException::class);
});

it('gates discounts above branch discount_pin_threshold_bps (1500 bps) behind Manager PIN verification', function (): void {
    $branch = Branch::create([
        'code' => 'DTF',
        'name' => 'Downtown Flagship',
        'tax_rate_bps' => 825,
        'service_charge_bps' => 500,
        'discount_pin_threshold_bps' => 1500,
    ]);
    User::factory()->create([
        'branch_id' => $branch->id,
        'role' => StaffRole::BranchManager,
        'pin_hash' => Hash::make('1234'),
    ]);
    $cashier = User::factory()->create(['branch_id' => $branch->id, 'role' => StaffRole::Cashier]);
    $shift = app(OpenShiftAction::class)->execute($branch->id, $cashier->id, 20000);

    $category = MenuCategory::create(['name' => 'Steak', 'slug' => 'steak', 'sort_order' => 1]);
    $item = MenuItem::create(['menu_category_id' => $category->id, 'name' => 'Ribeye', 'slug' => 'ribeye', 'prep_station' => PrepStation::Grill]);
    $variant = MenuItemVariant::create(['menu_item_id' => $item->id, 'name' => '300g', 'sku' => 'RIB-300', 'base_price_cents' => 10000]);

    $order = app(OpenOrderTabAction::class)->execute(
        branchId: $branch->id,
        shiftId: $shift->id,
        serverId: $cashier->id,
        serviceType: ServiceType::Takeaway,
        customerName: 'VIP',
    );
    app(AddDraftOrderItemAction::class)->execute($order->id, new OrderItemInputData($variant->id, 1));

    $tenPercent = app(ApplyOrderDiscountAction::class)->execute($order->id, 1000, $cashier->id);
    expect($tenPercent->discount_cents)->toBe(1000)
        ->and($tenPercent->service_charge_cents)->toBe(450)
        ->and($tenPercent->tax_cents)->toBe(743)
        ->and($tenPercent->total_cents)->toBe(10193);

    expect(fn () => app(ApplyOrderDiscountAction::class)->execute($order->id, 2000, $cashier->id))
        ->toThrow(InvalidManagerPinException::class);

    $twentyPercent = app(ApplyOrderDiscountAction::class)->execute($order->id, 2000, $cashier->id, '1234');
    expect($twentyPercent->discount_cents)->toBe(2000)
        ->and($twentyPercent->service_charge_cents)->toBe(400)
        ->and($twentyPercent->tax_cents)->toBe(660)
        ->and($twentyPercent->total_cents)->toBe(9060)
        ->and(AuditLog::query()->where('event_type', 'order_discount_applied')->exists())->toBeTrue();
});
