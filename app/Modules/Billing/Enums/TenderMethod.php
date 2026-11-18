<?php

declare(strict_types=1);

namespace App\Modules\Billing\Enums;

enum TenderMethod: string
{
    case Cash = 'cash';
    case Card = 'card';
    case Qr = 'qr';
}
