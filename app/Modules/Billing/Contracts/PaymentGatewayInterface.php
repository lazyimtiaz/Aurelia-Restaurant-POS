<?php

declare(strict_types=1);

namespace App\Modules\Billing\Contracts;

use App\Modules\Billing\Enums\TenderMethod;
use App\Modules\Billing\Gateways\GatewayChargeResult;

interface PaymentGatewayInterface
{
    public function charge(
        TenderMethod $method,
        int $amountCents,
        string $idempotencyKey,
        bool $simulateDecline = false,
    ): GatewayChargeResult;
}
