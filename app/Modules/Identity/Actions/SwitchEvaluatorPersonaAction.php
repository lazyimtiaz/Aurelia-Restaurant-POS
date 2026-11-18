<?php

declare(strict_types=1);

namespace App\Modules\Identity\Actions;

use App\Models\User;
use App\Modules\Identity\Enums\StaffRole;
use App\Modules\Restaurant\Models\Branch;
use Database\Seeders\AureliaEnterpriseSeeder;
use Illuminate\Support\Facades\Auth;

final class SwitchEvaluatorPersonaAction
{
    /**
     * @return array{branch: Branch, user: User}
     */
    public function execute(?int $branchId = null, ?StaffRole $role = null): array
    {
        if (Branch::query()->doesntExist()) {
            (new AureliaEnterpriseSeeder())->run();
        }

        $branch = $branchId !== null
            ? Branch::query()->findOrFail($branchId)
            : (Branch::query()->where('code', 'DTF')->first() ?? Branch::query()->firstOrFail());

        $targetRole = $role ?? StaffRole::Cashier;

        $user = User::query()
            ->where('role', $targetRole->value)
            ->where('branch_id', $branch->id)
            ->first()
            ?? User::query()
                ->where('role', $targetRole->value)
                ->whereNull('branch_id')
                ->firstOrFail();

        Auth::login($user);

        return [
            'branch' => $branch,
            'user' => $user,
        ];
    }
}
