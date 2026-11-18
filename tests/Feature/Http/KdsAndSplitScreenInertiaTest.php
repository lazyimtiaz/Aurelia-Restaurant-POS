<?php

declare(strict_types=1);

use App\Modules\Floor\Models\DiningTable;
use App\Modules\Kitchen\Enums\ItemPrepState;
use App\Modules\Kitchen\Enums\TicketState;
use App\Modules\Kitchen\Models\KitchenTicket;
use App\Modules\Menu\Models\MenuItemVariant;
use App\Modules\Orders\Models\Order;
use App\Modules\Orders\Models\OrderItem;
use Database\Seeders\AureliaEnterpriseSeeder;
use Inertia\Testing\AssertableInertia as Assert;

it('renders KdsWorkspace and SplitScreenDemoWorkspace with live branch catalog, tables, and active kitchen tickets', function (): void {
    $this->seed(AureliaEnterpriseSeeder::class);
    $this->withoutVite();

    $this->get('/');

    $this->get('/kds')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Kds/KdsWorkspace')
            ->has('tickets')
            ->has('stations')
        );

    $this->get('/demo/split-screen')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Evaluator/SplitScreenDemoWorkspace')
            ->has('catalog')
            ->has('zones', 3)
            ->has('activeOrders')
            ->has('tickets')
        );
});

it('bumps kitchen items, blocks premature serve with 422, and serves completed tickets via HTTP KDS endpoints', function (): void {
    $this->seed(AureliaEnterpriseSeeder::class);
    $this->withoutVite();

    $this->get('/');

    $table = DiningTable::query()->where('code', 'M1')->firstOrFail();
    $variant = MenuItemVariant::query()->where('sku', 'GRL-WAG-SGL')->firstOrFail();

    $this->post('/pos/orders', [
        'service_type' => 'dine_in',
        'table_id' => $table->id,
        'guest_count' => 2,
    ])->assertRedirect();

    $order = Order::query()->latest('id')->firstOrFail();
    $this->post("/pos/orders/{$order->id}/items", [
        'menu_item_variant_id' => $variant->id,
        'quantity' => 1,
    ])->assertRedirect();
    $this->post("/pos/orders/{$order->id}/fire")->assertRedirect();

    $ticket = KitchenTicket::query()->where('order_id', $order->id)->firstOrFail();
    $item = OrderItem::query()->where('kitchen_ticket_id', $ticket->id)->firstOrFail();

    $this->postJson("/kds/tickets/{$ticket->id}/serve")
        ->assertStatus(422);

    $this->post("/kds/items/{$item->id}/bump", ['target_state' => ItemPrepState::InPrep->value])
        ->assertRedirect();
    expect($item->refresh()->prep_state)->toBe(ItemPrepState::InPrep);

    $this->post("/kds/items/{$item->id}/bump", ['target_state' => ItemPrepState::Ready->value])
        ->assertRedirect();
    expect($ticket->refresh()->state)->toBe(TicketState::Ready);

    $this->post("/kds/tickets/{$ticket->id}/serve")->assertRedirect();
    expect($ticket->refresh()->state)->toBe(TicketState::Served);
});
