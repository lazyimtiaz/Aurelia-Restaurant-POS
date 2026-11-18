<?php

declare(strict_types=1);

namespace App\Modules\Kitchen\Queries;

use App\Modules\Kitchen\Enums\TicketState;
use App\Modules\Kitchen\Models\KitchenTicket;
use App\Modules\Menu\Enums\PrepStation;
use App\Modules\Orders\Models\OrderItem;
use App\Modules\Orders\Models\OrderItemModifier;
use Illuminate\Support\Collection;

final class GetActiveKdsTicketsQuery
{
    /**
     * @return Collection<int, array<string, mixed>>
     */
    public function execute(int $branchId, ?PrepStation $station = null): Collection
    {
        $tickets = KitchenTicket::query()
            ->where('branch_id', $branchId)
            ->where('state', '!=', TicketState::Served->value)
            ->orderBy('fired_at')
            ->with([
                'order.table',
                'items.modifiers',
            ])
            ->get();

        return $tickets
            ->map(function (KitchenTicket $ticket) use ($station): ?array {
                $filteredItems = $station !== null
                    ? $ticket->items->filter(fn (OrderItem $item): bool => $item->prep_station === $station)
                    : $ticket->items;

                if ($filteredItems->isEmpty()) {
                    return null;
                }

                return [
                    'id' => $ticket->id,
                    'order_id' => $ticket->order_id,
                    'order_number' => $ticket->order?->order_number,
                    'service_type' => $ticket->order?->service_type->value,
                    'table_code' => $ticket->order?->table?->code,
                    'customer_name' => $ticket->order?->customer_name,
                    'round_number' => $ticket->round_number,
                    'state' => $ticket->state->value,
                    'fired_at' => $ticket->fired_at->toIso8601String(),
                    'ready_at' => $ticket->ready_at?->toIso8601String(),
                    'items' => $filteredItems->map(fn (OrderItem $item): array => [
                        'id' => $item->id,
                        'item_name' => $item->item_name_snapshot,
                        'variant_name' => $item->variant_name_snapshot,
                        'prep_station' => $item->prep_station->value,
                        'prep_station_label' => $item->prep_station->label(),
                        'prep_state' => $item->prep_state->value,
                        'quantity' => $item->quantity,
                        'seat_number' => $item->seat_number,
                        'special_instructions' => $item->special_instructions,
                        'void_reason' => $item->void_reason?->value,
                        'modifiers' => $item->modifiers->map(fn (OrderItemModifier $mod): array => [
                            'id' => $mod->id,
                            'name' => $mod->option_name_snapshot,
                        ])->values()->all(),
                    ])->values()->all(),
                ];
            })
            ->filter()
            ->values();
    }
}
