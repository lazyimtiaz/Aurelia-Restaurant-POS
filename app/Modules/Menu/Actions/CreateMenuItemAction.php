<?php

declare(strict_types=1);

namespace App\Modules\Menu\Actions;

use App\Modules\Audit\Actions\RecordAuditLogAction;
use App\Modules\Menu\Enums\PrepStation;
use App\Modules\Menu\Models\MenuCategory;
use App\Modules\Menu\Models\MenuItem;
use App\Modules\Menu\Models\MenuItemVariant;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use InvalidArgumentException;

final class CreateMenuItemAction
{
    public function __construct(
        private readonly RecordAuditLogAction $recordAudit,
    ) {}

    public function execute(
        int $branchId,
        int $menuCategoryId,
        string $name,
        ?string $description,
        PrepStation $prepStation,
        string $variantName,
        string $sku,
        int $basePriceCents,
        int $actorUserId,
    ): MenuItem {
        if ($basePriceCents < 0) {
            throw new InvalidArgumentException('Base price cannot be negative.');
        }

        $trimmedName = trim($name);
        $trimmedSku = strtoupper(trim($sku));
        $trimmedVariant = trim($variantName) ?: 'Standard';

        if ($trimmedName === '' || $trimmedSku === '') {
            throw new InvalidArgumentException('Item name and SKU are required.');
        }

        return DB::transaction(function () use (
            $branchId,
            $menuCategoryId,
            $trimmedName,
            $description,
            $prepStation,
            $trimmedVariant,
            $trimmedSku,
            $basePriceCents,
            $actorUserId,
        ): MenuItem {
            MenuCategory::query()->whereKey($menuCategoryId)->firstOrFail();

            if (MenuItemVariant::query()->where('sku', $trimmedSku)->exists()) {
                throw new InvalidArgumentException("SKU '{$trimmedSku}' already exists in the catalog.");
            }

            $baseSlug = Str::slug($trimmedName) ?: 'menu-item';
            $slug = $baseSlug;
            $suffix = 2;
            while (MenuItem::query()->where('slug', $slug)->exists()) {
                $slug = "{$baseSlug}-{$suffix}";
                $suffix++;
            }

            $item = MenuItem::create([
                'menu_category_id' => $menuCategoryId,
                'name' => $trimmedName,
                'slug' => $slug,
                'description' => $description !== null && trim($description) !== '' ? trim($description) : null,
                'image_path' => null,
                'prep_station' => $prepStation,
                'allergen_tags' => [],
                'is_active' => true,
            ]);

            $variant = MenuItemVariant::create([
                'menu_item_id' => $item->id,
                'name' => $trimmedVariant,
                'sku' => $trimmedSku,
                'base_price_cents' => $basePriceCents,
                'is_active' => true,
            ]);

            $this->recordAudit->execute(
                branchId: $branchId,
                actorUserId: $actorUserId,
                approverUserId: null,
                eventType: 'menu.item_created',
                auditableType: MenuItem::class,
                auditableId: $item->id,
                payload: [
                    'name' => $item->name,
                    'sku' => $variant->sku,
                    'prep_station' => $prepStation->value,
                    'base_price_cents' => $basePriceCents,
                ],
                isCritical: false,
            );

            return $item->load('variants');
        });
    }
}
