<?php

declare(strict_types=1);

namespace App\Modules\Floor\Queries;

use App\Modules\Floor\Models\DiningTable;
use App\Modules\Floor\Models\FloorZone;
use App\Modules\Kitchen\Enums\TicketState;
use App\Modules\Orders\Enums\OrderState;
use App\Modules\Orders\Models\Order;

final class GetBranchFloorQuery
{
    /**
     * @return list<array<string, mixed>>
     */
    public function execute(int $branchId): array
    {
        $activeOrders = Order::query()
            ->where('branch_id', $branchId)
            ->whereNotNull('table_id')
            ->whereIn('state', [
                OrderState::Draft->value,
                OrderState::Open->value,
                OrderState::Billing->value,
                OrderState::PartiallyPaid->value,
            ])
            ->with(['kitchenTickets', 'server'])
            ->get()
            ->keyBy('table_id');

        $zones = FloorZone::query()
            ->where('branch_id', $branchId)
            ->orderBy('sort_order')
            ->with(['tables' => fn ($query) => $query->orderBy('id')])
            ->get();

        return $zones->map(function (FloorZone $zone) use ($activeOrders): array {
            return [
                'id' => $zone->id,
                'name' => $zone->name,
                'tables' => $zone->tables->map(function (DiningTable $table) use ($activeOrders): array {
                    /** @var Order|null $order */
                    $order = $activeOrders->get($table->id);
                    $readyTickets = $order?->kitchenTickets
                        ->filter(fn ($ticket): bool => $ticket->state === TicketState::Ready)
                        ->count() ?? 0;

                    return [
                        'id' => $table->id,
                        'code' => $table->code,
                        'capacity' => $table->capacity,
                        'state' => $table->state->value,
                        'state_label' => $table->state->label(),
                        'current_guest_count' => $table->current_guest_count,
                        'occupied_since' => $table->occupied_since?->toIso8601String(),
                        'active_order' => $order !== null ? [
                            'id' => $order->id,
                            'order_number' => $order->order_number,
                            'state' => $order->state->value,
                            'total_cents' => $order->total_cents,
                            'server_name' => $order->server?->name,
                            'ready_tickets_count' => $readyTickets,
                        ] : null,
                    ];
                })->values()->all(),
            ];
        })->values()->all();
    }
}
