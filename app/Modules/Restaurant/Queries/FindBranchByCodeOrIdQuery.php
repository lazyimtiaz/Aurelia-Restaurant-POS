<?php

declare(strict_types=1);

namespace App\Modules\Restaurant\Queries;

use App\Modules\Restaurant\Models\Branch;

final class FindBranchByCodeOrIdQuery
{
    public function execute(?int $branchId = null, ?string $branchCode = null): Branch
    {
        if ($branchId !== null) {
            return Branch::query()->findOrFail($branchId);
        }

        if ($branchCode !== null && $branchCode !== '') {
            return Branch::query()->where('code', strtoupper($branchCode))->firstOrFail();
        }

        return Branch::query()->where('code', 'DTF')->firstOrFail();
    }
}
