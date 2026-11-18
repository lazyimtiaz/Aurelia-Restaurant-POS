<?php

declare(strict_types=1);

namespace App\Modules\Kitchen\Models;

use App\Models\User;
use App\Modules\Kitchen\Enums\TicketState;
use App\Modules\Orders\Models\Order;
use App\Modules\Orders\Models\OrderItem;
use App\Modules\Restaurant\Models\Branch;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class KitchenTicket extends Model
{
    protected $fillable = [
        'branch_id',
        'order_id',
        'round_number',
        'state',
        'fired_by_user_id',
        'fired_at',
        'ready_at',
        'served_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'round_number' => 'integer',
            'state' => TicketState::class,
            'fired_at' => 'datetime',
            'ready_at' => 'datetime',
            'served_at' => 'datetime',
        ];
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function firedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'fired_by_user_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(OrderItem::class, 'kitchen_ticket_id');
    }
}
