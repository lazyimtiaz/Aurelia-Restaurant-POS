<?php

declare(strict_types=1);

namespace App\Modules\Menu\Enums;

enum PrepStation: string
{
    case Grill = 'grill';
    case ColdSalad = 'cold_salad';
    case Pastry = 'pastry';
    case Bar = 'bar';

    public function label(): string
    {
        return match ($this) {
            self::Grill => 'Grill & Hot Line',
            self::ColdSalad => 'Cold & Garde Manger',
            self::Pastry => 'Pastry & Desserts',
            self::Bar => 'Bar & Beverages',
        };
    }
}
