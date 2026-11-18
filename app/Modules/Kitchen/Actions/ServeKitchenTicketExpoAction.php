<?php

declare(strict_types=1);

namespace App\Modules\Kitchen\Actions;

use App\Modules\Inventory\Enums\StockMovementType;
use App\Modules\Inventory\Jobs\DeductOrderInventoryJob;
use App\Modules\Kitchen\Enums\ItemPrepState;
use App\Modules\Kitchen\Enums\TicketState;
use App\Modules\Kitchen\Events\TicketExpoServed;
use App\Modules\Kitchen\Exceptions\TicketNotReadyForExpoException;
use App\Modules\Kitchen\Models\KitchenTicket;
use App\Modules\Orders\Models\OrderItem;
use Illuminate\Support\Facades\DB;

final class ServeKitchenTicketExpoAction
{
    public function execute(
        int $kitchenTicketId,
        int $expediterId,
        bool $forceLowStockSimulation = false,
    ): KitchenTicket {
        return DB::transaction(function () use ($kitchenTicketId, $expediterId, $forceLowStockSimulation): KitchenTicket {
            $ticket = KitchenTicket::query()->with('order')->whereKey($kitchenTicketId)->lockForUpdate()->firstOrFail();

            $nonVoided = OrderItem::query()
                ->where('kitchen_ticket_id', $ticket->id)
                ->where('prep_state', '!=', ItemPrepState::Voided->value)
                ->lockForUpdate()
                ->get();

            $allReady = $nonVoided->isNotEmpty()
                && $nonVoided->every(fn (OrderItem $row): bool => $row->prep_state === ItemPrepState::Ready);

            if ($ticket->state !== TicketState::Ready || ! $allReady) {
                throw TicketNotReadyForExpoException::forTicket($ticket->id);
            }

            OrderItem::query()
                ->whereIn('id', $nonVoided->pluck('id')->all())
                ->update(['prep_state' => ItemPrepState::Served->value]);

            $ticket->update([
                'state' => TicketState::Served,
                'served_at' => now(),
            ]);

            $variantQuantities = [];
            foreach ($nonVoided as $servedItem) {
                $variantId = (int) $servedItem->menu_item_variant_id;
                $variantQuantities[$variantId] = ($variantQuantities[$variantId] ?? 0) + (int) $servedItem->quantity;
            }

            if ($variantQuantities !== []) {
                DeductOrderInventoryJob::dispatch(
                    branchId: $ticket->branch_id,
                    referenceType: 'kitchen_ticket',
                    referenceId: $ticket->id,
                    variantQuantities: $variantQuantities,
                    movementType: StockMovementType::OrderSale,
                    actorUserId: $expediterId,
                    forceLowStockSimulation: $forceLowStockSimulation,
                );
            }

            TicketExpoServed::dispatch(
                branchId: $ticket->branch_id,
                orderId: $ticket->order_id,
                kitchenTicketId: $ticket->id,
                tableId: $ticket->order?->table_id,
                roundNumber: $ticket->round_number,
            );

            return $ticket->refresh()->load('items.modifiers');
        });
    }
}
