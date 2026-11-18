<?php

declare(strict_types=1);

namespace App\Modules\Floor\Enums;

enum TableState: string
{
    case Available = 'available';
    case Reserved = 'reserved';
    case Occupied = 'occupied';
    case Billing = 'billing';
    case Dirty = 'dirty';

    public function canBeOccupied(): bool
    {
        return match ($this) {
            self::Available, self::Reserved => true,
            default => false,
        };
    }

    public function label(): string
    {
        return match ($this) {
            self::Available => 'Available',
            self::Reserved => 'Reserved',
            self::Occupied => 'Occupied',
            self::Billing => 'Billing',
            self::Dirty => 'Needs Clearing',
        };
    }
}
