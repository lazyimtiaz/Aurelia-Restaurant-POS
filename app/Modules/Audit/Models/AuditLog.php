<?php

declare(strict_types=1);

namespace App\Modules\Audit\Models;

use App\Models\User;
use App\Modules\Restaurant\Models\Branch;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AuditLog extends Model
{
    protected $fillable = [
        'branch_id',
        'actor_user_id',
        'approver_user_id',
        'event_type',
        'auditable_type',
        'auditable_id',
        'payload',
        'is_critical',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'payload' => 'array',
            'is_critical' => 'boolean',
        ];
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_user_id');
    }

    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approver_user_id');
    }
}
