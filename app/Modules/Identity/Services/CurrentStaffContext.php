<?php

declare(strict_types=1);

namespace App\Modules\Identity\Services;

use App\Models\User;
use App\Modules\Restaurant\Models\Branch;
use App\Modules\Shifts\Queries\FindActiveOpenShiftQuery;
use Illuminate\Http\Request;
use RuntimeException;

final class CurrentStaffContext
{
    public const SESSION_TERMINAL_USER_ID = 'terminal_user_id';

    public const SESSION_TERMINAL_BRANCH_ID = 'terminal_branch_id';

    public const SESSION_STAFF_USER_ID = 'staff_user_id';

    public const SESSION_LAST_ACTIVITY_AT = 'staff_last_activity_at';

    public const SESSION_ACTIVE_BRANCH_ID = 'active_branch_id';

    public function __construct(
        private readonly FindActiveOpenShiftQuery $findActiveOpenShift,
    ) {}

    public function terminalUser(Request $request): ?User
    {
        if (! $request->hasSession()) {
            return null;
        }

        $userId = $request->session()->get(self::SESSION_TERMINAL_USER_ID);
        if (! is_numeric($userId)) {
            return null;
        }

        $user = User::query()->find((int) $userId);

        return $user instanceof User && $user->role->canSignInTerminal() ? $user : null;
    }

    public function terminalBranch(Request $request): ?Branch
    {
        if (! $request->hasSession()) {
            return null;
        }

        $branchId = $request->session()->get(self::SESSION_TERMINAL_BRANCH_ID);
        if (! is_numeric($branchId)) {
            return null;
        }

        return Branch::query()->where('is_active', true)->find((int) $branchId);
    }

    public function isIdleExpired(Request $request): bool
    {
        if (! $request->hasSession()) {
            return false;
        }

        $lastActivity = $request->session()->get(self::SESSION_LAST_ACTIVITY_AT);
        if (! is_numeric($lastActivity)) {
            return true;
        }

        $idleMinutes = (int) config('pos.idle_lock_minutes', 10);

        return (now()->timestamp - (int) $lastActivity) > ($idleMinutes * 60);
    }

    public function staffUser(Request $request): ?User
    {
        if (! $request->hasSession()) {
            return null;
        }

        if ($this->terminalUser($request) === null || $this->terminalBranch($request) === null) {
            return null;
        }

        $staffId = $request->session()->get(self::SESSION_STAFF_USER_ID);
        if (! is_numeric($staffId) || $this->isIdleExpired($request)) {
            return null;
        }

        return User::query()->find((int) $staffId);
    }

    public function activeBranch(Request $request): ?Branch
    {
        $terminalBranch = $this->terminalBranch($request);
        if (! $terminalBranch instanceof Branch) {
            return null;
        }

        $staff = $this->staffUser($request);
        if ($staff instanceof User && $staff->role->canSwitchActiveBranch()) {
            $activeBranchId = $request->session()->get(self::SESSION_ACTIVE_BRANCH_ID);
            if (is_numeric($activeBranchId)) {
                $selected = Branch::query()->where('is_active', true)->find((int) $activeBranchId);
                if ($selected instanceof Branch) {
                    return $selected;
                }
            }
        }

        return $terminalBranch;
    }

    public function touchActivity(Request $request): void
    {
        if ($request->hasSession()) {
            $request->session()->put(self::SESSION_LAST_ACTIVITY_AT, now()->timestamp);
        }
    }

    public function bindTerminalSession(Request $request, User $user, Branch $branch): void
    {
        $request->session()->put(self::SESSION_TERMINAL_USER_ID, $user->id);
        $request->session()->put(self::SESSION_TERMINAL_BRANCH_ID, $branch->id);
        $request->session()->forget([
            self::SESSION_STAFF_USER_ID,
            self::SESSION_LAST_ACTIVITY_AT,
            self::SESSION_ACTIVE_BRANCH_ID,
        ]);
    }

    public function unlockStaffSession(Request $request, User $staff, Branch $terminalBranch): void
    {
        $request->session()->put(self::SESSION_STAFF_USER_ID, $staff->id);
        $request->session()->put(self::SESSION_LAST_ACTIVITY_AT, now()->timestamp);
        $request->session()->put(self::SESSION_ACTIVE_BRANCH_ID, $terminalBranch->id);
    }

    public function lockStaffSession(Request $request): void
    {
        $request->session()->forget([
            self::SESSION_STAFF_USER_ID,
            self::SESSION_LAST_ACTIVITY_AT,
        ]);
    }

