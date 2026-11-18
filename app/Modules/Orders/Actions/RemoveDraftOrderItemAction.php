<?php

declare(strict_types=1);

namespace App\Modules\Orders\Actions;

use App\Modules\Kitchen\Enums\ItemPrepState;
use App\Modules\Orders\Models\Order;
use App\Modules\Orders\Models\OrderItem;
use DomainException;
use Illuminate\Support\Facades\DB;

final class RemoveDraftOrderItemAction
{
    public function __construct(
        private readonly RecalculateOrderTotalsAction $recalculateTotals,
    ) {}

    public function execute(int $orderItemId): Order
    {
        return DB::transaction(function () use ($orderItemId): Order {
            $item = OrderItem::query()->whereKey($orderItemId)->lockForUpdate()->firstOrFail();
            $order = Order::query()->whereKey($item->order_id)->lockForUpdate()->firstOrFail();

            if (! $order->state->canAcceptNewItems()) {
                throw new DomainException("Cannot remove items while order is in '{$order->state->value}' state.");
            }

            if ($item->prep_state !== ItemPrepState::Draft) {
                throw new DomainException('Fired kitchen items cannot be deleted directly; use Manager-PIN void.');
            }

            $item->delete();

            return $this->recalculateTotals->execute($order);
        });
    }
}
