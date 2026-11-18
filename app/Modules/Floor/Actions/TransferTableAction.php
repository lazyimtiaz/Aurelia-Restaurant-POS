<?php

declare(strict_types=1);

namespace App\Modules\Floor\Actions;

use App\Modules\Floor\Enums\TableState;
use App\Modules\Floor\Events\TableOccupancyChanged;
use App\Modules\Floor\Exceptions\TableNotAvailableException;
use App\Modules\Floor\Models\DiningTable;
use App\Modules\Orders\Models\Order;
use DomainException;
use Illuminate\Support\Facades\DB;

final class TransferTableAction
{
    public function execute(int $orderId, int $targetTableId, bool $markSourceDirty = false): DiningTable
    {
        return DB::transaction(function () use ($orderId, $targetTableId, $markSourceDirty): DiningTable {
            $order = Order::query()->whereKey($orderId)->lockForUpdate()->firstOrFail();

            if ($order->table_id === null) {
                throw new DomainException('Cannot transfer a non-dine-in order without a dining table.');
            }

            if ($order->table_id === $targetTableId) {
                throw new DomainException('Order is already seated at the target table.');
            }

            // Lock tables in ascending ID order to prevent lock-order deadlocks.
            $ids = [$order->table_id, $targetTableId];
            sort($ids);
            $tables = DiningTable::query()->whereIn('id', $ids)->orderBy('id')->lockForUpdate()->get()->keyBy('id');

            /** @var DiningTable $source */
            $source = $tables->get($order->table_id) ?? throw new DomainException('Source table not found.');
            /** @var DiningTable $target */
            $target = $tables->get($targetTableId) ?? throw new DomainException('Target table not found.');

            if ($source->branch_id !== $target->branch_id || $target->branch_id !== $order->branch_id) {
                throw new DomainException('Cannot transfer an order across different branches.');
            }

            if (! $target->state->canBeOccupied()) {
                throw TableNotAvailableException::forTable($target->code, $target->state->value);
            }

            $guestCount = max(1, $order->guest_count, $source->current_guest_count);
            $occupiedSince = $source->occupied_since ?? now();

            $target->update([
                'state' => TableState::Occupied,
                'current_guest_count' => $guestCount,
                'occupied_since' => $occupiedSince,
            ]);

            $sourceState = $markSourceDirty ? TableState::Dirty : TableState::Available;
            $source->update([
                'state' => $sourceState,
                'current_guest_count' => 0,
                'occupied_since' => null,
            ]);

            $order->update([
                'table_id' => $target->id,
            ]);

            $sourceRefreshed = $source->refresh();
            $targetRefreshed = $target->refresh();

            TableOccupancyChanged::dispatch(
                branchId: $sourceRefreshed->branch_id,
                tableId: $sourceRefreshed->id,
                tableCode: $sourceRefreshed->code,
                state: $sourceRefreshed->state,
                guestCount: 0,
            );

            TableOccupancyChanged::dispatch(
                branchId: $targetRefreshed->branch_id,
                tableId: $targetRefreshed->id,
                tableCode: $targetRefreshed->code,
                state: $targetRefreshed->state,
                guestCount: $targetRefreshed->current_guest_count,
            );

            return $targetRefreshed;
        });
    }
}
