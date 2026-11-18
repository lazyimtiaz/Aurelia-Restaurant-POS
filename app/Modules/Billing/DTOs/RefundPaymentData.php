<?php

declare(strict_types=1);

namespace App\Modules\Billing\DTOs;

readonly class RefundPaymentData
{
    public function __construct(
        public int $paymentTransactionId,
        public int $refundAmountCents,
        public string $managerPin,
        public int $actorUserId,
        public string $reason,
        public bool $wastage,
        public int $activeShiftId,
    ) {}
}
