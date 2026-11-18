<?php

declare(strict_types=1);

namespace App\Modules\Inventory\Actions;

use App\Modules\Inventory\Enums\StockMovementType;
use App\Modules\Inventory\Models\BranchIngredientStock;
use App\Modules\Inventory\Models\Ingredient;
use App\Modules\Inventory\Models\RecipeItem;
use App\Modules\Inventory\Models\StockMovement;
use Illuminate\Support\Facades\DB;

final class DeductRecipeIngredientsAction
{
    public function __construct(
        private readonly SyncVariantAvailabilityFromStockAction $syncAvailability,
    ) {}

    /**
     * @param  array<int, int>  $variantQuantities  Map of menu_item_variant_id => quantity
     */
    public function execute(
        int $branchId,
        string $referenceType,
        int $referenceId,
        array $variantQuantities,
        StockMovementType $movementType,
        int $actorUserId,
        bool $forceLowStockSimulation = false,
    ): void {
        $filteredVariants = [];
        foreach ($variantQuantities as $variantId => $qty) {
            if ((int) $qty > 0) {
                $filteredVariants[(int) $variantId] = (int) $qty;
            }
        }

        if ($filteredVariants === []) {
            return;
        }

        $recipeItems = RecipeItem::query()
            ->whereIn('menu_item_variant_id', array_keys($filteredVariants))
            ->get();

        if ($recipeItems->isEmpty()) {
            return;
        }

        /** @var array<int, int> $neededByIngredient */
        $neededByIngredient = [];
        foreach ($recipeItems as $recipeItem) {
            $variantQty = $filteredVariants[(int) $recipeItem->menu_item_variant_id] ?? 0;
            if ($variantQty <= 0) {
                continue;
            }

            $ingredientId = (int) $recipeItem->ingredient_id;
            $neededByIngredient[$ingredientId] = ($neededByIngredient[$ingredientId] ?? 0)
                + ((int) $recipeItem->quantity_required * $variantQty);
        }

        if ($neededByIngredient === []) {
            return;
        }

        $ingredientIds = array_keys($neededByIngredient);
        sort($ingredientIds);

        DB::transaction(function () use (
            $branchId,
            $referenceType,
            $referenceId,
            $movementType,
            $actorUserId,
            $forceLowStockSimulation,
            $neededByIngredient,
            $ingredientIds,
        ): void {
            $ingredients = Ingredient::query()
                ->whereIn('id', $ingredientIds)
                ->get()
                ->keyBy('id');

            $stocks = BranchIngredientStock::query()
                ->where('branch_id', $branchId)
                ->whereIn('ingredient_id', $ingredientIds)
                ->orderBy('ingredient_id')
                ->lockForUpdate()
                ->get()
                ->keyBy('ingredient_id');

            $alreadyRecorded = StockMovement::query()
                ->where('branch_id', $branchId)
                ->where('reference_type', $referenceType)
                ->where('reference_id', (string) $referenceId)
                ->whereIn('ingredient_id', $ingredientIds)
                ->pluck('ingredient_id')
                ->map(static fn (mixed $id): int => (int) $id)
                ->all();

            $recordedLookup = array_flip($alreadyRecorded);

            foreach ($ingredientIds as $ingredientId) {
                if (isset($recordedLookup[$ingredientId])) {
                    continue;
                }

                $ingredient = $ingredients->get($ingredientId);
                if ($ingredient === null) {
                    continue;
                }

                $stock = $stocks->get($ingredientId);
                if ($stock === null) {
                    $created = BranchIngredientStock::create([
                        'branch_id' => $branchId,
                        'ingredient_id' => $ingredientId,
                        'quantity_on_hand' => 0,
                        'auto_86_threshold' => 0,
                        'unit_cost_cents' => $ingredient->default_unit_cost_cents,
                    ]);
                    $stock = BranchIngredientStock::query()
                        ->whereKey($created->id)
                        ->lockForUpdate()
                        ->firstOrFail();
                }

                $deductQty = $neededByIngredient[$ingredientId];
                $unitCostCents = $stock->unit_cost_cents > 0
                    ? $stock->unit_cost_cents
                    : $ingredient->default_unit_cost_cents;

                $newQty = $stock->quantity_on_hand - $deductQty;
                if ($forceLowStockSimulation && $newQty > $stock->auto_86_threshold) {
                    $newQty = $stock->auto_86_threshold;
                }

                $actualDelta = $newQty - $stock->quantity_on_hand;
                $totalCostCents = abs($actualDelta) * $unitCostCents;

                $stock->update([
                    'quantity_on_hand' => $newQty,
                ]);

                StockMovement::create([
                    'branch_id' => $branchId,
                    'ingredient_id' => $ingredientId,
                    'movement_type' => $movementType,
                    'reference_type' => $referenceType,
                    'reference_id' => (string) $referenceId,
                    'quantity_delta' => $actualDelta,
                    'unit_cost_cents' => $unitCostCents,
                    'total_cost_cents' => $totalCostCents,
                    'actor_user_id' => $actorUserId,
                    'notes' => $forceLowStockSimulation ? 'Auto-86 low-stock simulation triggered' : null,
                ]);

                $this->syncAvailability->syncForIngredient(
                    branchId: $branchId,
                    stock: $stock->refresh(),
                    ingredient: $ingredient,
                    actorUserId: $actorUserId,
                );
            }
        });
    }
}
