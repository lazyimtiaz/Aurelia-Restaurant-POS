<?php

declare(strict_types=1);

namespace App\Modules\Inventory\Queries;

use App\Modules\Inventory\Models\BranchIngredientStock;
use App\Modules\Inventory\Models\RecipeItem;
use App\Modules\Inventory\Models\StockMovement;
use App\Modules\Menu\Models\BranchMenuOverride;

final class GetBranchInventoryLedgerQuery
{
    /**
     * @return array{stocks: list<array<string, mixed>>, recentMovements: list<array<string, mixed>>}
     */
    public function execute(int $branchId): array
    {
        $stocks = BranchIngredientStock::query()
            ->with('ingredient')
            ->where('branch_id', $branchId)
            ->orderBy('ingredient_id')
            ->get();

        $recipeItemsByIngredient = RecipeItem::query()
            ->with(['variant.menuItem'])
            ->get()
            ->groupBy('ingredient_id');

        $overrides = BranchMenuOverride::query()
            ->where('branch_id', $branchId)
            ->get()
            ->keyBy('menu_item_variant_id');

        $mappedStocks = $stocks->map(function (BranchIngredientStock $stock) use ($recipeItemsByIngredient, $overrides): array {
            $ingredient = $stock->ingredient;
            $recipes = $recipeItemsByIngredient->get($stock->ingredient_id) ?? collect();

            $affectedVariants = $recipes->map(function (RecipeItem $recipe) use ($overrides): array {
                $variant = $recipe->variant;
                $override = $overrides->get($recipe->menu_item_variant_id);

                return [
                    'variant_id' => $recipe->menu_item_variant_id,
                    'sku' => $variant?->sku ?? '',
                    'item_name' => $variant?->menuItem?->name ?? 'Menu Item',
                    'variant_name' => $variant?->name ?? '',
                    'quantity_required' => $recipe->quantity_required,
                    'is_available' => $override?->is_available ?? true,
                    'eighty_sixed_reason' => $override?->eighty_sixed_reason,
                ];
            })->values()->all();

            return [
                'id' => $stock->id,
                'branch_id' => $stock->branch_id,
                'ingredient_id' => $stock->ingredient_id,
                'code' => $ingredient?->code ?? '',
                'name' => $ingredient?->name ?? 'Ingredient',
                'unit' => $ingredient?->unit?->value ?? 'units',
                'unit_label' => $ingredient?->unit?->label() ?? 'Units',
                'unit_short' => $ingredient?->unit?->shortLabel() ?? 'u',
                'quantity_on_hand' => $stock->quantity_on_hand,
                'auto_86_threshold' => $stock->auto_86_threshold,
                'is_low_stock' => $stock->quantity_on_hand <= $stock->auto_86_threshold,
                'unit_cost_cents' => $stock->unit_cost_cents,
                'stock_value_cents' => max(0, $stock->quantity_on_hand) * $stock->unit_cost_cents,
                'affected_variants' => $affectedVariants,
            ];
        })->values()->all();

        $movements = StockMovement::query()
            ->with(['ingredient', 'actor'])
            ->where('branch_id', $branchId)
            ->latest('id')
            ->limit(30)
            ->get()
            ->map(static fn (StockMovement $movement): array => [
                'id' => $movement->id,
                'ingredient_id' => $movement->ingredient_id,
                'ingredient_code' => $movement->ingredient?->code ?? '',
                'ingredient_name' => $movement->ingredient?->name ?? 'Ingredient',
                'unit_short' => $movement->ingredient?->unit?->shortLabel() ?? 'u',
                'movement_type' => $movement->movement_type->value,
                'movement_label' => $movement->movement_type->label(),
                'reference_type' => $movement->reference_type,
                'reference_id' => $movement->reference_id,
                'quantity_delta' => $movement->quantity_delta,
                'unit_cost_cents' => $movement->unit_cost_cents,
                'total_cost_cents' => $movement->total_cost_cents,
                'actor_name' => $movement->actor?->name ?? 'System',
                'notes' => $movement->notes,
                'created_at_iso' => $movement->created_at?->toIso8601String(),
            ])
            ->values()
            ->all();

        return [
            'stocks' => $mappedStocks,
            'recentMovements' => $movements,
        ];
    }
}
