<?php

declare(strict_types=1);

namespace App\Modules\Shifts\Actions;

use App\Modules\Restaurant\Models\Branch;
use App\Modules\Shifts\Enums\CashMovementType;
use App\Modules\Shifts\Enums\ShiftState;
use App\Modules\Shifts\Models\CashDrawerMovement;
use App\Modules\Shifts\Models\Shift;
use DomainException;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

final class OpenShiftAction
{
    public function execute(int $branchId, int $userId, int $openingCashCents): Shift
    {
        if ($openingCashCents < 0) {
            throw new InvalidArgumentException('Opening cash float cannot be negative.');
        }

        return DB::transaction(function () use ($branchId, $userId, $openingCashCents): Shift {
            Branch::query()->findOrFail($branchId);

            $existingOpen = Shift::query()
                ->where('branch_id', $branchId)
                ->where('user_id', $userId)
                ->where('state', ShiftState::Open->value)
                ->lockForUpdate()
                ->first();

            if ($existingOpen !== null) {
                throw new DomainException('An open shift already exists for this staff member at this branch.');
            }

            $shift = Shift::create([
                'branch_id' => $branchId,
                'user_id' => $userId,
                'state' => ShiftState::Open,
                'opening_cash_cents' => $openingCashCents,
                'expected_cash_cents' => $openingCashCents,
                'opened_at' => now(),
            ]);

            CashDrawerMovement::create([
                'shift_id' => $shift->id,
                'type' => CashMovementType::OpeningFloat,
                'amount_cents' => $openingCashCents,
                'reference' => 'SHIFT-OPEN',
            ]);

            return $shift->refresh();
        });
    }
}
