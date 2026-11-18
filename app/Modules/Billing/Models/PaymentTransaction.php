<?php

declare(strict_types=1);

namespace App\Modules\Billing\Models;

use App\Models\User;
use App\Modules\Billing\Enums\PaymentState;
use App\Modules\Billing\Enums\TenderMethod;
use App\Modules\Orders\Models\Order;
use App\Modules\Restaurant\Models\Branch;
use App\Modules\Shifts\Models\Shift;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PaymentTransaction extends Model
{
    protected $fillable = [
        'branch_id',
        'shift_id',
        'order_id',
        'bill_split_id',
        'parent_transaction_id',
        'idempotency_key',
        'tender_method',
        'state',
        'amount_cents',
        'tip_cents',
        'tendered_cents',
        'change_cents',
        'failure_reason',
        'gateway_reference',
        'processed_by_user_id',
        'refunded_with_wastage',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'tender_method' => TenderMethod::class,
            'state' => PaymentState::class,
            'amount_cents' => 'integer',
            'tip_cents' => 'integer',
            'tendered_cents' => 'integer',
            'change_cents' => 'integer',
            'refunded_with_wastage' => 'boolean',
        ];
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function shift(): BelongsTo
    {
        return $this->belongsTo(Shift::class);
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function billSplit(): BelongsTo
    {
        return $this->belongsTo(BillSplit::class);
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_transaction_id');
    }

    public function refunds(): HasMany
    {
        return $this->hasMany(self::class, 'parent_transaction_id');
    }

    public function processedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'processed_by_user_id');
    }
}
