<?php

declare(strict_types=1);

use App\Modules\Floor\Enums\TableState;
use App\Modules\Floor\Models\DiningTable;
use App\Modules\Kitchen\Enums\ItemPrepState;
use App\Modules\Kitchen\Enums\VoidReason;
use App\Modules\Menu\Models\MenuItemVariant;
use App\Modules\Orders\Models\Order;
use App\Modules\Orders\Models\OrderItem;
use App\Modules\Shifts\Actions\CloseShiftAction;
use App\Modules\Shifts\Models\Shift;
use Database\Seeders\AureliaEnterpriseSeeder;
use Inertia\Testing\AssertableInertia as Assert;

it('renders FloorWorkspace and PosWorkspace with active branch tables, catalog, and open order tabs', function (): void {
    $this->seed(AureliaEnterpriseSeeder::class);
    $this->withoutVite();

    $this->get('/');

    $this->get('/floor')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Floor/FloorWorkspace')
            ->has('zones', 3)
            ->has('activeOrders')
        );

    $this->get('/pos')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Pos/PosWorkspace')
            ->has('catalog')
            ->has('zones', 3)
            ->has('activeOrders')
        );
});

it('fires a round, rejects invalid manager PIN void with 422, voids with valid PIN, and transfers tables over HTTP', function (): void {
    $this->seed(AureliaEnterpriseSeeder::class);
    $this->withoutVite();

    $this->get('/');

    $table1 = DiningTable::query()->where('code', 'M1')->firstOrFail();
    $table2 = DiningTable::query()->where('code', 'M2')->firstOrFail();
    $variant = MenuItemVariant::query()->where('sku', 'GRL-WAG-SGL')->firstOrFail();

    $this->post('/pos/orders', [
        'service_type' => 'dine_in',
        'table_id' => $table1->id,
        'guest_count' => 2,
    ])->assertRedirect();

    $order = Order::query()->latest('id')->firstOrFail();
    expect($table1->refresh()->state)->toBe(TableState::Occupied);

    $this->post("/pos/orders/{$order->id}/items", [
        'menu_item_variant_id' => $variant->id,
        'quantity' => 1,
        'seat_number' => 1,
    ])->assertRedirect();

    $item = OrderItem::query()->where('order_id', $order->id)->firstOrFail();

    $this->post("/pos/orders/{$order->id}/fire")->assertRedirect();
    expect($item->refresh()->prep_state)->toBe(ItemPrepState::Queued);

    $this->postJson("/pos/order-items/{$item->id}/void", [
        'manager_pin' => '0000',
        'reason' => VoidReason::CustomerChangedMind->value,
    ])->assertStatus(422)
        ->assertJsonValidationErrors('manager_pin');

    $this->post("/pos/order-items/{$item->id}/void", [
        'manager_pin' => '1234',
        'reason' => VoidReason::CustomerChangedMind->value,
    ])->assertRedirect();

    expect($item->refresh()->prep_state)->toBe(ItemPrepState::Voided);

    $this->post("/floor/orders/{$order->id}/transfer", [
        'target_table_id' => $table2->id,
        'mark_source_dirty' => false,
    ])->assertRedirect();

    expect($order->refresh()->table_id)->toBe($table2->id)
        ->and($table1->refresh()->state)->toBe(TableState::Available)
        ->and($table2->refresh()->state)->toBe(TableState::Occupied);

    // Closing the active shift triggers RequireOpenShiftMiddleware (409 JSON)
    $shift = Shift::query()->where('branch_id', $order->branch_id)->firstOrFail();
    app(CloseShiftAction::class)->execute($shift->id, $shift->expected_cash_cents);

    $this->postJson('/pos/orders', [
        'service_type' => 'takeaway',
        'customer_name' => 'Walk-in',
    ])->assertStatus(409);
});
