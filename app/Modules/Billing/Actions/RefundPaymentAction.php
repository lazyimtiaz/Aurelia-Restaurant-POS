<?php

declare(strict_types=1);

namespace App\Modules\Billing\Actions;

use App\Modules\Audit\Actions\RecordAuditLogAction;
use App\Modules\Billing\DTOs\RefundPaymentData;
use App\Modules\Billing\Enums\PaymentState;
use App\Modules\Billing\Enums\TenderMethod;
use App\Modules\Billing\Exceptions\RefundExceedsCapturedAmountException;
use App\Modules\Billing\Models\PaymentTransaction;
use App\Modules\Identity\Actions\VerifyManagerPinAction;
use App\Modules\Inventory\Enums\StockMovementType;
use App\Modules\Inventory\Jobs\DeductOrderInventoryJob;
use App\Modules\Kitchen\Enums\ItemPrepState;
use App\Modules\Orders\Models\OrderItem;
use App\Modules\Shifts\Actions\RecordCashMovementAction;
use App\Modules\Shifts\Enums\CashMovementType;
use App\Modules\Shifts\Enums\ShiftState;
use App\Modules\Shifts\Models\Shift;
use DomainException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use InvalidArgumentException;

final class RefundPaymentAction
{
    public function __construct(
        private readonly VerifyManagerPinAction $verifyManagerPin,
        private readonly RecordCashMovementAction $recordCashMovement,
        private readonly RecordAuditLogAction $recordAuditLog,
    ) {}

    public function execute(RefundPaymentData $data): PaymentTransaction
    {
        if ($data->refundAmountCents <= 0) {
            throw new InvalidArgumentException('Refund amount cents must be greater than zero.');
        }

        return DB::transaction(function () use ($data): PaymentTransaction {
            $original = PaymentTransaction::query()
                ->whereKey($data->paymentTransactionId)
                ->lockForUpdate()
                ->firstOrFail();

            if ($original->state !== PaymentState::Captured || $original->amount_cents <= 0) {
                throw new DomainException('Only captured payments can be refunded.');
            }

            $shift = Shift::query()->whereKey($data->activeShiftId)->lockForUpdate()->firstOrFail();
            if ($shift->branch_id !== $original->branch_id || $shift->state !== ShiftState::Open) {
                throw new DomainException('An open shift at the same branch is required to issue a refund.');
            }

            $approver = $this->verifyManagerPin->execute(
                branchId: $original->branch_id,
                pin: $data->managerPin,
                actorUserId: $data->actorUserId,
                actionType: 'payment_refund',
                context: [
                    'payment_transaction_id' => $original->id,
                    'refund_amount_cents' => $data->refundAmountCents,
                    'reason' => $data->reason,
                ],
            );

            $alreadyRefunded = (int) abs((int) PaymentTransaction::query()
                ->where('parent_transaction_id', $original->id)
                ->where('state', PaymentState::Refunded->value)
                ->sum('amount_cents'));

            $remaining = $original->amount_cents - $alreadyRefunded;
            if ($data->refundAmountCents > $remaining) {
                throw RefundExceedsCapturedAmountException::forRemaining($remaining);
            }

            $refundTx = PaymentTransaction::create([
                'branch_id' => $original->branch_id,
                'shift_id' => $shift->id,
                'order_id' => $original->order_id,
                'bill_split_id' => $original->bill_split_id,
                'parent_transaction_id' => $original->id,
                'idempotency_key' => "refund-{$original->id}-".Str::uuid()->toString(),
                'tender_method' => $original->tender_method,
                'state' => PaymentState::Refunded,
                'amount_cents' => -$data->refundAmountCents,
                'tip_cents' => 0,
                'tendered_cents' => 0,
                'change_cents' => 0,
                'gateway_reference' => 'RFND-'.Str::upper(Str::random(8)),
                'processed_by_user_id' => $data->actorUserId,
                'refunded_with_wastage' => $data->wastage,
            ]);

            if ($original->tender_method === TenderMethod::Cash) {
                $this->recordCashMovement->execute(
                    shiftId: $shift->id,
                    type: CashMovementType::CashRefund,
                    amountCents: $data->refundAmountCents,
                    reference: "REFUND-TX-{$original->id}",
                );
            }

            $this->recordAuditLog->execute(
                branchId: $original->branch_id,
                actorUserId: $data->actorUserId,
                approverUserId: $approver->id,
                eventType: 'payment_refunded',
                auditableType: PaymentTransaction::class,
                auditableId: $refundTx->id,
                payload: [
                    'parent_transaction_id' => $original->id,
                    'refund_amount_cents' => $data->refundAmountCents,
                    'reason' => $data->reason,
                    'wastage' => $data->wastage,
                ],
                isCritical: true,
            );

            if ($data->wastage) {
                $variantQuantities = [];

                $splitItems = $original->billSplit?->items()->with('orderItem')->get();
                if ($splitItems !== null && $splitItems->isNotEmpty()) {
                    foreach ($splitItems as $splitItem) {
                        $orderItem = $splitItem->orderItem;
                        if ($orderItem === null || $orderItem->prep_state === ItemPrepState::Voided) {
                            continue;
                        }
                        $variantId = (int) $orderItem->menu_item_variant_id;
                        $variantQuantities[$variantId] = ($variantQuantities[$variantId] ?? 0) + (int) $orderItem->quantity;
                    }
                } else {
                    $orderItems = OrderItem::query()
                        ->where('order_id', $original->order_id)
                        ->where('prep_state', '!=', ItemPrepState::Voided->value)
                        ->get();

                    foreach ($orderItems as $orderItem) {
                        $variantId = (int) $orderItem->menu_item_variant_id;
                        $variantQuantities[$variantId] = ($variantQuantities[$variantId] ?? 0) + (int) $orderItem->quantity;
                    }
                }

                if ($variantQuantities !== []) {
                    DeductOrderInventoryJob::dispatch(
                        branchId: $original->branch_id,
                        referenceType: 'payment_refund',
                        referenceId: $refundTx->id,
                        variantQuantities: $variantQuantities,
                        movementType: StockMovementType::Wastage,
                        actorUserId: $data->actorUserId,
                    );
                }
            }

            return $refundTx;
        });
    }
}
