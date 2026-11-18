<?php

declare(strict_types=1);

namespace App\Modules\Inventory\Models;

use App\Modules\Restaurant\Models\Branch;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BranchIngredientStock extends Model
{
    protected $fillable = [
        'branch_id',
        'ingredient_id',
        'quantity_on_hand',
        'auto_86_threshold',
        'unit_cost_cents',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'quantity_on_hand' => 'integer',
            'auto_86_threshold' => 'integer',
            'unit_cost_cents' => 'integer',
        ];
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function ingredient(): BelongsTo
    {
        return $this->belongsTo(Ingredient::class);
    }
}
