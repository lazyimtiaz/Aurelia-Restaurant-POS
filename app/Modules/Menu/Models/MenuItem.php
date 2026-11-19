<?php

declare(strict_types=1);

namespace App\Modules\Menu\Models;

use App\Modules\Menu\Enums\PrepStation;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class MenuItem extends Model
{
    protected $fillable = [
        'menu_category_id',
        'name',
        'slug',
        'description',
        'image_path',
        'prep_station',
        'allergen_tags',
        'is_active',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'prep_station' => PrepStation::class,
            'allergen_tags' => 'array',
            'is_active' => 'boolean',
        ];
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(MenuCategory::class, 'menu_category_id');
    }

    public function variants(): HasMany
    {
        return $this->hasMany(MenuItemVariant::class);
    }

    public function modifierGroups(): BelongsToMany
    {
        return $this->belongsToMany(ModifierGroup::class, 'menu_item_modifier_group');
    }
}
