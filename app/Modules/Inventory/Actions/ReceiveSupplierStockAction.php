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

final class ReceiveSupplierStockAction
{
    public function __construct(
        private readonly RecordAuditLogAction $recordAuditLog,
        private readonly SyncVariantAvailabilityFromStockAction $syncAvailability,
    ) {}

    public function execute(
        int $branchId,
        int $ingredientId,
        int $quantity,
        int $unitCostCents,
        string $supplierRef,
        int $actorUserId,
    ): BranchIngredientStock {
        if ($quantity <= 0) {
            throw new InvalidArgumentException('Received quantity must be greater than zero.');
        }

        if ($unitCostCents < 0) {
            throw new InvalidArgumentException('Unit cost cents cannot be negative.');
        }

        return DB::transaction(function () use ($branchId, $ingredientId, $quantity, $unitCostCents, $supplierRef, $actorUserId): BranchIngredientStock {
            Branch::query()->findOrFail($branchId);
            $ingredient = Ingredient::query()->findOrFail($ingredientId);
            User::query()->findOrFail($actorUserId);

            $stock = BranchIngredientStock::query()
                ->where('branch_id', $branchId)
                ->where('ingredient_id', $ingredientId)
                ->lockForUpdate()
                ->first();

            if ($stock === null) {
                $stock = BranchIngredientStock::create([
                    'branch_id' => $branchId,
                    'ingredient_id' => $ingredientId,
                    'quantity_on_hand' => 0,
                    'auto_86_threshold' => 0,
                    'unit_cost_cents' => $unitCostCents,
                ]);
                $stock = BranchIngredientStock::query()->whereKey($stock->id)->lockForUpdate()->firstOrFail();
            }

            $existingPositive = max(0, $stock->quantity_on_hand);
            $totalWeightUnits = $existingPositive + $quantity;
            $newUnitCostCents = $totalWeightUnits > 0
                ? intdiv(($existingPositive * $stock->unit_cost_cents) + ($quantity * $unitCostCents), $totalWeightUnits)
                : $unitCostCents;

            $newQuantity = $stock->quantity_on_hand + $quantity;

            $stock->update([
                'quantity_on_hand' => $newQuantity,
                'unit_cost_cents' => $newUnitCostCents,
            ]);

            $trimmedRef = trim($supplierRef);

            $auditLog = $this->recordAuditLog->execute(
                branchId: $branchId,
                actorUserId: $actorUserId,
                approverUserId: $actorUserId,
                eventType: 'inventory_supplier_received',
                auditableType: BranchIngredientStock::class,
                auditableId: $stock->id,
                payload: [
                    'ingredient_id' => $ingredientId,
                    'ingredient_code' => $ingredient->code,
                    'quantity' => $quantity,
                    'unit_cost_cents' => $unitCostCents,
                    'supplier_ref' => $trimmedRef,
                    'new_quantity_on_hand' => $newQuantity,
                ],
                isCritical: false,
            );

            StockMovement::create([
                'branch_id' => $branchId,
                'ingredient_id' => $ingredientId,
                'movement_type' => StockMovementType::SupplierReceipt,
                'reference_type' => 'supplier_receipt',
                'reference_id' => 'audit-'.$auditLog->id,
                'quantity_delta' => $quantity,
                'unit_cost_cents' => $unitCostCents,
                'total_cost_cents' => $quantity * $unitCostCents,
                'actor_user_id' => $actorUserId,
                'notes' => $trimmedRef !== '' ? $trimmedRef : null,
            ]);

            $stock->refresh();
            $this->syncAvailability->syncForIngredient($branchId, $stock, $ingredient, $actorUserId);

            return $stock->refresh();
        });
    }
}
