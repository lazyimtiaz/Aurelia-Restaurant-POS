<?php

declare(strict_types=1);

namespace App\Modules\Floor\Actions;

use App\Modules\Floor\Events\ServiceRequested;
use App\Modules\Floor\Models\DiningTable;
use Illuminate\Support\Facades\DB;

final class RequestTableServiceAction
{
    public function execute(int $tableId, string $requestType, int $actorUserId): void
    {
        DB::transaction(function () use ($tableId, $requestType, $actorUserId): void {
            $table = DiningTable::query()->findOrFail($tableId);

            ServiceRequested::dispatch(
                branchId: $table->branch_id,
                tableId: $table->id,
                tableCode: $table->code,
                requestType: $requestType,
                actorUserId: $actorUserId,
            );
        });
    }
}
