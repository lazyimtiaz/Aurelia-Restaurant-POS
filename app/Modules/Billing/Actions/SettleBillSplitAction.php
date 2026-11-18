<?php

declare(strict_types=1);

namespace App\Modules\Billing\Actions;

use App\Modules\Billing\Contracts\PaymentGatewayInterface;
use App\Modules\Billing\DTOs\SettleBillSplitData;
use App\Modules\Billing\Enums\BillSplitState;
use App\Modules\Billing\Enums\PaymentState;
use App\Modules\Billing\Enums\TenderMethod;
use App\Modules\Billing\Events\PaymentCaptured;
use App\Modules\Billing\Models\BillSplit;
use App\Modules\Billing\Models\PaymentTransaction;
use App\Modules\Floor\Enums\TableState;
use App\Modules\Floor\Events\TableOccupancyChanged;
use App\Modules\Floor\Models\DiningTable;
use App\Modules\Orders\Enums\OrderState;
use App\Modules\Orders\Models\Order;
use App\Modules\Shifts\Actions\RecordCashMovementAction;
use App\Modules\Shifts\Enums\CashMovementType;
use App\Modules\Shifts\Enums\ShiftState;
use App\Modules\Shifts\Models\Shift;
use DomainException;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

final class SettleBillSplitAction
{
    public function __construct(
        private readonly PaymentGatewayInterface $gateway,
        private readonly RecordCashMovementAction $recordCashMovement,
    ) {}

    public function execute(SettleBillSplitData $data): PaymentTransaction
    {
        if ($data->tipCents < 0 || $data->amountTenderedCents < 0) {
            throw new InvalidArgumentException('Tip and tendered cents must be non-negative.');
        }

        if (trim($data->idempotencyKey) === '') {
            throw new InvalidArgumentException('Idempotency key is required.');
        }

        return DB::transaction(function () use ($data): PaymentTransaction {
            $existing = PaymentTransaction::query()
                ->where('idempotency_key', $data->idempotencyKey)
                ->first();

            if ($existing !== null) {
                return $existing;
            }

            $split = BillSplit::query()->whereKey($data->billSplitId)->lockForUpdate()->firstOrFail();
            $order = Order::query()->whereKey($split->order_id)->lockForUpdate()->firstOrFail();
            $shift = Shift::query()->whereKey($data->shiftId)->lockForUpdate()->firstOrFail();

            if ($shift->branch_id !== $order->branch_id || $shift->state !== ShiftState::Open) {
                throw new DomainException('An open shift in the same branch is required to settle a payment.');
            }

            if ($split->state === BillSplitState::Paid) {
                throw new DomainException("Bill split '{$split->label}' has already been paid.");
            }

            $totalDueCents = $split->total_cents + $data->tipCents;

            if ($data->tenderMethod === TenderMethod::Cash && $data->amountTenderedCents < $totalDueCents) {
                throw new InvalidArgumentException('Cash tendered is less than the check total plus tip.');
            }

            $tenderedCents = $data->tenderMethod === TenderMethod::Cash
                ? $data->amountTenderedCents
                : $totalDueCents;
            $changeCents = $data->tenderMethod === TenderMethod::Cash
                ? $tenderedCents - $totalDueCents
                : 0;

            $gatewayResult = $this->gateway->charge(
                method: $data->tenderMethod,
                amountCents: $totalDueCents,
                idempotencyKey: $data->idempotencyKey,
                simulateDecline: $data->simulateDecline,
            );

            if (! $gatewayResult->succeeded) {
                $failedTx = PaymentTransaction::create([
                    'branch_id' => $order->branch_id,
                    'shift_id' => $shift->id,
                    'order_id' => $order->id,
                    'bill_split_id' => $split->id,
                    'idempotency_key' => $data->idempotencyKey,
                    'tender_method' => $data->tenderMethod,
                    'state' => PaymentState::Failed,
                    'amount_cents' => $totalDueCents,
                    'tip_cents' => $data->tipCents,
                    'tendered_cents' => $tenderedCents,
                    'change_cents' => 0,
                    'failure_reason' => $gatewayResult->failureReason,
                    'gateway_reference' => $gatewayResult->reference,
                    'processed_by_user_id' => $data->actorUserId,
                ]);

                $split->update(['state' => BillSplitState::Failed]);

                $anySiblingPaid = BillSplit::query()
                    ->where('order_id', $order->id)
                    ->where('state', BillSplitState::Paid->value)
                    ->exists();

                if ($anySiblingPaid && $order->state !== OrderState::PartiallyPaid) {
                    $order->update(['state' => OrderState::PartiallyPaid]);
                }

                return $failedTx;
            }

            $split->update([
                'tip_cents' => $data->tipCents,
                'state' => BillSplitState::Paid,
            ]);

            $capturedTx = PaymentTransaction::create([
                'branch_id' => $order->branch_id,
                'shift_id' => $shift->id,
                'order_id' => $order->id,
                'bill_split_id' => $split->id,
                'idempotency_key' => $data->idempotencyKey,
                'tender_method' => $data->tenderMethod,
                'state' => PaymentState::Captured,
                'amount_cents' => $totalDueCents,
                'tip_cents' => $data->tipCents,
                'tendered_cents' => $tenderedCents,
                'change_cents' => $changeCents,
                'gateway_reference' => $gatewayResult->reference,
                'processed_by_user_id' => $data->actorUserId,
            ]);

            if ($data->tenderMethod === TenderMethod::Cash && $totalDueCents > 0) {
                $this->recordCashMovement->execute(
                    shiftId: $shift->id,
                    type: CashMovementType::CashSale,
                    amountCents: $totalDueCents,
                    reference: "{$order->order_number}-CHK{$split->sequence_number}",
                );
            }

            $unpaidCount = BillSplit::query()
                ->where('order_id', $order->id)
                ->where('state', '!=', BillSplitState::Paid->value)
                ->count();

            $nextOrderState = $unpaidCount === 0 ? OrderState::Paid : OrderState::PartiallyPaid;

            $order->update([
                'state' => $nextOrderState,
                'closed_at' => $nextOrderState === OrderState::Paid ? now() : null,
            ]);

            if ($nextOrderState === OrderState::Paid && $order->table_id !== null) {
                $table = DiningTable::query()->whereKey($order->table_id)->lockForUpdate()->first();
                if ($table !== null && $table->state !== TableState::Dirty) {
                    $table->update([
                        'state' => TableState::Dirty,
                        'current_guest_count' => 0,
                        'occupied_since' => null,
                    ]);

                    TableOccupancyChanged::dispatch(
                        branchId: $table->branch_id,
                        tableId: $table->id,
                        tableCode: $table->code,
                        state: TableState::Dirty,
                        guestCount: 0,
                    );
                }
            }

            PaymentCaptured::dispatch(
                branchId: $order->branch_id,
                orderId: $order->id,
                billSplitId: $split->id,
                paymentTransactionId: $capturedTx->id,
                amountCents: $capturedTx->amount_cents,
                tenderMethod: $data->tenderMethod,
                orderState: $nextOrderState,
            );

            return $capturedTx;
        });
    }
}
