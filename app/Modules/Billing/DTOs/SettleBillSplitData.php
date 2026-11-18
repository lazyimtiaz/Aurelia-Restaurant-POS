<?php

declare(strict_types=1);

namespace App\Modules\Billing\DTOs;

use App\Modules\Billing\Enums\TenderMethod;

readonly class SettleBillSplitData
{
    public function __construct(
        public int $billSplitId,
        public int $shiftId,
        public int $actorUserId,
        public TenderMethod $tenderMethod,
        public int $amountTenderedCents,
        public int $tipCents,
        public string $idempotencyKey,
        public bool $simulateDecline = false,
    ) {}
}
