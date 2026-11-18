<?php

declare(strict_types=1);

use App\Models\User;
use App\Modules\Identity\Enums\StaffRole;
use App\Modules\Kitchen\Actions\BumpKitchenItemStatusAction;
use App\Modules\Kitchen\Actions\ServeKitchenTicketExpoAction;
use App\Modules\Kitchen\Enums\ItemPrepState;
use App\Modules\Kitchen\Enums\TicketState;
use App\Modules\Kitchen\Enums\VoidReason;
use App\Modules\Kitchen\Events\KitchenItemStatusUpdated;
use App\Modules\Kitchen\Events\TicketExpoServed;
use App\Modules\Kitchen\Exceptions\TicketNotReadyForExpoException;
use App\Modules\Kitchen\Queries\GetActiveKdsTicketsQuery;
use App\Modules\Menu\Enums\PrepStation;
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

it('advances ticket to Ready only when all non-voided items across stations reach Ready and blocks premature Expo serve', function (): void {
    Event::fake([KitchenItemStatusUpdated::class, TicketExpoServed::class]);

    $branch = Branch::create(['code' => 'DTF', 'name' => 'Downtown Flagship']);
    $chef = User::factory()->create(['branch_id' => $branch->id, 'role' => StaffRole::Chef]);
    $expo = User::factory()->create(['branch_id' => $branch->id, 'role' => StaffRole::KitchenExpediter]);
    $waiter = User::factory()->create(['branch_id' => $branch->id, 'role' => StaffRole::Waiter]);
    $shift = app(OpenShiftAction::class)->execute($branch->id, $waiter->id, 20000);

    $cat = MenuCategory::create(['name' => 'All', 'slug' => 'all', 'sort_order' => 1]);
    $steak = MenuItem::create(['menu_category_id' => $cat->id, 'name' => 'Steak', 'slug' => 'steak', 'prep_station' => PrepStation::Grill]);
    $steakVar = MenuItemVariant::create(['menu_item_id' => $steak->id, 'name' => '300g', 'sku' => 'STK-300', 'base_price_cents' => 4200]);
    $spritz = MenuItem::create(['menu_category_id' => $cat->id, 'name' => 'Spritz', 'slug' => 'spritz', 'prep_station' => PrepStation::Bar]);
    $spritzVar = MenuItemVariant::create(['menu_item_id' => $spritz->id, 'name' => 'Glass', 'sku' => 'BAR-1', 'base_price_cents' => 1250]);

    $order = app(OpenOrderTabAction::class)->execute($branch->id, $shift->id, $waiter->id, ServiceType::Takeaway, customerName: 'Jordan');
    $grillItem = app(AddDraftOrderItemAction::class)->execute($order->id, new OrderItemInputData($steakVar->id, 1));
    $barItem = app(AddDraftOrderItemAction::class)->execute($order->id, new OrderItemInputData($spritzVar->id, 1));

    $ticket = app(FireOrderRoundAction::class)->execute($order->id, $waiter->id);

    $bump = app(BumpKitchenItemStatusAction::class);
    $afterGrillStart = $bump->execute($grillItem->id, ItemPrepState::InPrep, $chef->id);
    expect($afterGrillStart->state)->toBe(TicketState::InPrep);

    $afterGrillReady = $bump->execute($grillItem->id, ItemPrepState::Ready, $chef->id);
    expect($afterGrillReady->state)->toBe(TicketState::InPrep);

    expect(fn () => app(ServeKitchenTicketExpoAction::class)->execute($ticket->id, $expo->id))
        ->toThrow(TicketNotReadyForExpoException::class);

    $bump->execute($barItem->id, ItemPrepState::InPrep, $chef->id);
    $afterBarReady = $bump->execute($barItem->id, ItemPrepState::Ready, $chef->id);

    expect($afterBarReady->state)->toBe(TicketState::Ready)
        ->and($afterBarReady->ready_at)->not->toBeNull();

    Event::assertDispatched(KitchenItemStatusUpdated::class);

    $served = app(ServeKitchenTicketExpoAction::class)->execute($ticket->id, $expo->id);

    expect($served->state)->toBe(TicketState::Served)
        ->and($served->served_at)->not->toBeNull()
        ->and($grillItem->refresh()->prep_state)->toBe(ItemPrepState::Served)
        ->and($barItem->refresh()->prep_state)->toBe(ItemPrepState::Served);

    Event::assertDispatched(TicketExpoServed::class, function (TicketExpoServed $event) use ($branch, $ticket): bool {
        $channels = array_map(fn ($ch) => $ch->name, $event->broadcastOn());

        return $event->branchId === $branch->id
            && $event->kitchenTicketId === $ticket->id
            && in_array("private-branch.{$branch->id}.kds", $channels, true)
            && in_array("private-branch.{$branch->id}.pos", $channels, true)
            && in_array("private-branch.{$branch->id}.floor", $channels, true);
    });
});

