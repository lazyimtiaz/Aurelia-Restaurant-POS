<?php

declare(strict_types=1);

namespace App\Modules\Identity\Actions;

use App\Models\User;
use App\Modules\Audit\Actions\RecordAuditLogAction;
use App\Modules\Restaurant\Models\Branch;
use DomainException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

final class SignInTerminalAction
{
    public function __construct(
        private readonly RecordAuditLogAction $recordAuditLog,
    ) {}

    /**
     * @return array{user: User, branch: Branch}
     */
    public function execute(string $email, string $password, ?int $branchId = null): array
    {
        $normalizedEmail = trim(strtolower($email));
        $user = User::query()->where('email', $normalizedEmail)->first();

        if (! $user instanceof User || ! Hash::check($password, $user->password)) {
            throw new DomainException('Invalid email or password.');
        }

        if (! $user->role->canSignInTerminal()) {
            throw new DomainException('Only Managers, Owners, or System Admins may sign in a POS terminal.');
        }

        if ($user->role->canSwitchActiveBranch()) {
            $branch = $branchId !== null
                ? Branch::query()->where('is_active', true)->find($branchId)
                : Branch::query()->where('is_active', true)->orderBy('id')->first();
        } else {
            $branch = $user->branch_id !== null
                ? Branch::query()->where('is_active', true)->find($user->branch_id)
                : null;
        }

        if (! $branch instanceof Branch) {
            throw new DomainException('Selected branch is unavailable or inactive.');
        }

        DB::transaction(function () use ($branch, $user): void {
            $this->recordAuditLog->execute(
                branchId: $branch->id,
                actorUserId: $user->id,
                approverUserId: $user->id,
                eventType: 'terminal_signed_in',
                auditableType: Branch::class,
                auditableId: $branch->id,
                payload: [
                    'branch_code' => $branch->code,
                    'role' => $user->role->value,
                ],
            );
        });

        return [
            'user' => $user,
            'branch' => $branch,
        ];
    }
}
