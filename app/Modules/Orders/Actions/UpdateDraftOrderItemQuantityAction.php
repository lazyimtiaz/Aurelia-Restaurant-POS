<?php

declare(strict_types=1);

namespace App\Modules\Orders\Actions;

use App\Modules\Kitchen\Enums\ItemPrepState;
use App\Modules\Orders\Models\Order;
use App\Modules\Orders\Models\OrderItem;
use DomainException;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

final class UpdateDraftOrderItemQuantityAction
{
    public function __construct(
        private readonly RecalculateOrderTotalsAction $recalculateTotals,
    ) {}

    public function execute(int $orderItemId, int $quantity): Order
    {
        if ($quantity < 0 || $quantity > 50) {
            throw new InvalidArgumentException('Quantity must be between 0 and 50.');
        }

        return DB::transaction(function () use ($orderItemId, $quantity): Order {
            $item = OrderItem::query()->whereKey($orderItemId)->lockForUpdate()->firstOrFail();
            $order = Order::query()->whereKey($item->order_id)->lockForUpdate()->firstOrFail();

            if (! $order->state->canAcceptNewItems()) {
                throw new DomainException("Cannot adjust items while order is in '{$order->state->value}' state.");
            }

            if ($item->prep_state !== ItemPrepState::Draft) {
                throw new DomainException('Fired kitchen items cannot have quantities changed; add a new round or void.');
            }

            if ($quantity === 0) {
                $item->delete();

                return $this->recalculateTotals->execute($order);
            }

            $lineTotalCents = max(0, $item->unit_price_cents + $item->modifiers_total_cents) * $quantity;

            $item->update([
                'quantity' => $quantity,
                'line_total_cents' => $lineTotalCents,
            ]);

            return $this->recalculateTotals->execute($order);
        });
    }
}
