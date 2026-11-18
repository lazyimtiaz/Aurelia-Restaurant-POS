<?php

declare(strict_types=1);

namespace App\Modules\Orders\Actions;

use App\Modules\Audit\Actions\RecordAuditLogAction;
use App\Modules\Identity\Actions\VerifyManagerPinAction;
use App\Modules\Orders\Models\Order;
use App\Modules\Restaurant\Models\Branch;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

final class ApplyOrderDiscountAction
{
    public function __construct(
        private readonly VerifyManagerPinAction $verifyManagerPin,
        private readonly RecordAuditLogAction $recordAuditLog,
        private readonly RecalculateOrderTotalsAction $recalculateTotals,
    ) {}

    public function execute(int $orderId, int $discountBps, int $actorUserId, ?string $managerPin = null): Order
    {
        if ($discountBps < 0 || $discountBps > 10000) {
            throw new InvalidArgumentException('Discount basis points must be between 0 and 10000.');
        }

        return DB::transaction(function () use ($orderId, $discountBps, $actorUserId, $managerPin): Order {
            $order = Order::query()->whereKey($orderId)->lockForUpdate()->firstOrFail();
            $branch = Branch::query()->findOrFail($order->branch_id);

            $approverId = null;
            if ($discountBps > $branch->discount_pin_threshold_bps) {
                $approver = $this->verifyManagerPin->execute(
                    branchId: $branch->id,
                    pin: (string) $managerPin,
                    actorUserId: $actorUserId,
                    actionType: 'high_discount',
                    context: [
                        'order_id' => $order->id,
                        'discount_bps' => $discountBps,
                    ],
                );
                $approverId = $approver->id;
            }

            $order->update(['discount_bps' => $discountBps]);
            $updated = $this->recalculateTotals->execute($order);

            $this->recordAuditLog->execute(
                branchId: $branch->id,
                actorUserId: $actorUserId,
                approverUserId: $approverId,
                eventType: 'order_discount_applied',
                auditableType: Order::class,
                auditableId: $order->id,
                payload: [
                    'discount_bps' => $discountBps,
                    'discount_cents' => $updated->discount_cents,
                ],
                isCritical: $approverId !== null,
            );

            return $updated;
        });
    }
}
