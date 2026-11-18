<?php

declare(strict_types=1);

namespace App\Modules\Menu\Actions;

use App\Modules\Audit\Actions\RecordAuditLogAction;
use App\Modules\Menu\Events\ItemAvailabilityChanged;
use App\Modules\Menu\Models\BranchMenuOverride;
use App\Modules\Menu\Models\MenuItemVariant;
use App\Modules\Restaurant\Models\Branch;
use Illuminate\Support\Facades\DB;

final class ToggleBranchItemAvailabilityAction
{
    public function __construct(
        private readonly RecordAuditLogAction $recordAuditLog,
    ) {}

    public function execute(
        int $branchId,
        int $variantId,
        bool $isAvailable,
        ?string $reason,
        int $actorUserId,
    ): BranchMenuOverride {
        return DB::transaction(function () use ($branchId, $variantId, $isAvailable, $reason, $actorUserId): BranchMenuOverride {
            Branch::query()->findOrFail($branchId);
            MenuItemVariant::query()->findOrFail($variantId);

            $override = BranchMenuOverride::query()->updateOrCreate(
                [
                    'branch_id' => $branchId,
                    'menu_item_variant_id' => $variantId,
                ],
                [
                    'is_available' => $isAvailable,
                    'eighty_sixed_reason' => $isAvailable ? null : $reason,
                ],
            );

            $this->recordAuditLog->execute(
                branchId: $branchId,
                actorUserId: $actorUserId,
                approverUserId: $actorUserId,
                eventType: 'item_86_toggled',
                auditableType: MenuItemVariant::class,
                auditableId: $variantId,
                payload: [
                    'is_available' => $isAvailable,
                    'reason' => $reason,
                ],
                isCritical: ! $isAvailable,
            );

            ItemAvailabilityChanged::dispatch(
                branchId: $branchId,
                variantId: $variantId,
                isAvailable: $isAvailable,
                reason: $override->eighty_sixed_reason,
            );

            return $override->refresh();
        });
    }
}
