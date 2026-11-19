<?php

declare(strict_types=1);

namespace App\Modules\Identity\Actions;

use App\Models\User;
use App\Modules\Audit\Actions\RecordAuditLogAction;
use App\Modules\Identity\Exceptions\InvalidStaffPinException;
use App\Modules\Identity\Exceptions\TooManyPinAttemptsException;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;

final class UnlockStaffByPinAction
{
    private const MAX_ATTEMPTS = 5;

    private const DECAY_SECONDS = 60;

    public function __construct(
        private readonly RecordAuditLogAction $recordAuditLog,
    ) {}

    public function execute(int $terminalBranchId, int $staffUserId, string $pin): User
    {
        $rateKey = "pos-pin:{$terminalBranchId}:{$staffUserId}";

        if (RateLimiter::tooManyAttempts($rateKey, self::MAX_ATTEMPTS)) {
            $seconds = RateLimiter::availableIn($rateKey);

            $this->recordAuditLog->execute(
                branchId: $terminalBranchId,
                actorUserId: $staffUserId,
                approverUserId: null,
                eventType: 'staff_pin_locked_out',
                auditableType: User::class,
                auditableId: $staffUserId,
                payload: ['retry_after_seconds' => $seconds],
                isCritical: true,
            );

            throw new TooManyPinAttemptsException(
                "Too many incorrect PIN attempts. Try again in {$seconds} seconds.",
            );
        }

        $staff = User::query()->find($staffUserId);
        if (! $staff instanceof User || ($staff->branch_id !== null && (int) $staff->branch_id !== $terminalBranchId)) {
            throw new InvalidStaffPinException('Staff member is not assigned to this terminal branch.');
        }

        if (
            preg_match('/^\d{4}$/', $pin) !== 1
            || $staff->pin_hash === null
            || ! Hash::check($pin, (string) $staff->pin_hash)
        ) {
            RateLimiter::hit($rateKey, self::DECAY_SECONDS);

            $this->recordAuditLog->execute(
                branchId: $terminalBranchId,
                actorUserId: $staff->id,
                approverUserId: null,
                eventType: 'staff_pin_failed',
                auditableType: User::class,
                auditableId: $staff->id,
                payload: ['attempts_remaining' => RateLimiter::remaining($rateKey, self::MAX_ATTEMPTS)],
                isCritical: true,
            );

            if (RateLimiter::tooManyAttempts($rateKey, self::MAX_ATTEMPTS)) {
                $seconds = RateLimiter::availableIn($rateKey);
                throw new TooManyPinAttemptsException(
                    "Too many incorrect PIN attempts. Try again in {$seconds} seconds.",
                );
            }

            throw new InvalidStaffPinException('Incorrect 4-digit PIN.');
        }

        RateLimiter::clear($rateKey);

        $this->recordAuditLog->execute(
            branchId: $terminalBranchId,
            actorUserId: $staff->id,
            approverUserId: null,
            eventType: 'staff_unlocked',
            auditableType: User::class,
            auditableId: $staff->id,
            payload: ['role' => $staff->role->value],
        );

        return $staff;
    }
}
