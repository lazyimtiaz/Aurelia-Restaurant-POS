<?php

declare(strict_types=1);

namespace App\Modules\Shifts\Actions;

use App\Modules\Audit\Actions\RecordAuditLogAction;
use App\Modules\Identity\Actions\VerifyManagerPinAction;
use App\Modules\Shifts\Enums\ShiftState;
use App\Modules\Shifts\Models\Shift;
use DomainException;
use Illuminate\Support\Facades\DB;

final class ApproveShiftVarianceAction
{
    public function __construct(
        private readonly VerifyManagerPinAction $verifyManagerPin,
        private readonly RecordAuditLogAction $recordAuditLog,
    ) {}

    public function execute(int $shiftId, string $managerPin, int $actorUserId, string $resolutionNote): Shift
    {
        return DB::transaction(function () use ($shiftId, $managerPin, $actorUserId, $resolutionNote): Shift {
            $shift = Shift::query()->whereKey($shiftId)->lockForUpdate()->firstOrFail();

            if ($shift->state !== ShiftState::VarianceFlagged) {
                throw new DomainException('Only a variance-flagged shift can be approved.');
            }

            $approver = $this->verifyManagerPin->execute(
                branchId: $shift->branch_id,
                pin: $managerPin,
                actorUserId: $actorUserId,
                actionType: 'approve_shift_variance',
                context: [
                    'shift_id' => $shift->id,
                    'variance_cents' => $shift->variance_cents,
                ],
            );

            $shift->update([
                'state' => ShiftState::Closed,
                'approved_by_user_id' => $approver->id,
                'resolution_note' => $resolutionNote,
            ]);

            $this->recordAuditLog->execute(
                branchId: $shift->branch_id,
                actorUserId: $actorUserId,
                approverUserId: $approver->id,
                eventType: 'shift_variance_approved',
                auditableType: Shift::class,
                auditableId: $shift->id,
                payload: ['resolution_note' => $resolutionNote],
                isCritical: true,
            );

            return $shift->refresh();
        });
    }
}
