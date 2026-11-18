<?php

declare(strict_types=1);

namespace App\Modules\Orders\Actions;

use App\Modules\Kitchen\Enums\ItemPrepState;
use App\Modules\Menu\Models\BranchMenuOverride;
use App\Modules\Menu\Models\MenuItemVariant;
use App\Modules\Menu\Models\ModifierOption;
use App\Modules\Orders\DTOs\OrderItemInputData;
use App\Modules\Orders\Models\Order;
use App\Modules\Orders\Models\OrderItem;
use App\Modules\Orders\Models\OrderItemModifier;
use DomainException;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

final class AddDraftOrderItemAction
{
    public function __construct(
        private readonly RecalculateOrderTotalsAction $recalculateTotals,
    ) {}

    public function execute(int $orderId, OrderItemInputData $input): OrderItem
    {
        if ($input->quantity <= 0) {
            throw new InvalidArgumentException('Quantity must be at least 1.');
        }

        return DB::transaction(function () use ($orderId, $input): OrderItem {
            $order = Order::query()->whereKey($orderId)->lockForUpdate()->firstOrFail();

            if (! $order->state->canAcceptNewItems()) {
                throw new DomainException("Cannot add items while order is in '{$order->state->value}' state.");
            }

            $variant = MenuItemVariant::query()->with('menuItem')->findOrFail($input->menuItemVariantId);
            $override = BranchMenuOverride::query()
                ->where('branch_id', $order->branch_id)
                ->where('menu_item_variant_id', $variant->id)
                ->first();

            $isAvailable = $override?->is_available ?? true;
            if (! $isAvailable || ! $variant->is_active || ! $variant->menuItem->is_active) {
                $reason = $override?->eighty_sixed_reason ? " ({$override->eighty_sixed_reason})" : '';
                throw new DomainException("Menu item '{$variant->menuItem->name}' is currently 86'd / unavailable{$reason}.");
            }

            $unitPriceCents = $override?->price_override_cents ?? $variant->base_price_cents;

            $modifierOptions = $input->modifierOptionIds !== []
                ? ModifierOption::query()->whereIn('id', $input->modifierOptionIds)->where('is_active', true)->get()
                : collect();

            $modifiersTotalCents = (int) $modifierOptions->sum('price_delta_cents');
            $lineTotalCents = max(0, $unitPriceCents + $modifiersTotalCents) * $input->quantity;

            $orderItem = OrderItem::create([
                'order_id' => $order->id,
                'menu_item_variant_id' => $variant->id,
                'item_name_snapshot' => $variant->menuItem->name,
                'variant_name_snapshot' => $variant->name,
                'prep_station' => $variant->menuItem->prep_station,
                'prep_state' => ItemPrepState::Draft,
                'quantity' => $input->quantity,
                'unit_price_cents' => $unitPriceCents,
                'modifiers_total_cents' => $modifiersTotalCents,
                'line_total_cents' => $lineTotalCents,
                'seat_number' => $input->seatNumber,
                'special_instructions' => $input->specialInstructions,
            ]);

            foreach ($modifierOptions as $option) {
                OrderItemModifier::create([
                    'order_item_id' => $orderItem->id,
                    'modifier_option_id' => $option->id,
                    'option_name_snapshot' => $option->name,
                    'price_delta_cents' => $option->price_delta_cents,
                ]);
            }

            $this->recalculateTotals->execute($order);

            return $orderItem->load('modifiers');
        });
    }
}
