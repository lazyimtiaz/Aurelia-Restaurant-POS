<?php

declare(strict_types=1);

namespace App\Modules\Billing\Models;

use App\Modules\Billing\Enums\BillSplitState;
use App\Modules\Billing\Enums\SplitMode;
use App\Modules\Orders\Models\Order;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class BillSplit extends Model
{
    protected $fillable = [
        'order_id',
        'sequence_number',
        'label',
        'split_mode',
        'state',
        'subtotal_cents',
        'discount_cents',
        'service_charge_cents',
        'tax_cents',
        'tip_cents',
        'total_cents',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'sequence_number' => 'integer',
            'split_mode' => SplitMode::class,
            'state' => BillSplitState::class,
            'subtotal_cents' => 'integer',
            'discount_cents' => 'integer',
            'service_charge_cents' => 'integer',
            'tax_cents' => 'integer',
            'tip_cents' => 'integer',
            'total_cents' => 'integer',
        ];
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(BillSplitItem::class);
    }

    public function transactions(): HasMany
    {
        return $this->hasMany(PaymentTransaction::class);
    }
}
