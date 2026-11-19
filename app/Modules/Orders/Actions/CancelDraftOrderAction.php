<?php

declare(strict_types=1);

namespace App\Modules\Orders\Actions;

use App\Modules\Audit\Actions\RecordAuditLogAction;
use App\Modules\Floor\Actions\UpdateTableStateAction;
use App\Modules\Floor\Enums\TableState;
use App\Modules\Kitchen\Enums\ItemPrepState;
use App\Modules\Orders\Enums\OrderState;
use App\Modules\Orders\Models\Order;
use DomainException;
use Illuminate\Support\Facades\DB;

final class CancelDraftOrderAction
{
    public function __construct(
        private readonly UpdateTableStateAction $updateTableState,
        private readonly RecordAuditLogAction $recordAudit,
    ) {}

    public function execute(int $orderId, int $actorUserId): Order
    {
        return DB::transaction(function () use ($orderId, $actorUserId): Order {
            $order = Order::query()->whereKey($orderId)->lockForUpdate()->firstOrFail();

            if ($order->state !== OrderState::Draft) {
                throw new DomainException('Only unfired draft orders can be cancelled.');
            }

            $hasNonDraftItems = $order->items()
                ->where('prep_state', '!=', ItemPrepState::Draft->value)
                ->exists();

            if ($hasNonDraftItems) {
                throw new DomainException('Cannot cancel an order that already has kitchen-fired items.');
            }

            if ($order->paymentTransactions()->exists()) {
                throw new DomainException('Cannot cancel an order with payment transactions.');
            }

            $order->items()->delete();

            $order->update([
                'state' => OrderState::Voided,
                'subtotal_cents' => 0,
                'discount_cents' => 0,
                'service_charge_cents' => 0,
                'tax_cents' => 0,
                'total_cents' => 0,
                'closed_at' => now(),
            ]);

            if ($order->table_id !== null) {
                $this->updateTableState->execute($order->table_id, TableState::Available, 0);
            }

            $this->recordAudit->execute(
                branchId: $order->branch_id,
                actorUserId: $actorUserId,
                approverUserId: null,
                eventType: 'order.draft_cancelled',
                auditableType: Order::class,
                auditableId: $order->id,
                payload: [
                    'order_number' => $order->order_number,
                    'table_id' => $order->table_id,
                ],
                isCritical: false,
            );

            return $order->refresh();
        });
    }
}
