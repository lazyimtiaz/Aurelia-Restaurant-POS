<?php

declare(strict_types=1);

use App\Models\User;
use App\Modules\Identity\Enums\StaffRole;
use App\Modules\Identity\Services\CurrentStaffContext;
use Illuminate\Support\Facades\Broadcast;

$authorizeBranch = static function (User $user, int $branchId, array $allowedRoles = []): bool {
    $sessionActiveBranch = session(CurrentStaffContext::SESSION_ACTIVE_BRANCH_ID);
    $sessionTerminalBranch = session(CurrentStaffContext::SESSION_TERMINAL_BRANCH_ID);

    $hasBranchAccess = $user->branch_id === null
        || (int) $user->branch_id === $branchId
        || (is_numeric($sessionActiveBranch) && (int) $sessionActiveBranch === $branchId)
        || (is_numeric($sessionTerminalBranch) && (int) $sessionTerminalBranch === $branchId);

    if (! $hasBranchAccess) {
        return false;
    }

    return $allowedRoles === [] || in_array($user->role, $allowedRoles, true);
};

Broadcast::channel('branch.{branchId}.kds', function (User $user, int $branchId) use ($authorizeBranch): bool {
    return $authorizeBranch($user, $branchId, [
        StaffRole::Chef,
        StaffRole::KitchenExpediter,
        StaffRole::BranchManager,
        StaffRole::RestaurantOwner,
        StaffRole::EnterpriseSystemAdmin,
    ]);
});

Broadcast::channel('branch.{branchId}.pos', function (User $user, int $branchId) use ($authorizeBranch): bool {
    return $authorizeBranch($user, $branchId, [
        StaffRole::Cashier,
        StaffRole::Waiter,
        StaffRole::BranchManager,
        StaffRole::RestaurantOwner,
        StaffRole::EnterpriseSystemAdmin,
    ]);
});

Broadcast::channel('branch.{branchId}.floor', function (User $user, int $branchId) use ($authorizeBranch): bool {
    return $authorizeBranch($user, $branchId, [
        StaffRole::Waiter,
        StaffRole::Cashier,
        StaffRole::BranchManager,
        StaffRole::RestaurantOwner,
        StaffRole::EnterpriseSystemAdmin,
    ]);
});

Broadcast::channel('branch.{branchId}.manager', function (User $user, int $branchId) use ($authorizeBranch): bool {
    return $authorizeBranch($user, $branchId, [
        StaffRole::BranchManager,
        StaffRole::RestaurantOwner,
        StaffRole::EnterpriseSystemAdmin,
        StaffRole::InventoryManager,
    ]);
});
