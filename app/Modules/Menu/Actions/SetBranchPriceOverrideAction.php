<?php

declare(strict_types=1);

namespace App\Modules\Menu\Actions;

use App\Modules\Audit\Actions\RecordAuditLogAction;
use App\Modules\Menu\Models\BranchMenuOverride;
use App\Modules\Menu\Models\MenuItemVariant;
use App\Modules\Restaurant\Models\Branch;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

final class SetBranchPriceOverrideAction
{
    public function __construct(
        private readonly RecordAuditLogAction $recordAuditLog,
    ) {}

    public function execute(
        int $branchId,
        int $variantId,
        ?int $priceOverrideCents,
        int $actorUserId,
    ): BranchMenuOverride {
        if ($priceOverrideCents !== null && $priceOverrideCents < 0) {
            throw new InvalidArgumentException('Branch price override cents cannot be negative.');
        }

        return DB::transaction(function () use ($branchId, $variantId, $priceOverrideCents, $actorUserId): BranchMenuOverride {
            Branch::query()->findOrFail($branchId);
            MenuItemVariant::query()->findOrFail($variantId);

            $override = BranchMenuOverride::query()->updateOrCreate(
                [
                    'branch_id' => $branchId,
                    'menu_item_variant_id' => $variantId,
                ],
                [
                    'price_override_cents' => $priceOverrideCents,
                ],
            );

            $this->recordAuditLog->execute(
                branchId: $branchId,
                actorUserId: $actorUserId,
                approverUserId: $actorUserId,
                eventType: 'branch_price_override_set',
                auditableType: MenuItemVariant::class,
                auditableId: $variantId,
                payload: ['price_override_cents' => $priceOverrideCents],
            );

            return $override->refresh();
        });
    }
}
