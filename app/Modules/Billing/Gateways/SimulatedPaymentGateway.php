<?php

declare(strict_types=1);

namespace App\Modules\Billing\Gateways;

use App\Modules\Billing\Contracts\PaymentGatewayInterface;
use App\Modules\Billing\Enums\TenderMethod;
use Illuminate\Support\Str;

final class SimulatedPaymentGateway implements PaymentGatewayInterface
{
    public function charge(
        TenderMethod $method,
        int $amountCents,
        string $idempotencyKey,
        bool $simulateDecline = false,
    ): GatewayChargeResult {
        $shortRef = strtoupper(substr(hash('sha256', $idempotencyKey), 0, 10));

        if ($simulateDecline && $method !== TenderMethod::Cash) {
            return new GatewayChargeResult(
                succeeded: false,
                reference: "DECL-{$shortRef}",
                failureReason: 'Simulated issuer decline (insufficient funds / do not honor).',
            );
        }

        $prefix = match ($method) {
            TenderMethod::Cash => 'CASH',
            TenderMethod::Card => 'CARD',
            TenderMethod::Qr => 'QRWK',
        };

        return new GatewayChargeResult(
            succeeded: true,
            reference: "{$prefix}-{$shortRef}-".Str::upper(Str::random(4)),
        );
    }
}
