<?php

declare(strict_types=1);

namespace App\Modules\Billing\DTOs;

use App\Modules\Billing\Enums\SplitMode;

readonly class SplitOrderBillData
{
    /**
     * @param  array<string, list<SeatItemAllocationData>>  $seatGroups
     */
    public function __construct(
        public int $orderId,
        public SplitMode $mode,
        public ?int $equalWays = null,
        public array $seatGroups = [],
    ) {}
}
