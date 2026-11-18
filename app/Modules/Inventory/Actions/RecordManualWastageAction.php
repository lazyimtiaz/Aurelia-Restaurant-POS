<?php

declare(strict_types=1);

namespace App\Modules\Inventory\Actions;

use App\Models\User;
use App\Modules\Audit\Actions\RecordAuditLogAction;
use App\Modules\Inventory\Enums\StockMovementType;
use App\Modules\Inventory\Models\BranchIngredientStock;
use App\Modules\Inventory\Models\Ingredient;
use App\Modules\Inventory\Models\StockMovement;
use App\Modules\Restaurant\Models\Branch;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

final class RecordManualWastageAction
{
    public function __construct(
        private readonly RecordAuditLogAction $recordAuditLog,
        private readonly SyncVariantAvailabilityFromStockAction $syncAvailability,
    ) {}

    public function execute(
        int $branchId,
        int $ingredientId,
        int $quantity,
        string $reason,
        int $actorUserId,
    ): BranchIngredientStock {
        if ($quantity <= 0) {
            throw new InvalidArgumentException('Wastage quantity must be greater than zero.');
        }

        return DB::transaction(function () use ($branchId, $ingredientId, $quantity, $reason, $actorUserId): BranchIngredientStock {
            Branch::query()->findOrFail($branchId);
            $ingredient = Ingredient::query()->findOrFail($ingredientId);
            User::query()->findOrFail($actorUserId);

            $stock = BranchIngredientStock::query()
                ->where('branch_id', $branchId)
                ->where('ingredient_id', $ingredientId)
                ->lockForUpdate()
                ->firstOrFail();

            $unitCostCents = $stock->unit_cost_cents > 0
                ? $stock->unit_cost_cents
                : $ingredient->default_unit_cost_cents;

            $newQuantity = $stock->quantity_on_hand - $quantity;

            $stock->update([
                'quantity_on_hand' => $newQuantity,
            ]);

            $auditLog = $this->recordAuditLog->execute(
                branchId: $branchId,
                actorUserId: $actorUserId,
                approverUserId: $actorUserId,
                eventType: 'inventory_wastage_recorded',
                auditableType: BranchIngredientStock::class,
                auditableId: $stock->id,
                payload: [
                    'ingredient_id' => $ingredientId,
                    'ingredient_code' => $ingredient->code,
                    'quantity' => $quantity,
                    'unit_cost_cents' => $unitCostCents,
                    'total_cost_cents' => $quantity * $unitCostCents,
                    'reason' => $reason,
                    'new_quantity_on_hand' => $newQuantity,
                ],
                isCritical: true,
            );

            StockMovement::create([
                'branch_id' => $branchId,
                'ingredient_id' => $ingredientId,
                'movement_type' => StockMovementType::Wastage,
                'reference_type' => 'manual_wastage',
                'reference_id' => 'audit-'.$auditLog->id,
                'quantity_delta' => -$quantity,
                'unit_cost_cents' => $unitCostCents,
                'total_cost_cents' => $quantity * $unitCostCents,
                'actor_user_id' => $actorUserId,
                'notes' => trim($reason) !== '' ? trim($reason) : null,
            ]);

            $stock->refresh();
            $this->syncAvailability->syncForIngredient($branchId, $stock, $ingredient, $actorUserId);

            return $stock->refresh();
        });
    }
}
