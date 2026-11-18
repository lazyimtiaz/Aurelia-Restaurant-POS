<?php

declare(strict_types=1);

namespace App\Modules\Shifts\Models;

use App\Models\User;
use App\Modules\Restaurant\Models\Branch;
use App\Modules\Shifts\Enums\ShiftState;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Shift extends Model
{
    protected $fillable = [
        'branch_id',
        'user_id',
        'state',
        'opening_cash_cents',
        'expected_cash_cents',
        'counted_cash_cents',
        'variance_cents',
        'opened_at',
        'closed_at',
        'notes',
        'approved_by_user_id',
        'resolution_note',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'state' => ShiftState::class,
            'opening_cash_cents' => 'integer',
            'expected_cash_cents' => 'integer',
            'counted_cash_cents' => 'integer',
            'variance_cents' => 'integer',
            'opened_at' => 'datetime',
            'closed_at' => 'datetime',
        ];
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function approvedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by_user_id');
    }

    public function movements(): HasMany
    {
        return $this->hasMany(CashDrawerMovement::class);
    }
}
