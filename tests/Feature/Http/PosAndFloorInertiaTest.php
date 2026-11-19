<?php

declare(strict_types=1);

use App\Modules\Floor\Enums\TableState;
use App\Modules\Floor\Models\DiningTable;
use App\Modules\Identity\Enums\StaffRole;
use App\Modules\Kitchen\Enums\ItemPrepState;
use App\Modules\Kitchen\Enums\VoidReason;
use App\Modules\Menu\Models\MenuItemVariant;
use App\Modules\Orders\Models\Order;
use App\Modules\Orders\Models\OrderItem;
use Database\Seeders\AureliaEnterpriseSeeder;
use Inertia\Testing\AssertableInertia as Assert;

it('renders TablesPage and PosPage with active branch tables, catalog, and open tabs', function (): void {
    $this->seed(AureliaEnterpriseSeeder::class);
    $this->withoutVite();

    signInAndUnlockAs($this, StaffRole::Waiter, '2222');

    $this->get('/tables')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Tables/TablesPage')
            ->has('zones', 3)
            ->has('activeOrders')
        );

    $this->get('/pos')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Pos/PosPage')
            ->has('catalog')
            ->has('zones', 3)
            ->has('activeOrders')
        );
});

it('blocks unauthorized roles from /pos and /tables with 403', function (): void {
    $this->seed(AureliaEnterpriseSeeder::class);
    $this->withoutVite();

    signInAndUnlockAs($this, StaffRole::Chef, '3333');
    $this->get('/pos')->assertForbidden();
    $this->get('/tables')->assertForbidden();
});

it('fires a round, rejects invalid manager PIN void with 422, voids with valid PIN, and transfers tables over HTTP', function (): void {
    $this->seed(AureliaEnterpriseSeeder::class);
    $this->withoutVite();

    signInAndUnlockAs($this, StaffRole::Cashier, '1111');

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
        'quantity' => 2,
        'seat_number' => 1,
    ])->assertRedirect();

    $this->post("/pos/orders/{$order->id}/fire")->assertRedirect();

    $item = OrderItem::query()->where('order_id', $order->id)->firstOrFail();
    expect($item->prep_state)->toBe(ItemPrepState::Queued);

    $this->postJson("/pos/order-items/{$item->id}/void", [
        'manager_pin' => '9999',
        'reason' => VoidReason::OrderMistake->value,
    ])->assertStatus(422);

    $this->post("/pos/order-items/{$item->id}/void", [
        'manager_pin' => '1234',
        'reason' => VoidReason::OrderMistake->value,
    ])->assertRedirect();

    expect($item->refresh()->prep_state)->toBe(ItemPrepState::Voided);

    $this->post("/tables/orders/{$order->id}/transfer", [
        'target_table_id' => $table2->id,
        'mark_source_dirty' => false,
    ])->assertRedirect();

    expect($order->refresh()->table_id)->toBe($table2->id)
        ->and($table1->refresh()->state)->toBe(TableState::Available)
        ->and($table2->refresh()->state)->toBe(TableState::Occupied);
});
