<?php

declare(strict_types=1);

namespace App\Modules\Orders\Models;

use App\Modules\Kitchen\Enums\ItemPrepState;
use App\Modules\Kitchen\Enums\VoidReason;
use App\Modules\Menu\Enums\PrepStation;
use App\Modules\Menu\Models\MenuItemVariant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class OrderItem extends Model
{
    protected $fillable = [
        'order_id',
        'kitchen_ticket_id',
        'menu_item_variant_id',
        'item_name_snapshot',
        'variant_name_snapshot',
        'prep_station',
        'prep_state',
        'quantity',
        'unit_price_cents',
        'modifiers_total_cents',
        'line_total_cents',
        'seat_number',
        'special_instructions',
        'void_reason',
        'was_in_prep_at_void',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'prep_station' => PrepStation::class,
            'prep_state' => ItemPrepState::class,
            'quantity' => 'integer',
            'unit_price_cents' => 'integer',
            'modifiers_total_cents' => 'integer',
            'line_total_cents' => 'integer',
            'seat_number' => 'integer',
            'void_reason' => VoidReason::class,
            'was_in_prep_at_void' => 'boolean',
        ];
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function variant(): BelongsTo
    {
        return $this->belongsTo(MenuItemVariant::class, 'menu_item_variant_id');
    }

    public function modifiers(): HasMany
    {
        return $this->hasMany(OrderItemModifier::class);
    }
}
