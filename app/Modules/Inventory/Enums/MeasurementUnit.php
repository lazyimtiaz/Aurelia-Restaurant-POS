<?php

declare(strict_types=1);

namespace App\Modules\Inventory\Enums;

enum MeasurementUnit: string
{
    case Grams = 'grams';
    case Milliliters = 'milliliters';
    case Units = 'units';

    public function label(): string
    {
        return match ($this) {
            self::Grams => 'Grams',
            self::Milliliters => 'Milliliters',
            self::Units => 'Units',
        };
    }

    public function shortLabel(): string
    {
        return match ($this) {
            self::Grams => 'g',
            self::Milliliters => 'ml',
            self::Units => 'u',
        };
    }
}
