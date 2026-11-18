<?php

declare(strict_types=1);

namespace App\Modules\Orders\Enums;

enum OrderState: string
{
    case Draft = 'draft';
    case Open = 'open';
    case Billing = 'billing';
    case PartiallyPaid = 'partially_paid';
    case Paid = 'paid';
    case Voided = 'voided';

    public function canAcceptNewItems(): bool
    {
        return match ($this) {
            self::Draft, self::Open => true,
            default => false,
        };
    }
}
