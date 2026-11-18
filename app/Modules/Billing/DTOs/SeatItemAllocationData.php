<?php

declare(strict_types=1);

namespace App\Modules\Billing\DTOs;

readonly class SeatItemAllocationData
{
    public function __construct(
        public int $orderItemId,
        public int $shareNumerator = 1,
        public int $shareDenominator = 1,
    ) {}
}
