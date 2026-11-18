<?php

declare(strict_types=1);

namespace App\Modules\Identity\Actions;

use App\Models\User;
use App\Modules\Audit\Actions\RecordAuditLogAction;
use App\Modules\Identity\Enums\StaffRole;
use App\Modules\Identity\Exceptions\InvalidManagerPinException;
use Illuminate\Support\Facades\Hash;

final class VerifyManagerPinAction
{
    public function __construct(
        private readonly RecordAuditLogAction $recordAuditLog,
    ) {}

    /**
     * @param  array<string, mixed>  $context
     */
    public function execute(
        int $branchId,
        string $pin,
        int $actorUserId,
        string $actionType,
        array $context = [],
    ): User {
        if (preg_match('/^\d{4}$/', $pin) !== 1) {
            throw InvalidManagerPinException::invalid();
        }

        $roleValues = array_map(
            static fn (StaffRole $role): string => $role->value,
            StaffRole::managerPinRoles(),
        );

        $candidates = User::query()
            ->whereIn('role', $roleValues)
            ->whereNotNull('pin_hash')
            ->where(function ($query) use ($branchId): void {
                $query->where('branch_id', $branchId)
                    ->orWhereNull('branch_id');
            })
            ->get();

        $approver = $candidates->first(
            static fn (User $candidate): bool => Hash::check($pin, (string) $candidate->pin_hash)
        );

        if (! $approver instanceof User) {
            throw InvalidManagerPinException::invalid();
        }

        $this->recordAuditLog->execute(
            branchId: $branchId,
            actorUserId: $actorUserId,
            approverUserId: $approver->id,
            eventType: 'manager_pin_verified',
            auditableType: 'action',
            auditableId: $actionType,
            payload: [
                'action_type' => $actionType,
                ...$context,
            ],
            isCritical: true,
        );

        return $approver;
    }
}
