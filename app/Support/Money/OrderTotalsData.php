<?php

declare(strict_types=1);

namespace App\Support\Money;

readonly class OrderTotalsData
{
    public function __construct(
        public int $subtotalCents,
        public int $discountCents,
        public int $netSubtotalCents,
        public int $serviceChargeCents,
        public int $taxCents,
        public int $totalCents,
    ) {}
}
