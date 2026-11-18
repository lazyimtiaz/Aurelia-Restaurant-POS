<?php

declare(strict_types=1);

namespace App\Modules\Floor\Models;

use App\Modules\Floor\Enums\TableState;
use App\Modules\Restaurant\Models\Branch;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DiningTable extends Model
{
    protected $fillable = [
        'branch_id',
        'floor_zone_id',
        'code',
        'capacity',
        'state',
        'current_guest_count',
        'occupied_since',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'capacity' => 'integer',
            'state' => TableState::class,
            'current_guest_count' => 'integer',
            'occupied_since' => 'datetime',
        ];
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function zone(): BelongsTo
    {
        return $this->belongsTo(FloorZone::class, 'floor_zone_id');
    }
}
