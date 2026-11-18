<?php

declare(strict_types=1);

namespace App\Modules\Billing\Actions;

use App\Modules\Billing\Enums\BillSplitState;
use App\Modules\Billing\Enums\SplitMode;
use App\Modules\Billing\Models\BillSplit;
use App\Modules\Billing\Models\BillSplitItem;
use App\Modules\Floor\Enums\TableState;
use App\Modules\Floor\Events\TableOccupancyChanged;
use App\Modules\Floor\Models\DiningTable;
use App\Modules\Kitchen\Enums\ItemPrepState;
use App\Modules\Orders\Enums\OrderState;
use App\Modules\Orders\Models\Order;
use App\Modules\Orders\Models\OrderItem;
use DomainException;
use Illuminate\Support\Facades\DB;

final class RequestOrderBillAction
{
    public function execute(int $orderId): Order
    {
        return DB::transaction(function () use ($orderId): Order {
            $order = Order::query()->whereKey($orderId)->lockForUpdate()->firstOrFail();

            if (! in_array($order->state, [OrderState::Draft, OrderState::Open, OrderState::Billing], true)) {
                throw new DomainException("Order {$order->order_number} cannot enter billing from '{$order->state->value}'.");
            }

            $activeItems = OrderItem::query()
                ->where('order_id', $order->id)
                ->where('prep_state', '!=', ItemPrepState::Voided->value)
                ->get();

            if ($activeItems->isEmpty()) {
                throw new DomainException("Order {$order->order_number} has no billable items.");
            }

            $hasDraftItems = $activeItems->contains(
                fn (OrderItem $item): bool => $item->prep_state === ItemPrepState::Draft
            );

            if ($hasDraftItems) {
                throw new DomainException('Fire or remove draft items before requesting the bill.');
            }

            if ($order->state !== OrderState::Billing) {
                $order->update(['state' => OrderState::Billing]);
            }

            if ($order->table_id !== null) {
                $table = DiningTable::query()->whereKey($order->table_id)->lockForUpdate()->first();
                if ($table !== null && $table->state !== TableState::Billing) {
                    $table->update(['state' => TableState::Billing]);

                    TableOccupancyChanged::dispatch(
                        branchId: $table->branch_id,
                        tableId: $table->id,
                        tableCode: $table->code,
                        state: TableState::Billing,
                        guestCount: $table->current_guest_count,
                    );
                }
            }

            if (! BillSplit::query()->where('order_id', $order->id)->exists()) {
                $split = BillSplit::create([
                    'order_id' => $order->id,
                    'sequence_number' => 1,
                    'label' => 'Check 1',
                    'split_mode' => SplitMode::Unified,
                    'state' => BillSplitState::Pending,
                    'subtotal_cents' => $order->subtotal_cents,
                    'discount_cents' => $order->discount_cents,
                    'service_charge_cents' => $order->service_charge_cents,
                    'tax_cents' => $order->tax_cents,
                    'tip_cents' => 0,
                    'total_cents' => $order->total_cents,
                ]);

                foreach ($activeItems as $item) {
                    BillSplitItem::create([
                        'bill_split_id' => $split->id,
                        'order_item_id' => $item->id,
                        'share_numerator' => 1,
                        'share_denominator' => 1,
                        'allocated_subtotal_cents' => $item->line_total_cents,
                    ]);
                }
            }

            return $order->refresh()->load('billSplits');
        });
    }
}
