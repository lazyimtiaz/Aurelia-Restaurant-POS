<?php

declare(strict_types=1);

namespace App\Modules\Billing\Models;

use App\Modules\Orders\Models\OrderItem;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BillSplitItem extends Model
{
    protected $fillable = [
        'bill_split_id',
        'order_item_id',
        'share_numerator',
        'share_denominator',
        'allocated_subtotal_cents',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'share_numerator' => 'integer',
            'share_denominator' => 'integer',
            'allocated_subtotal_cents' => 'integer',
        ];
    }

    public function billSplit(): BelongsTo
    {
        return $this->belongsTo(BillSplit::class);
    }

    public function orderItem(): BelongsTo
    {
        return $this->belongsTo(OrderItem::class);
    }
}