it('filters active KDS tickets by PrepStation while keeping consolidated view for Expo and advances ticket Ready when unready item is voided', function (): void {
    $branch = Branch::create(['code' => 'DTF', 'name' => 'Downtown Flagship']);
    User::factory()->create(['branch_id' => $branch->id, 'role' => StaffRole::BranchManager, 'pin_hash' => Hash::make('1234')]);
    $chef = User::factory()->create(['branch_id' => $branch->id, 'role' => StaffRole::Chef]);
    $waiter = User::factory()->create(['branch_id' => $branch->id, 'role' => StaffRole::Waiter]);
    $shift = app(OpenShiftAction::class)->execute($branch->id, $waiter->id, 20000);

    $cat = MenuCategory::create(['name' => 'All', 'slug' => 'all', 'sort_order' => 1]);
    $steak = MenuItem::create(['menu_category_id' => $cat->id, 'name' => 'Steak', 'slug' => 'steak', 'prep_station' => PrepStation::Grill]);
    $steakVar = MenuItemVariant::create(['menu_item_id' => $steak->id, 'name' => '300g', 'sku' => 'STK-300', 'base_price_cents' => 4200]);
    $spritz = MenuItem::create(['menu_category_id' => $cat->id, 'name' => 'Spritz', 'slug' => 'spritz', 'prep_station' => PrepStation::Bar]);
    $spritzVar = MenuItemVariant::create(['menu_item_id' => $spritz->id, 'name' => 'Glass', 'sku' => 'BAR-1', 'base_price_cents' => 1250]);

    $order = app(OpenOrderTabAction::class)->execute($branch->id, $shift->id, $waiter->id, ServiceType::Takeaway, customerName: 'Casey');
    $grillItem = app(AddDraftOrderItemAction::class)->execute($order->id, new OrderItemInputData($steakVar->id, 1));
    $barItem = app(AddDraftOrderItemAction::class)->execute($order->id, new OrderItemInputData($spritzVar->id, 1));
    $ticket = app(FireOrderRoundAction::class)->execute($order->id, $waiter->id);

    $grillOnly = app(GetActiveKdsTicketsQuery::class)->execute($branch->id, PrepStation::Grill);
    expect($grillOnly)->toHaveCount(1)
        ->and($grillOnly->first()['items'])->toHaveCount(1)
        ->and($grillOnly->first()['items'][0]['prep_station'])->toBe(PrepStation::Grill->value);

    $allExpo = app(GetActiveKdsTicketsQuery::class)->execute($branch->id);
    expect($allExpo->first()['items'])->toHaveCount(2);

    $bump = app(BumpKitchenItemStatusAction::class);
    $bump->execute($grillItem->id, ItemPrepState::InPrep, $chef->id);
    $bump->execute($grillItem->id, ItemPrepState::Ready, $chef->id);

    // Voiding the remaining Bar item makes all remaining non-voided items Ready -> ticket advances to Ready
    app(VoidOrderItemAction::class)->execute($barItem->id, '1234', VoidReason::CustomerChangedMind, $waiter->id);

    expect($ticket->refresh()->state)->toBe(TicketState::Ready);
});
