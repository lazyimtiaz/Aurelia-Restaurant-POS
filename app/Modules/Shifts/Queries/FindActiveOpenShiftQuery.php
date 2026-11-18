<?php

declare(strict_types=1);

namespace App\Modules\Shifts\Queries;

use App\Modules\Shifts\Enums\ShiftState;
use App\Modules\Shifts\Models\Shift;

final class FindActiveOpenShiftQuery
{
    public function execute(int $branchId, ?int $userId = null): ?Shift
    {
        $query = Shift::query()
            ->where('branch_id', $branchId)
            ->where('state', ShiftState::Open->value);

        if ($userId !== null) {
            $userShift = (clone $query)->where('user_id', $userId)->latest('opened_at')->first();
            if ($userShift !== null) {
                return $userShift;
            }
        }

        return $query->latest('opened_at')->first();
    }
}
