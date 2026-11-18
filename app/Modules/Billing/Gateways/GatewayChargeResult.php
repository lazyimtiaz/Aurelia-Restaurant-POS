<?php

declare(strict_types=1);

namespace App\Modules\Billing\Gateways;

readonly class GatewayChargeResult
{
    public function __construct(
        public bool $succeeded,
        public string $reference,
        public ?string $failureReason = null,
    ) {}
}
