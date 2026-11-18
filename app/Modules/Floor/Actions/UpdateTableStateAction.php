<?php

declare(strict_types=1);

namespace App\Modules\Floor\Actions;

use App\Modules\Floor\Enums\TableState;
use App\Modules\Floor\Events\TableOccupancyChanged;
use App\Modules\Floor\Exceptions\TableNotAvailableException;
use App\Modules\Floor\Models\DiningTable;
use Illuminate\Support\Facades\DB;

final class UpdateTableStateAction
{
    public function execute(int $tableId, TableState $targetState, ?int $guestCount = null): DiningTable
    {
        return DB::transaction(function () use ($tableId, $targetState, $guestCount): DiningTable {
            $table = DiningTable::query()->whereKey($tableId)->lockForUpdate()->firstOrFail();

            if ($targetState === TableState::Occupied && ! $table->state->canBeOccupied()) {
                throw TableNotAvailableException::forTable($table->code, $table->state->value);
            }

            $nextGuests = match ($targetState) {
                TableState::Available, TableState::Dirty => 0,
                TableState::Occupied => max(1, $guestCount ?? $table->current_guest_count),
                default => $guestCount ?? $table->current_guest_count,
            };

            $occupiedSince = match ($targetState) {
                TableState::Occupied => $table->occupied_since ?? now(),
                TableState::Available, TableState::Dirty => null,
                default => $table->occupied_since,
            };

            $table->update([
                'state' => $targetState,
                'current_guest_count' => $nextGuests,
                'occupied_since' => $occupiedSince,
            ]);

            $refreshed = $table->refresh();

            TableOccupancyChanged::dispatch(
                branchId: $refreshed->branch_id,
                tableId: $refreshed->id,
                tableCode: $refreshed->code,
                state: $refreshed->state,
                guestCount: $refreshed->current_guest_count,
            );

            return $refreshed;
        });
    }
}
