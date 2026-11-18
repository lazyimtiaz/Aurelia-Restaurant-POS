<?php

declare(strict_types=1);

namespace App\Modules\Orders\Queries;

use App\Modules\Kitchen\Models\KitchenTicket;
use App\Modules\Orders\Enums\OrderState;
use App\Modules\Orders\Models\Order;
use App\Modules\Orders\Models\OrderItem;
use App\Modules\Orders\Models\OrderItemModifier;

final class GetActiveBranchOrdersQuery
{
    /**
     * @return list<array<string, mixed>>
     */
    public function execute(int $branchId): array
    {
        $orders = Order::query()
            ->where('branch_id', $branchId)
            ->whereIn('state', [
                OrderState::Draft->value,
                OrderState::Open->value,
                OrderState::Billing->value,
                OrderState::PartiallyPaid->value,
            ])
            ->with([
                'table',
                'server',
                'items.modifiers',
                'kitchenTickets' => fn ($query) => $query->orderBy('round_number'),
            ])
            ->latest('opened_at')
            ->get();

        return $orders->map(function (Order $order): array {
            return [
                'id' => $order->id,
                'order_number' => $order->order_number,
                'service_type' => $order->service_type->value,
                'state' => $order->state->value,
                'table_id' => $order->table_id,
                'table_code' => $order->table?->code,
                'guest_count' => $order->guest_count,
                'customer_name' => $order->customer_name,
                'server_name' => $order->server?->name,
                'subtotal_cents' => $order->subtotal_cents,
                'discount_bps' => $order->discount_bps,
                'discount_cents' => $order->discount_cents,
                'service_charge_cents' => $order->service_charge_cents,
                'tax_cents' => $order->tax_cents,
                'total_cents' => $order->total_cents,
                'opened_at' => $order->opened_at->toIso8601String(),
                'kitchen_tickets' => $order->kitchenTickets->map(fn (KitchenTicket $ticket): array => [
                    'id' => $ticket->id,
                    'round_number' => $ticket->round_number,
                    'state' => $ticket->state->value,
                    'fired_at' => $ticket->fired_at->toIso8601String(),
                ])->values()->all(),
                'items' => $order->items->map(fn (OrderItem $item): array => [
                    'id' => $item->id,
                    'kitchen_ticket_id' => $item->kitchen_ticket_id,
                    'menu_item_variant_id' => $item->menu_item_variant_id,
                    'item_name' => $item->item_name_snapshot,
                    'variant_name' => $item->variant_name_snapshot,
                    'prep_station' => $item->prep_station->value,
                    'prep_state' => $item->prep_state->value,
                    'quantity' => $item->quantity,
                    'unit_price_cents' => $item->unit_price_cents,
                    'modifiers_total_cents' => $item->modifiers_total_cents,
                    'line_total_cents' => $item->line_total_cents,
                    'seat_number' => $item->seat_number,
                    'special_instructions' => $item->special_instructions,
                    'void_reason' => $item->void_reason?->value,
                    'modifiers' => $item->modifiers->map(fn (OrderItemModifier $mod): array => [
                        'id' => $mod->id,
                        'name' => $mod->option_name_snapshot,
                        'price_delta_cents' => $mod->price_delta_cents,
                    ])->values()->all(),
                ])->values()->all(),
            ];
        })->values()->all();
    }
}
