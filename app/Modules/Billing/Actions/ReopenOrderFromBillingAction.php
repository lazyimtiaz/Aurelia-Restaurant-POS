<?php

declare(strict_types=1);

namespace App\Modules\Billing\Actions;

use App\Modules\Billing\Enums\BillSplitState;
use App\Modules\Billing\Exceptions\CannotReopenPartiallyPaidOrderException;
use App\Modules\Billing\Models\BillSplit;
use App\Modules\Floor\Enums\TableState;
use App\Modules\Floor\Events\TableOccupancyChanged;
use App\Modules\Floor\Models\DiningTable;
use App\Modules\Orders\Enums\OrderState;
use App\Modules\Orders\Models\Order;
use DomainException;
use Illuminate\Support\Facades\DB;

final class ReopenOrderFromBillingAction
{
    public function execute(int $orderId): Order
    {
        return DB::transaction(function () use ($orderId): Order {
            $order = Order::query()->whereKey($orderId)->lockForUpdate()->firstOrFail();

            $hasPaidSplit = BillSplit::query()
                ->where('order_id', $order->id)
                ->where('state', BillSplitState::Paid->value)
                ->exists();

            if ($order->state === OrderState::PartiallyPaid || $hasPaidSplit) {
                throw CannotReopenPartiallyPaidOrderException::forOrder($order->order_number);
            }

            if ($order->state !== OrderState::Billing) {
                throw new DomainException("Only orders in 'billing' state can be reopened.");
            }

            BillSplit::query()->where('order_id', $order->id)->delete();

            $hasTickets = $order->kitchenTickets()->exists();
            $order->update([
                'state' => $hasTickets ? OrderState::Open : OrderState::Draft,
            ]);

            if ($order->table_id !== null) {
                $table = DiningTable::query()->whereKey($order->table_id)->lockForUpdate()->first();
                if ($table !== null && $table->state === TableState::Billing) {
                    $table->update(['state' => TableState::Occupied]);

                    TableOccupancyChanged::dispatch(
                        branchId: $table->branch_id,
                        tableId: $table->id,
                        tableCode: $table->code,
                        state: TableState::Occupied,
                        guestCount: $table->current_guest_count,
                    );
                }
            }

            return $order->refresh();
        });
    }
}
