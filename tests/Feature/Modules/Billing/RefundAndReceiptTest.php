<?php

declare(strict_types=1);

use App\Models\User;
use App\Modules\Audit\Models\AuditLog;
use App\Modules\Billing\Actions\BuildThermalReceiptAction;
use App\Modules\Billing\Actions\RefundPaymentAction;
use App\Modules\Billing\Actions\RequestOrderBillAction;
use App\Modules\Billing\Actions\SettleBillSplitAction;
use App\Modules\Billing\DTOs\RefundPaymentData;
use App\Modules\Billing\DTOs\SettleBillSplitData;
use App\Modules\Billing\Enums\PaymentState;
use App\Modules\Billing\Enums\TenderMethod;
use App\Modules\Billing\Exceptions\RefundExceedsCapturedAmountException;
use App\Modules\Billing\Models\PaymentTransaction;
use App\Modules\Identity\Enums\StaffRole;
use App\Modules\Identity\Exceptions\InvalidManagerPinException;
use App\Modules\Menu\Enums\PrepStation;
use App\Modules\Menu\Models\MenuCategory;
use App\Modules\Menu\Models\MenuItem;
use App\Modules\Menu\Models\MenuItemVariant;
use App\Modules\Orders\Actions\AddDraftOrderItemAction;
use App\Modules\Orders\Actions\FireOrderRoundAction;
use App\Modules\Orders\Actions\OpenOrderTabAction;
use App\Modules\Orders\DTOs\OrderItemInputData;
use App\Modules\Orders\Enums\ServiceType;
use App\Modules\Restaurant\Models\Branch;
use App\Modules\Shifts\Actions\OpenShiftAction;
use App\Modules\Shifts\Models\Shift;
use Illuminate\Support\Facades\Hash;

it('creates an immutable negative Refunded transaction, adjusts cash drawer, logs audit, and blocks over-refunds', function (): void {
    $branch = Branch::create(['code' => 'DTF', 'name' => 'Downtown Flagship', 'tax_rate_bps' => 0, 'service_charge_bps' => 0]);
    User::factory()->create([
        'branch_id' => $branch->id,
        'role' => StaffRole::BranchManager,
        'pin_hash' => Hash::make('1234'),
    ]);
    $cashier = User::factory()->create(['branch_id' => $branch->id, 'role' => StaffRole::Cashier]);
    $shift = app(OpenShiftAction::class)->execute($branch->id, $cashier->id, 20000);

    $cat = MenuCategory::create(['name' => 'Mains', 'slug' => 'mains', 'sort_order' => 1]);
    $dish = MenuItem::create(['menu_category_id' => $cat->id, 'name' => 'Steak', 'slug' => 'steak', 'prep_station' => PrepStation::Grill]);
    $variant = MenuItemVariant::create(['menu_item_id' => $dish->id, 'name' => '300g', 'sku' => 'STK-1', 'base_price_cents' => 5000]);

    $order = app(OpenOrderTabAction::class)->execute($branch->id, $shift->id, $cashier->id, ServiceType::Takeaway, customerName: 'Refund Guest');
    app(AddDraftOrderItemAction::class)->execute($order->id, new OrderItemInputData($variant->id, 1));
    app(FireOrderRoundAction::class)->execute($order->id, $cashier->id);
    $billingOrder = app(RequestOrderBillAction::class)->execute($order->id);
    $split = $billingOrder->billSplits->firstOrFail();

    $payment = app(SettleBillSplitAction::class)->execute(new SettleBillSplitData(
        billSplitId: $split->id,
        shiftId: $shift->id,
        actorUserId: $cashier->id,
        tenderMethod: TenderMethod::Cash,
        amountTenderedCents: 5000,
        tipCents: 0,
        idempotencyKey: 'pay-5000',
    ));

    expect(Shift::query()->findOrFail($shift->id)->expected_cash_cents)->toBe(25000);

    expect(fn () => app(RefundPaymentAction::class)->execute(new RefundPaymentData(
        paymentTransactionId: $payment->id,
        refundAmountCents: 5000,
        managerPin: '9999',
        actorUserId: $cashier->id,
        reason: 'Wrong order',
        wastage: true,
        activeShiftId: $shift->id,
    )))->toThrow(InvalidManagerPinException::class);

    $refundTx = app(RefundPaymentAction::class)->execute(new RefundPaymentData(
        paymentTransactionId: $payment->id,
        refundAmountCents: 5000,
        managerPin: '1234',
        actorUserId: $cashier->id,
        reason: 'Overcooked',
        wastage: true,
        activeShiftId: $shift->id,
    ));

    expect($refundTx->amount_cents)->toBe(-5000)
        ->and($refundTx->state)->toBe(PaymentState::Refunded)
        ->and($refundTx->parent_transaction_id)->toBe($payment->id)
        ->and($refundTx->refunded_with_wastage)->toBeTrue()
        ->and($payment->refresh()->state)->toBe(PaymentState::Captured)
        ->and(Shift::query()->findOrFail($shift->id)->expected_cash_cents)->toBe(20000)
        ->and(AuditLog::query()->where('event_type', 'payment_refunded')->exists())->toBeTrue();

    expect(fn () => app(RefundPaymentAction::class)->execute(new RefundPaymentData(
        paymentTransactionId: $payment->id,
        refundAmountCents: 100,
        managerPin: '1234',
        actorUserId: $cashier->id,
        reason: 'Duplicate refund',
        wastage: false,
        activeShiftId: $shift->id,
    )))->toThrow(RefundExceedsCapturedAmountException::class);
});

