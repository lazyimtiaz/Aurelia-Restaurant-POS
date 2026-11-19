<?php

declare(strict_types=1);

use App\Modules\Audit\Models\AuditLog;
use App\Modules\Floor\Enums\TableState;
use App\Modules\Floor\Models\DiningTable;
use App\Modules\Identity\Enums\StaffRole;
use App\Modules\Menu\Enums\PrepStation;
use App\Modules\Menu\Models\MenuCategory;
use App\Modules\Menu\Models\MenuItem;
use App\Modules\Menu\Models\MenuItemVariant;
use App\Modules\Orders\Enums\OrderState;
use App\Modules\Orders\Models\Order;
use App\Modules\Orders\Models\OrderItem;
use Database\Seeders\AureliaEnterpriseSeeder;
use Inertia\Testing\AssertableInertia as Assert;

it('rejects non-enum void reasons cleanly and accepts VoidReason enum values', function (): void {
    $this->seed(AureliaEnterpriseSeeder::class);
    $this->withoutVite();

    signInAndUnlockAs($this, StaffRole::Cashier, '1111');

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
        'seat_number' => 1,
    ])->assertRedirect();

    $this->post("/pos/orders/{$order->id}/fire")->assertRedirect();
    $item = OrderItem::query()->where('order_id', $order->id)->firstOrFail();

    $this->postJson("/pos/order-items/{$item->id}/void", [
        'manager_pin' => '1234',
        'reason' => 'some free text reason',
    ])->assertStatus(422)->assertJsonValidationErrors(['reason']);

    $this->post("/pos/order-items/{$item->id}/void", [
        'manager_pin' => '1234',
        'reason' => 'customer_changed_mind',
    ])->assertRedirect();
});

it('updates draft cart item quantity and deletes item when quantity reaches zero', function (): void {
    $this->seed(AureliaEnterpriseSeeder::class);
    $this->withoutVite();

    signInAndUnlockAs($this, StaffRole::Cashier, '1111');

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
        'seat_number' => 1,
    ])->assertRedirect();

    $item = OrderItem::query()->where('order_id', $order->id)->firstOrFail();
    $singleSubtotal = $item->line_total_cents;

    $this->patch("/pos/order-items/{$item->id}", [
        'quantity' => 3,
    ])->assertRedirect();

    expect($item->refresh()->quantity)->toBe(3)
        ->and($order->refresh()->subtotal_cents)->toBe($singleSubtotal * 3);

    $this->patch("/pos/order-items/{$item->id}", [
        'quantity' => 0,
    ])->assertRedirect();

    expect(OrderItem::query()->find($item->id))->toBeNull()
        ->and($order->refresh()->subtotal_cents)->toBe(0);
});

it('cancels an unfired draft order, releases table, and blocks cancelling fired orders', function (): void {
    $this->seed(AureliaEnterpriseSeeder::class);
    $this->withoutVite();

    signInAndUnlockAs($this, StaffRole::Cashier, '1111');

    $table = DiningTable::query()->where('code', 'M1')->firstOrFail();
    $variant = MenuItemVariant::query()->where('sku', 'GRL-WAG-SGL')->firstOrFail();

    $this->post('/pos/orders', [
        'service_type' => 'dine_in',
        'table_id' => $table->id,
        'guest_count' => 2,
    ])->assertRedirect();

    $draftOrder = Order::query()->latest('id')->firstOrFail();
    expect($table->refresh()->state)->toBe(TableState::Occupied);

    $this->post("/pos/orders/{$draftOrder->id}/items", [
        'menu_item_variant_id' => $variant->id,
        'quantity' => 1,
        'seat_number' => 1,
    ])->assertRedirect();

    $this->delete("/pos/orders/{$draftOrder->id}")->assertRedirect();

    expect($draftOrder->refresh()->state)->toBe(OrderState::Voided)
        ->and($table->refresh()->state)->toBe(TableState::Available)
        ->and(AuditLog::query()->where('event_type', 'order.draft_cancelled')->where('auditable_id', (string) $draftOrder->id)->exists())->toBeTrue();

    // Now open and fire a new tab — cancelling should fail validation (422 JSON)
    $this->post('/pos/orders', [
        'service_type' => 'dine_in',
        'table_id' => $table->id,
        'guest_count' => 2,
    ])->assertRedirect();

    $firedOrder = Order::query()->latest('id')->firstOrFail();
    $this->post("/pos/orders/{$firedOrder->id}/items", [
        'menu_item_variant_id' => $variant->id,
        'quantity' => 1,
        'seat_number' => 1,
    ])->assertRedirect();
    $this->post("/pos/orders/{$firedOrder->id}/fire")->assertRedirect();

    $this->deleteJson("/pos/orders/{$firedOrder->id}")->assertStatus(422);
    expect($firedOrder->refresh()->state)->toBe(OrderState::Open);
});

it('creates a new menu item via /menu/items for authorized managers and blocks cashiers', function (): void {
    $this->seed(AureliaEnterpriseSeeder::class);
    $this->withoutVite();

    $category = MenuCategory::query()->firstOrFail();

    signInAndUnlockAs($this, StaffRole::Cashier, '1111');
    $this->post('/menu/items', [
        'menu_category_id' => $category->id,
        'name' => 'Forbidden Dish',
        'prep_station' => PrepStation::Grill->value,
        'sku' => 'FORB-001',
        'base_price_cents' => 1500,
    ])->assertForbidden();

    signInAndUnlockAs($this, StaffRole::BranchManager, '1234');
    $this->post('/menu/items', [
        'menu_category_id' => $category->id,
        'name' => 'Truffle Wild Mushroom Risotto',
        'description' => 'Acquerello rice, black truffle butter, aged Parmigiano.',
        'prep_station' => PrepStation::Grill->value,
        'variant_name' => 'Regular Plate',
        'sku' => 'GRL-RIS-STD',
        'base_price_cents' => 2850,
    ])->assertRedirect();

    $createdItem = MenuItem::query()->where('name', 'Truffle Wild Mushroom Risotto')->firstOrFail();
    $variant = MenuItemVariant::query()->where('sku', 'GRL-RIS-STD')->firstOrFail();

    expect($variant->menu_item_id)->toBe($createdItem->id)
        ->and($variant->base_price_cents)->toBe(2850)
        ->and(AuditLog::query()->where('event_type', 'menu.item_created')->where('auditable_id', (string) $createdItem->id)->exists())->toBeTrue();
});

it('loads all branch KDS tickets for assigned chef while keeping assigned activeStation default', function (): void {
    $this->seed(AureliaEnterpriseSeeder::class);
    $this->withoutVite();

    signInAndUnlockAs($this, StaffRole::Chef, '3333');

    $this->get('/kitchen')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Kitchen/KitchenPage')
            ->where('activeStation', 'grill')
            ->has('tickets', 1)
            ->has('tickets.0.items', 2)
        );
});
