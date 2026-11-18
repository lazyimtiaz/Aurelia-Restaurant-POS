<?php

declare(strict_types=1);

namespace App\Modules\Restaurant\Models;

use Illuminate\Database\Eloquent\Model;

class Branch extends Model
{
    protected $fillable = [
        'code',
        'name',
        'timezone',
        'tax_rate_bps',
        'service_charge_bps',
        'discount_pin_threshold_bps',
        'cash_variance_tolerance_cents',
        'operating_hours',
        'is_active',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'tax_rate_bps' => 'integer',
            'service_charge_bps' => 'integer',
            'discount_pin_threshold_bps' => 'integer',
            'cash_variance_tolerance_cents' => 'integer',
            'operating_hours' => 'array',
            'is_active' => 'boolean',
        ];
    }
}
