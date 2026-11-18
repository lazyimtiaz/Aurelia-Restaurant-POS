<?php

declare(strict_types=1);

namespace App\Modules\Billing\DTOs;

readonly class ThermalReceiptData
{
    /**
     * @param  list<array<string, mixed>>  $lineItems
     * @param  list<array<string, mixed>>  $payments
     */
    public function __construct(
        public int $billSplitId,
        public string $branchName,
        public string $branchCode,
        public string $orderNumber,
        public string $checkLabel,
        public string $splitMode,
        public ?string $tableCode,
        public ?string $customerName,
        public string $issuedAtIso,
        public array $lineItems,
        public int $subtotalCents,
        public int $discountCents,
        public int $serviceChargeCents,
        public int $taxCents,
        public int $tipCents,
        public int $totalCents,
        public array $payments,
    ) {}
}
