<?php

declare(strict_types=1);

namespace App\Modules\Shifts\Actions;

use App\Modules\Shifts\Enums\CashMovementType;
use App\Modules\Shifts\Enums\ShiftState;
use App\Modules\Shifts\Models\CashDrawerMovement;
use App\Modules\Shifts\Models\Shift;
use DomainException;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

final class RecordCashMovementAction
{
    public function execute(int $shiftId, CashMovementType $type, int $amountCents, string $reference): CashDrawerMovement
    {
        if ($amountCents <= 0) {
            throw new InvalidArgumentException('Cash drawer movement amount must be positive.');
        }

        return DB::transaction(function () use ($shiftId, $type, $amountCents, $reference): CashDrawerMovement {
            $shift = Shift::query()->whereKey($shiftId)->lockForUpdate()->firstOrFail();

            if ($shift->state !== ShiftState::Open) {
                throw new DomainException('Cannot record cash drawer movements on a non-open shift.');
            }

            $movement = CashDrawerMovement::create([
                'shift_id' => $shift->id,
                'type' => $type,
                'amount_cents' => $amountCents,
                'reference' => $reference,
            ]);

            $shift->update([
                'expected_cash_cents' => $shift->expected_cash_cents + $type->signedDelta($amountCents),
            ]);

            return $movement;
        });
    }
}
