<?php

declare(strict_types=1);

namespace App\Modules\Reporting\DTOs;

use Illuminate\Contracts\Support\Arrayable;

/**
 * @implements Arrayable<string, mixed>
 */
readonly class BranchComparisonRowData implements Arrayable
{
    public function __construct(
        public int $branchId,
        public string $branchCode,
        public string $branchName,
        public int $revenueCents,
        public int $ordersCount,
        public int $averageOrderValueCents,
        public int $cogsCents,
        public int $cogsPercentBps,
        public int $voidsCents,
        public int $cashVarianceCents,
        public int $wastageCents = 0,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'branchId' => $this->branchId,
            'branchCode' => $this->branchCode,
            'branchName' => $this->branchName,
            'revenueCents' => $this->revenueCents,
            'ordersCount' => $this->ordersCount,
            'averageOrderValueCents' => $this->averageOrderValueCents,
            'cogsCents' => $this->cogsCents,
            'cogsPercentBps' => $this->cogsPercentBps,
            'voidsCents' => $this->voidsCents,
            'cashVarianceCents' => $this->cashVarianceCents,
            'wastageCents' => $this->wastageCents,
        ];
    }
}
