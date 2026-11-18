<?php

declare(strict_types=1);

namespace App\Modules\Orders\Models;

use App\Models\User;
use App\Modules\Floor\Models\DiningTable;
use App\Modules\Kitchen\Models\KitchenTicket;
use App\Modules\Orders\Enums\OrderState;
use App\Modules\Orders\Enums\ServiceType;
use App\Modules\Restaurant\Models\Branch;
use App\Modules\Shifts\Models\Shift;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Order extends Model
{
    protected $fillable = [
        'branch_id',
        'shift_id',
        'table_id',
        'server_id',
        'order_number',
        'service_type',
        'state',
        'guest_count',
        'customer_name',
        'subtotal_cents',
        'discount_bps',
        'discount_cents',
        'service_charge_cents',
        'tax_cents',
        'total_cents',
        'opened_at',
        'closed_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'service_type' => ServiceType::class,
            'state' => OrderState::class,
            'guest_count' => 'integer',
            'subtotal_cents' => 'integer',
            'discount_bps' => 'integer',
            'discount_cents' => 'integer',
            'service_charge_cents' => 'integer',
            'tax_cents' => 'integer',
            'total_cents' => 'integer',
            'opened_at' => 'datetime',
            'closed_at' => 'datetime',
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

    public function table(): BelongsTo
    {
        return $this->belongsTo(DiningTable::class, 'table_id');
    }

    public function server(): BelongsTo
    {
        return $this->belongsTo(User::class, 'server_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    public function kitchenTickets(): HasMany
    {
        return $this->hasMany(KitchenTicket::class);
    }
}
