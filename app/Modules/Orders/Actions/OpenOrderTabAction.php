<?php

declare(strict_types=1);

namespace App\Modules\Orders\Actions;

use App\Modules\Floor\Actions\UpdateTableStateAction;
use App\Modules\Floor\Enums\TableState;
use App\Modules\Floor\Models\DiningTable;
use App\Modules\Orders\Enums\OrderState;
use App\Modules\Orders\Enums\ServiceType;
use App\Modules\Orders\Models\Order;
use App\Modules\Restaurant\Models\Branch;
use App\Modules\Shifts\Enums\ShiftState;
use App\Modules\Shifts\Models\Shift;
use DomainException;
use Illuminate\Support\Facades\DB;

final class OpenOrderTabAction
{
    public function __construct(
        private readonly UpdateTableStateAction $updateTableState,
    ) {}

    public function execute(
        int $branchId,
        int $shiftId,
        int $serverId,
        ServiceType $serviceType,
        ?int $tableId = null,
        int $guestCount = 1,
        ?string $customerName = null,
    ): Order {
        return DB::transaction(function () use (
            $branchId,
            $shiftId,
            $serverId,
            $serviceType,
            $tableId,
            $guestCount,
            $customerName,
        ): Order {
            $branch = Branch::query()->findOrFail($branchId);
            $shift = Shift::query()->whereKey($shiftId)->lockForUpdate()->firstOrFail();

            if ($shift->branch_id !== $branch->id || $shift->state !== ShiftState::Open) {
                throw new DomainException('An active open shift at this branch is required to open an order.');
            }

            if ($serviceType === ServiceType::DineIn) {
                if ($tableId === null) {
                    throw new DomainException('A dining table must be selected for dine-in service.');
                }

                $table = DiningTable::query()->findOrFail($tableId);
                if ($table->branch_id !== $branch->id) {
                    throw new DomainException('Dining table does not belong to the active branch.');
                }

                $this->updateTableState->execute($table->id, TableState::Occupied, max(1, $guestCount));
            }

            $nextSeq = Order::query()->where('branch_id', $branch->id)->count() + 1;
            $orderNumber = sprintf('%s-%04d', $branch->code, $nextSeq);

            return Order::create([
                'branch_id' => $branch->id,
                'shift_id' => $shift->id,
                'table_id' => $serviceType === ServiceType::DineIn ? $tableId : null,
                'server_id' => $serverId,
                'order_number' => $orderNumber,
                'service_type' => $serviceType,
                'state' => OrderState::Draft,
                'guest_count' => max(1, $guestCount),
                'customer_name' => $customerName,
                'opened_at' => now(),
            ]);
        });
    }
}
