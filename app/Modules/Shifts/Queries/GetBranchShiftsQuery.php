<?php

declare(strict_types=1);

namespace App\Modules\Shifts\Queries;

use App\Modules\Shifts\Enums\ShiftState;
use App\Modules\Shifts\Models\Shift;

final class GetBranchShiftsQuery
{
    /**
     * @return list<array<string, mixed>>
     */
    public function execute(int $branchId): array
    {
        return Shift::query()
            ->where('branch_id', $branchId)
            ->with('user')
            ->latest('opened_at')
            ->limit(15)
            ->get()
            ->map(fn (Shift $shift): array => [
                'id' => $shift->id,
                'user_name' => $shift->user?->name,
                'state' => $shift->state->value,
                'opening_cash_cents' => $shift->opening_cash_cents,
                'expected_cash_cents' => $shift->state === ShiftState::Open ? null : $shift->expected_cash_cents,
                'counted_cash_cents' => $shift->counted_cash_cents,
                'variance_cents' => $shift->variance_cents,
                'opened_at' => $shift->opened_at?->toIso8601String(),
                'closed_at' => $shift->closed_at?->toIso8601String(),
                'resolution_note' => $shift->resolution_note,
            ])
            ->values()
            ->all();
    }
}
