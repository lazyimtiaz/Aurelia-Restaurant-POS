<?php

declare(strict_types=1);

namespace App\Modules\Kitchen\Enums;

enum VoidReason: string
{
    case CustomerChangedMind = 'customer_changed_mind';
    case KitchenError = 'kitchen_error';
    case OrderMistake = 'order_mistake';

    public function label(): string
    {
        return match ($this) {
            self::CustomerChangedMind => 'Customer Changed Mind',
            self::KitchenError => 'Kitchen Prep Error',
            self::OrderMistake => 'Server Entry Mistake',
        };
    }
}
