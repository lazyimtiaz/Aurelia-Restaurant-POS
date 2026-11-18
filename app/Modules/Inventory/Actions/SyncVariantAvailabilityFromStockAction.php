<?php

declare(strict_types=1);

namespace App\Modules\Inventory\Actions;

use App\Modules\Inventory\Models\BranchIngredientStock;
use App\Modules\Inventory\Models\Ingredient;
use App\Modules\Inventory\Models\RecipeItem;
use App\Modules\Menu\Actions\ToggleBranchItemAvailabilityAction;
use App\Modules\Menu\Models\BranchMenuOverride;

final class SyncVariantAvailabilityFromStockAction
{
    public function __construct(
        private readonly ToggleBranchItemAvailabilityAction $toggleAvailability,
    ) {}

    public function syncForIngredient(
        int $branchId,
        BranchIngredientStock $stock,
        Ingredient $ingredient,
        int $actorUserId,
    ): void {
        $variantIds = RecipeItem::query()
            ->where('ingredient_id', $ingredient->id)
            ->pluck('menu_item_variant_id')
            ->map(static fn (mixed $id): int => (int) $id)
            ->unique()
            ->values()
            ->all();

        if ($variantIds === []) {
            return;
        }

        if ($stock->quantity_on_hand <= $stock->auto_86_threshold) {
            $overrides = BranchMenuOverride::query()
                ->where('branch_id', $branchId)
                ->whereIn('menu_item_variant_id', $variantIds)
                ->get()
                ->keyBy('menu_item_variant_id');

            foreach ($variantIds as $variantId) {
                $override = $overrides->get($variantId);
                $currentlyAvailable = $override?->is_available ?? true;

                if ($currentlyAvailable) {
                    $this->toggleAvailability->execute(
                        branchId: $branchId,
                        variantId: $variantId,
                        isAvailable: false,
                        reason: "Auto-86: {$ingredient->name} depleted ({$stock->quantity_on_hand} {$ingredient->unit->shortLabel()} remaining)",
                        actorUserId: $actorUserId,
                    );
                }
            }

            return;
        }

        $unavailableVariantIds = BranchMenuOverride::query()
            ->where('branch_id', $branchId)
            ->whereIn('menu_item_variant_id', $variantIds)
            ->where('is_available', false)
            ->pluck('menu_item_variant_id')
            ->map(static fn (mixed $id): int => (int) $id)
            ->all();

        if ($unavailableVariantIds === []) {
            return;
        }

        $recipeRows = RecipeItem::query()
            ->whereIn('menu_item_variant_id', $unavailableVariantIds)
            ->get()
            ->groupBy('menu_item_variant_id');

        $allIngredientIds = $recipeRows->flatten()->pluck('ingredient_id')->unique()->all();

        $branchStocks = BranchIngredientStock::query()
            ->where('branch_id', $branchId)
            ->whereIn('ingredient_id', $allIngredientIds)
            ->get()
            ->keyBy('ingredient_id');

        foreach ($unavailableVariantIds as $variantId) {
            $variantRecipes = $recipeRows->get($variantId);
            if ($variantRecipes === null || $variantRecipes->isEmpty()) {
                continue;
            }

            $allAboveThreshold = $variantRecipes->every(function (RecipeItem $recipeItem) use ($branchStocks): bool {
                $ingredientStock = $branchStocks->get($recipeItem->ingredient_id);

                return $ingredientStock !== null
                    && $ingredientStock->quantity_on_hand > $ingredientStock->auto_86_threshold;
            });

            if ($allAboveThreshold) {
                $this->toggleAvailability->execute(
                    branchId: $branchId,
                    variantId: $variantId,
                    isAvailable: true,
                    reason: null,
                    actorUserId: $actorUserId,
                );
            }
        }
    }
}
