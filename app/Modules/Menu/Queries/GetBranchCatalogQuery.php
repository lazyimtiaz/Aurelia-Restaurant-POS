<?php

declare(strict_types=1);

namespace App\Modules\Menu\Queries;

use App\Modules\Menu\Models\BranchMenuOverride;
use App\Modules\Menu\Models\MenuCategory;
use App\Modules\Menu\Models\MenuItem;
use App\Modules\Menu\Models\MenuItemVariant;
use App\Modules\Menu\Models\ModifierGroup;
use App\Modules\Menu\Models\ModifierOption;
use Illuminate\Support\Collection;

final class GetBranchCatalogQuery
{
    /**
     * @return Collection<int, array<string, mixed>>
     */
    public function execute(int $branchId): Collection
    {
        $overrides = BranchMenuOverride::query()
            ->where('branch_id', $branchId)
            ->get()
            ->keyBy('menu_item_variant_id');

        $categories = MenuCategory::query()
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->with([
                'items' => fn ($query) => $query->where('is_active', true)->orderBy('id'),
                'items.variants' => fn ($query) => $query->where('is_active', true)->orderBy('id'),
                'items.modifierGroups.options' => fn ($query) => $query->where('is_active', true)->orderBy('id'),
            ])
            ->get();

        return $categories->map(function (MenuCategory $category) use ($overrides): array {
            return [
                'id' => $category->id,
                'name' => $category->name,
                'slug' => $category->slug,
                'items' => $category->items->map(function (MenuItem $item) use ($overrides): array {
                    return [
                        'id' => $item->id,
                        'name' => $item->name,
                        'slug' => $item->slug,
                        'description' => $item->description,
                        'prep_station' => $item->prep_station->value,
                        'prep_station_label' => $item->prep_station->label(),
                        'allergen_tags' => $item->allergen_tags ?? [],
                        'variants' => $item->variants->map(function (MenuItemVariant $variant) use ($overrides): array {
                            /** @var BranchMenuOverride|null $override */
                            $override = $overrides->get($variant->id);

                            return [
                                'id' => $variant->id,
                                'name' => $variant->name,
                                'sku' => $variant->sku,
                                'base_price_cents' => $variant->base_price_cents,
                                'price_override_cents' => $override?->price_override_cents,
                                'effective_price_cents' => $override?->price_override_cents ?? $variant->base_price_cents,
                                'is_available' => $override?->is_available ?? true,
                                'eighty_sixed_reason' => $override?->eighty_sixed_reason,
                            ];
                        })->values()->all(),
                        'modifier_groups' => $item->modifierGroups->map(fn (ModifierGroup $group): array => [
                            'id' => $group->id,
                            'name' => $group->name,
                            'min_select' => $group->min_select,
                            'max_select' => $group->max_select,
                            'is_required' => $group->is_required,
                            'options' => $group->options->map(fn (ModifierOption $option): array => [
                                'id' => $option->id,
                                'name' => $option->name,
                                'price_delta_cents' => $option->price_delta_cents,
                            ])->values()->all(),
                        ])->values()->all(),
                    ];
                })->values()->all(),
            ];
        });
    }
}