    public function signOutTerminalSession(Request $request): void
    {
        $request->session()->forget([
            self::SESSION_TERMINAL_USER_ID,
            self::SESSION_TERMINAL_BRANCH_ID,
            self::SESSION_STAFF_USER_ID,
            self::SESSION_LAST_ACTIVITY_AT,
            self::SESSION_ACTIVE_BRANCH_ID,
        ]);
    }

    public function requireStaff(Request $request): User
    {
        $staff = $this->staffUser($request);
        if (! $staff instanceof User) {
            throw new RuntimeException('Unlocked staff session is required.');
        }

        return $staff;
    }

    public function requireActiveBranch(Request $request): Branch
    {
        $branch = $this->activeBranch($request);
        if (! $branch instanceof Branch) {
            throw new RuntimeException('Active terminal branch is required.');
        }

        return $branch;
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function staffForLockScreen(int $branchId): array
    {
        return User::query()
            ->where(function ($query) use ($branchId): void {
                $query->where('branch_id', $branchId)->orWhereNull('branch_id');
            })
            ->orderBy('role')
            ->orderBy('name')
            ->get()
            ->map(static function (User $user): array {
                $parts = preg_split('/[^a-zA-Z0-9]+/', trim($user->name), -1, PREG_SPLIT_NO_EMPTY) ?: [];
                $first = $parts[0] ?? 'ST';
                $second = $parts[1] ?? null;
                $initials = strtoupper(
                    $second !== null
                        ? substr($first, 0, 1).substr($second, 0, 1)
                        : substr($first, 0, 2),
                );

                return [
                    'id' => $user->id,
                    'name' => $user->name,
                    'role' => $user->role->value,
                    'role_label' => $user->role->label(),
                    'initials' => $initials,
                    'assigned_station' => $user->assigned_station,
                ];
            })
            ->values()
            ->all();
    }

    /**
     * @return array<string, mixed>|null
     */
    public function toInertiaShared(Request $request): ?array
    {
        $terminalUser = $this->terminalUser($request);
        $terminalBranch = $this->terminalBranch($request);

        if (! $terminalUser instanceof User || ! $terminalBranch instanceof Branch) {
            return null;
        }

        $staff = $this->staffUser($request);
        $activeBranch = $this->activeBranch($request) ?? $terminalBranch;
        $activeShift = $staff instanceof User
            ? $this->findActiveOpenShift->execute($activeBranch->id, $staff->id)
            : null;

        $branches = ($staff instanceof User && $staff->role->canSwitchActiveBranch())
            ? Branch::query()
                ->where('is_active', true)
                ->orderBy('id')
                ->get(['id', 'code', 'name'])
                ->map(static fn (Branch $b): array => [
                    'id' => $b->id,
                    'code' => $b->code,
                    'name' => $b->name,
                ])
                ->values()
                ->all()
            : [];

        return [
            'terminalBranch' => [
                'id' => $terminalBranch->id,
                'code' => $terminalBranch->code,
                'name' => $terminalBranch->name,
            ],
            'terminalSignedInBy' => $terminalUser->name,
            'staff' => $staff instanceof User ? [
                'id' => $staff->id,
                'name' => $staff->name,
                'email' => $staff->email,
                'role' => $staff->role->value,
                'role_label' => $staff->role->label(),
                'branch_id' => $staff->branch_id,
                'assigned_station' => $staff->assigned_station,
                'can_authorize_pin' => $staff->role->canAuthorizeManagerPin(),
                'can_switch_branch' => $staff->role->canSwitchActiveBranch(),
                'home_route' => $staff->role->homeRoute(),
                'allowed_sections' => $staff->role->allowedSections(),
            ] : null,
            'activeBranch' => [
                'id' => $activeBranch->id,
                'code' => $activeBranch->code,
                'name' => $activeBranch->name,
                'timezone' => $activeBranch->timezone,
                'tax_rate_bps' => $activeBranch->tax_rate_bps,
                'service_charge_bps' => $activeBranch->service_charge_bps,
                'discount_pin_threshold_bps' => $activeBranch->discount_pin_threshold_bps,
                'cash_variance_tolerance_cents' => $activeBranch->cash_variance_tolerance_cents,
            ],
            'branches' => $branches,
            'activeShift' => $activeShift !== null ? [
                'id' => $activeShift->id,
                'state' => $activeShift->state->value,
                'opening_cash_cents' => $activeShift->opening_cash_cents,
                'expected_cash_cents' => $activeShift->expected_cash_cents,
                'opened_at' => $activeShift->opened_at?->toIso8601String(),
            ] : null,
        ];
    }
}
