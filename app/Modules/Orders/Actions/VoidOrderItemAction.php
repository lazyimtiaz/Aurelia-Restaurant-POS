<?php

declare(strict_types=1);

namespace App\Modules\Orders\Actions;

use App\Modules\Audit\Actions\RecordAuditLogAction;
use App\Modules\Identity\Actions\VerifyManagerPinAction;
use App\Modules\Kitchen\Enums\ItemPrepState;
use App\Modules\Kitchen\Enums\TicketState;
use App\Modules\Kitchen\Enums\VoidReason;
use App\Modules\Kitchen\Events\OrderItemVoided;
use App\Modules\Kitchen\Models\KitchenTicket;
use App\Modules\Orders\Models\Order;
use App\Modules\Orders\Models\OrderItem;
use DomainException;
use Illuminate\Support\Facades\DB;

final class VoidOrderItemAction
{
    public function __construct(
        private readonly VerifyManagerPinAction $verifyManagerPin,
        private readonly RecordAuditLogAction $recordAuditLog,
        private readonly RecalculateOrderTotalsAction $recalculateTotals,
    ) {}

    public function execute(int $orderItemId, string $managerPin, VoidReason $reason, int $actorUserId): OrderItem
    {
        return DB::transaction(function () use ($orderItemId, $managerPin, $reason, $actorUserId): OrderItem {
            $item = OrderItem::query()->whereKey($orderItemId)->lockForUpdate()->firstOrFail();
            $order = Order::query()->whereKey($item->order_id)->lockForUpdate()->firstOrFail();

            if ($item->prep_state === ItemPrepState::Voided) {
                throw new DomainException('Order item is already voided.');
            }

            if ($item->prep_state === ItemPrepState::Served) {
                throw new DomainException('Served items require a post-payment refund rather than a void.');
            }

            $approver = $this->verifyManagerPin->execute(
                branchId: $order->branch_id,
                pin: $managerPin,
                actorUserId: $actorUserId,
                actionType: 'order_item_void',
                context: [
                    'order_id' => $order->id,
                    'order_item_id' => $item->id,
                    'reason' => $reason->value,
                ],
            );

            $wasInPrep = in_array($item->prep_state, [ItemPrepState::InPrep, ItemPrepState::Ready], true);

            $item->update([
                'prep_state' => ItemPrepState::Voided,
                'void_reason' => $reason,
                'was_in_prep_at_void' => $wasInPrep,
            ]);

            $this->recalculateTotals->execute($order);

            if ($item->kitchen_ticket_id !== null) {
                $ticket = KitchenTicket::query()->whereKey($item->kitchen_ticket_id)->lockForUpdate()->first();
                if ($ticket !== null && $ticket->state !== TicketState::Served) {
                    $remaining = OrderItem::query()
                        ->where('kitchen_ticket_id', $ticket->id)
                        ->where('prep_state', '!=', ItemPrepState::Voided->value)
                        ->get();

                    if ($remaining->isNotEmpty() && $remaining->every(fn (OrderItem $row): bool => $row->prep_state === ItemPrepState::Ready)) {
                        $ticket->update([
                            'state' => TicketState::Ready,
                            'ready_at' => $ticket->ready_at ?? now(),
                        ]);
                    }
                }
            }

            $this->recordAuditLog->execute(
                branchId: $order->branch_id,
                actorUserId: $actorUserId,
                approverUserId: $approver->id,
                eventType: 'order_item_voided',
                auditableType: OrderItem::class,
                auditableId: $item->id,
                payload: [
                    'order_id' => $order->id,
                    'item_name' => $item->item_name_snapshot,
                    'reason' => $reason->value,
                    'was_in_prep_at_void' => $wasInPrep,
                ],
                isCritical: true,
            );

            OrderItemVoided::dispatch(
                branchId: $order->branch_id,
                orderId: $order->id,
                kitchenTicketId: $item->kitchen_ticket_id,
                orderItemId: $item->id,
                reason: $reason,
                wasInPrepAtVoid: $wasInPrep,
            );

            return $item->refresh();
        });
    }
}
