<?php

declare(strict_types=1);

namespace App\Modules\Orders\Actions;

use App\Modules\Kitchen\Enums\ItemPrepState;
use App\Modules\Kitchen\Enums\TicketState;
use App\Modules\Kitchen\Events\OrderRoundFired;
use App\Modules\Kitchen\Models\KitchenTicket;
use App\Modules\Orders\Enums\OrderState;
use App\Modules\Orders\Exceptions\NoDraftItemsToFireException;
use App\Modules\Orders\Models\Order;
use App\Modules\Orders\Models\OrderItem;
use DomainException;
use Illuminate\Support\Facades\DB;

final class FireOrderRoundAction
{
    public function execute(int $orderId, int $actorUserId): KitchenTicket
    {
        return DB::transaction(function () use ($orderId, $actorUserId): KitchenTicket {
            $order = Order::query()->whereKey($orderId)->lockForUpdate()->firstOrFail();

            if (! $order->state->canAcceptNewItems()) {
                throw new DomainException("Cannot fire kitchen round while order is in '{$order->state->value}' state.");
            }

            $draftItems = OrderItem::query()
                ->where('order_id', $order->id)
                ->where('prep_state', ItemPrepState::Draft->value)
                ->lockForUpdate()
                ->get();

            if ($draftItems->isEmpty()) {
                throw NoDraftItemsToFireException::forOrder($order->order_number);
            }

            $nextRound = ((int) KitchenTicket::query()->where('order_id', $order->id)->max('round_number')) + 1;

            $ticket = KitchenTicket::create([
                'branch_id' => $order->branch_id,
                'order_id' => $order->id,
                'round_number' => $nextRound,
                'state' => TicketState::Fired,
                'fired_by_user_id' => $actorUserId,
                'fired_at' => now(),
            ]);

            OrderItem::query()
                ->whereIn('id', $draftItems->pluck('id')->all())
                ->update([
                    'kitchen_ticket_id' => $ticket->id,
                    'prep_state' => ItemPrepState::Queued->value,
                ]);

            if ($order->state === OrderState::Draft) {
                $order->update(['state' => OrderState::Open]);
            }

            OrderRoundFired::dispatch(
                branchId: $order->branch_id,
                orderId: $order->id,
                kitchenTicketId: $ticket->id,
                roundNumber: $nextRound,
            );

            return $ticket->load('items.modifiers');
        });
    }
}