it('builds an itemized thermal receipt payload with branch info, split share, tax, tip, and tender summary', function (): void {
    $branch = Branch::create(['code' => 'DTF', 'name' => 'Downtown Flagship', 'tax_rate_bps' => 825, 'service_charge_bps' => 500]);
    $cashier = User::factory()->create(['branch_id' => $branch->id, 'role' => StaffRole::Cashier]);
    $shift = app(OpenShiftAction::class)->execute($branch->id, $cashier->id, 20000);

    $cat = MenuCategory::create(['name' => 'Mains', 'slug' => 'mains', 'sort_order' => 1]);
    $dish = MenuItem::create(['menu_category_id' => $cat->id, 'name' => 'Ribeye', 'slug' => 'ribeye', 'prep_station' => PrepStation::Grill]);
    $variant = MenuItemVariant::create(['menu_item_id' => $dish->id, 'name' => '300g', 'sku' => 'RIB-300', 'base_price_cents' => 4000]);

    $order = app(OpenOrderTabAction::class)->execute($branch->id, $shift->id, $cashier->id, ServiceType::Takeaway, customerName: 'Morgan');
    app(AddDraftOrderItemAction::class)->execute($order->id, new OrderItemInputData($variant->id, 1));
    app(FireOrderRoundAction::class)->execute($order->id, $cashier->id);
    $billingOrder = app(RequestOrderBillAction::class)->execute($order->id);
    $split = $billingOrder->billSplits->firstOrFail();

    app(SettleBillSplitAction::class)->execute(new SettleBillSplitData(
        billSplitId: $split->id,
        shiftId: $shift->id,
        actorUserId: $cashier->id,
        tenderMethod: TenderMethod::Card,
        amountTenderedCents: $split->total_cents + 500,
        tipCents: 500,
        idempotencyKey: 'receipt-test-1',
    ));

    $receipt = app(BuildThermalReceiptAction::class)->execute($split->id);

    expect($receipt->branchCode)->toBe('DTF')
        ->and($receipt->customerName)->toBe('Morgan')
        ->and($receipt->subtotalCents)->toBe(4000)
        ->and($receipt->serviceChargeCents)->toBe(200)
        ->and($receipt->taxCents)->toBe(330)
        ->and($receipt->tipCents)->toBe(500)
        ->and($receipt->totalCents)->toBe(4530)
        ->and($receipt->lineItems)->toHaveCount(1)
        ->and($receipt->payments)->toHaveCount(1);
});
