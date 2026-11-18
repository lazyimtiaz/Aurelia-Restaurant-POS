<?php

declare(strict_types=1);

namespace App\Modules\Orders\Enums;

enum ServiceType: string
{
    case DineIn = 'dine_in';
    case Takeaway = 'takeaway';
    case Pickup = 'pickup';
}
