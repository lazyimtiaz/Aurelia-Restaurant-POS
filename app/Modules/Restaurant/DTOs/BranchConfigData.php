<?php

declare(strict_types=1);

namespace App\Modules\Restaurant\DTOs;

readonly class BranchConfigData
{
    /**
     * @param  array<string, string>|null  $operatingHours
     */
    public function __construct(
        public string $name,
        public int $taxRateBps,
        public int $serviceChargeBps,
        public int $discountPinThresholdBps,
        public int $cashVarianceToleranceCents,
        public bool $isActive,
        public ?string $timezone = null,
        public ?array $operatingHours = null,
    ) {}
}
