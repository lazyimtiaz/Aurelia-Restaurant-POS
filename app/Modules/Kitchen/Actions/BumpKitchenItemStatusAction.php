<?php

declare(strict_types=1);

namespace App\Modules\Kitchen\Actions;

use App\Modules\Kitchen\Enums\ItemPrepState;
use App\Modules\Kitchen\Enums\TicketState;
use App\Modules\Kitchen\Events\KitchenItemStatusUpdated;
use App\Modules\Kitchen\Models\KitchenTicket;
use App\Modules\Orders\Models\OrderItem;
use DomainException;
use Illuminate\Support\Facades\DB;

final class BumpKitchenItemStatusAction
{
    public function execute(int $orderItemId, ItemPrepState $targetState, int $chefId): KitchenTicket
    {
        return DB::transaction(function () use ($orderItemId, $targetState): KitchenTicket {
            $item = OrderItem::query()->whereKey($orderItemId)->lockForUpdate()->firstOrFail();

            if ($item->kitchen_ticket_id === null) {
                throw new DomainException('Unfired draft items cannot be bumped on KDS.');
            }

            $validTransition = ($item->prep_state === ItemPrepState::Queued && $targetState === ItemPrepState::InPrep)
                || ($item->prep_state === ItemPrepState::InPrep && $targetState === ItemPrepState::Ready);

            if (! $validTransition) {
                throw new DomainException(
                    "Invalid KDS status transition from '{$item->prep_state->value}' to '{$targetState->value}'."
                );
            }

            $ticket = KitchenTicket::query()->whereKey($item->kitchen_ticket_id)->lockForUpdate()->firstOrFail();

            $item->update(['prep_state' => $targetState]);

            $nonVoidedItems = OrderItem::query()
                ->where('kitchen_ticket_id', $ticket->id)
                ->where('prep_state', '!=', ItemPrepState::Voided->value)
                ->get();

            $allReady = $nonVoidedItems->isNotEmpty()
                && $nonVoidedItems->every(fn (OrderItem $row): bool => $row->prep_state === ItemPrepState::Ready);

            $anyActive = $nonVoidedItems->contains(
                fn (OrderItem $row): bool => in_array($row->prep_state, [ItemPrepState::InPrep, ItemPrepState::Ready], true)
            );

            $nextTicketState = match (true) {
                $allReady => TicketState::Ready,
                $anyActive => TicketState::InPrep,
                default => TicketState::Fired,
            };

            $ticket->update([
                'state' => $nextTicketState,
                'ready_at' => $allReady ? ($ticket->ready_at ?? now()) : null,
            ]);

            KitchenItemStatusUpdated::dispatch(
                branchId: $ticket->branch_id,
                kitchenTicketId: $ticket->id,
                orderItemId: $item->id,
                itemState: $targetState,
                ticketState: $nextTicketState,
            );

            return $ticket->refresh()->load('items.modifiers');
        });
    }
}
