<?php

declare(strict_types=1);

namespace App\Modules\Shifts\Actions;

use App\Modules\Audit\Actions\RecordAuditLogAction;
use App\Modules\Restaurant\Models\Branch;
use App\Modules\Shifts\Enums\ShiftState;
use App\Modules\Shifts\Events\ShiftVarianceFlagged;
use App\Modules\Shifts\Models\Shift;
use DomainException;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

final class CloseShiftAction
{
    public function __construct(
        private readonly RecordAuditLogAction $recordAuditLog,
    ) {}

    public function execute(int $shiftId, int $countedCashCents, ?string $notes = null): Shift
    {
        if ($countedCashCents < 0) {
            throw new InvalidArgumentException('Counted cash cents cannot be negative.');
        }

        return DB::transaction(function () use ($shiftId, $countedCashCents, $notes): Shift {
            $shift = Shift::query()->whereKey($shiftId)->lockForUpdate()->firstOrFail();

            if ($shift->state !== ShiftState::Open) {
                throw new DomainException('Only an open shift can be closed.');
            }

            $branch = Branch::query()->findOrFail($shift->branch_id);
            $varianceCents = $countedCashCents - $shift->expected_cash_cents;
            $exceedsTolerance = abs($varianceCents) > $branch->cash_variance_tolerance_cents;
            $targetState = $exceedsTolerance ? ShiftState::VarianceFlagged : ShiftState::Closed;

            $shift->update([
                'state' => $targetState,
                'counted_cash_cents' => $countedCashCents,
                'variance_cents' => $varianceCents,
                'closed_at' => now(),
                'notes' => $notes,
            ]);

            if ($exceedsTolerance) {
                $this->recordAuditLog->execute(
                    branchId: $shift->branch_id,
                    actorUserId: $shift->user_id,
                    approverUserId: null,
                    eventType: 'shift_variance_flagged',
                    auditableType: Shift::class,
                    auditableId: $shift->id,
                    payload: [
                        'expected_cash_cents' => $shift->expected_cash_cents,
                        'counted_cash_cents' => $countedCashCents,
                        'variance_cents' => $varianceCents,
                        'tolerance_cents' => $branch->cash_variance_tolerance_cents,
                    ],
                    isCritical: true,
                );

                ShiftVarianceFlagged::dispatch(
                    branchId: $shift->branch_id,
                    shiftId: $shift->id,
                    userId: $shift->user_id,
                    expectedCashCents: $shift->expected_cash_cents,
                    countedCashCents: $countedCashCents,
                    varianceCents: $varianceCents,
                );
            }

            return $shift->refresh();
        });
    }
}
