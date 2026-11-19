<?php

declare(strict_types=1);

use App\Modules\Billing\Enums\BillSplitState;
use App\Modules\Billing\Enums\PaymentState;
use App\Modules\Billing\Models\BillSplit;
use App\Modules\Billing\Models\PaymentTransaction;
use App\Modules\Floor\Enums\TableState;
use App\Modules\Floor\Models\DiningTable;
use App\Modules\Identity\Enums\StaffRole;
use App\Modules\Menu\Models\MenuItemVariant;
use App\Modules\Orders\Enums\OrderState;
use App\Modules\Orders\Models\Order;
use App\Modules\Shifts\Enums\ShiftState;
use App\Modules\Shifts\Models\Shift;
use Database\Seeders\AureliaEnterpriseSeeder;
use Inertia\Testing\AssertableInertia as Assert;

it('executes orders board, split billing, card terminal decline recovery, receipt fetch, refund, and blind shift close over HTTP', function (): void {
    $this->seed(AureliaEnterpriseSeeder::class);
    $this->withoutVite();

    signInAndUnlockAs($this, StaffRole::Cashier, '1111');

    $this->get('/orders')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Orders/OrdersPage')
            ->has('orders')
        );

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
        'quantity' => 2,
    ])->assertRedirect();
    $this->post("/pos/orders/{$order->id}/fire")->assertRedirect();

    $this->post("/billing/orders/{$order->id}/request-bill")->assertRedirect();
    expect($order->refresh()->state)->toBe(OrderState::Billing);

    $this->post("/billing/orders/{$order->id}/split", [
        'mode' => 'equal',
        'equal_ways' => 2,
    ])->assertRedirect();

    $splits = BillSplit::query()->where('order_id', $order->id)->orderBy('sequence_number')->get();
    expect($splits)->toHaveCount(2);

    // Check 1 declines on Simulated Card Terminal -> commits Failed payment & BillSplitState::Failed
    $this->postJson("/billing/splits/{$splits[0]->id}/pay", [
        'tender_method' => 'card',
        'amount_tendered_cents' => $splits[0]->total_cents,
        'tip_cents' => 0,
        'idempotency_key' => 'http-fail-key-1',
        'simulate_decline' => true,
    ])->assertStatus(422);

    expect($splits[0]->refresh()->state)->toBe(BillSplitState::Failed);

    // Retry Check 1 approved, then settle Check 2 with Cash
    $this->post("/billing/splits/{$splits[0]->id}/pay", [
        'tender_method' => 'card',
        'amount_tendered_cents' => $splits[0]->total_cents,
        'tip_cents' => 200,
        'idempotency_key' => 'http-ok-key-1',
        'simulate_decline' => false,
    ])->assertRedirect();

    expect($order->refresh()->state)->toBe(OrderState::PartiallyPaid);

    $this->post("/billing/splits/{$splits[1]->id}/pay", [
        'tender_method' => 'cash',
        'amount_tendered_cents' => $splits[1]->total_cents,
        'tip_cents' => 0,
        'idempotency_key' => 'http-ok-key-2',
    ])->assertRedirect();

    expect($order->refresh()->state)->toBe(OrderState::Paid)
        ->and($table->refresh()->state)->toBe(TableState::Dirty);

    // Fetch thermal receipt JSON payload
    $this->getJson("/billing/splits/{$splits[0]->id}/receipt")
        ->assertOk()
        ->assertJsonPath('orderNumber', $order->order_number)
        ->assertJsonPath('tipCents', 200);

    // Issue partial Manager-PIN refund on Check 1 payment
    $capturedTx = PaymentTransaction::query()
        ->where('bill_split_id', $splits[0]->id)
        ->where('state', PaymentState::Captured->value)
        ->firstOrFail();

    $this->post("/billing/payments/{$capturedTx->id}/refund", [
        'refund_amount_cents' => 500,
        'manager_pin' => '1234',
        'reason' => 'Guest dissatisfaction',
        'wastage' => false,
    ])->assertRedirect();

    expect(PaymentTransaction::query()->where('parent_transaction_id', $capturedTx->id)->exists())->toBeTrue();

    // Render ShiftsPage, close active shift with blind cash variance, and approve via Manager PIN
    $this->get('/shifts')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Shifts/ShiftsPage')
            ->has('shifts')
        );

    $openShift = Shift::query()->where('state', ShiftState::Open->value)->firstOrFail();

    $this->post("/shifts/{$openShift->id}/close", [
        'counted_cash_cents' => 0,
        'notes' => 'End of night variance test',
    ])->assertRedirect();

    expect($openShift->refresh()->state)->toBe(ShiftState::VarianceFlagged);

    $this->post("/shifts/{$openShift->id}/approve-variance", [
        'manager_pin' => '1234',
        'resolution_note' => 'Verified safe drop envelope',
    ])->assertRedirect();

    expect($openShift->refresh()->state)->toBe(ShiftState::Closed);
});
