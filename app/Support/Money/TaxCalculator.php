<?php

declare(strict_types=1);

namespace App\Support\Money;

use InvalidArgumentException;

final class TaxCalculator
{
    public static function compute(int $netSubtotalCents, int $rateBps): int
    {
        if ($rateBps < 0) {
            throw new InvalidArgumentException('Basis-point rate cannot be negative.');
        }

        if ($netSubtotalCents <= 0 || $rateBps === 0) {
            return 0;
        }

        return intdiv(($netSubtotalCents * $rateBps) + 5000, 10000);
    }

    public static function calculateOrderTotals(
        int $subtotalCents,
        int $discountCents,
        int $serviceChargeBps,
        int $taxRateBps,
    ): OrderTotalsData {
        if ($subtotalCents < 0) {
            throw new InvalidArgumentException('Subtotal cents cannot be negative.');
        }

        if ($discountCents < 0 || $discountCents > $subtotalCents) {
            throw new InvalidArgumentException('Discount cents must be between 0 and subtotal cents.');
        }

        $netSubtotalCents = $subtotalCents - $discountCents;
        $serviceChargeCents = self::compute($netSubtotalCents, $serviceChargeBps);
        $taxCents = self::compute($netSubtotalCents, $taxRateBps);

        return new OrderTotalsData(
            subtotalCents: $subtotalCents,
            discountCents: $discountCents,
            netSubtotalCents: $netSubtotalCents,
            serviceChargeCents: $serviceChargeCents,
            taxCents: $taxCents,
            totalCents: $netSubtotalCents + $serviceChargeCents + $taxCents,
        );
    }
}
