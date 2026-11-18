<?php

declare(strict_types=1);

namespace App\Modules\Billing\Enums;

enum PaymentState: string
{
    case Captured = 'captured';
    case Failed = 'failed';
    case Refunded = 'refunded';
}
