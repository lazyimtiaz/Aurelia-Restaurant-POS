<?php

declare(strict_types=1);

namespace App\Modules\Reporting\DTOs;

use Illuminate\Contracts\Support\Arrayable;

/**
 * @implements Arrayable<string, mixed>
 */
readonly class ExecutiveDashboardData implements Arrayable
{
    /**
     * @param  list<BranchComparisonRowData>  $branchComparisons
     * @param  list<HourlySalesPointData>  $hourlySales
     * @param  list<TopProductRowData>  $topProducts
     */
    public function __construct(
        public int $totalRevenueCents,
        public int $totalOrdersCount,
        public int $averageOrderValueCents,
        public int $totalCogsCents,
        public int $cogsPercentBps,
        public int $totalVoidsCents,
        public int $netCashVarianceCents,
        public array $branchComparisons,
        public array $hourlySales,
        public array $topProducts,
        public int $totalWastageCents = 0,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'totalRevenueCents' => $this->totalRevenueCents,
            'totalOrdersCount' => $this->totalOrdersCount,
            'averageOrderValueCents' => $this->averageOrderValueCents,
            'totalCogsCents' => $this->totalCogsCents,
            'cogsPercentBps' => $this->cogsPercentBps,
            'totalVoidsCents' => $this->totalVoidsCents,
            'netCashVarianceCents' => $this->netCashVarianceCents,
            'totalWastageCents' => $this->totalWastageCents,
            'branchComparisons' => array_map(
                static fn (BranchComparisonRowData $row): array => $row->toArray(),
                $this->branchComparisons,
            ),
            'hourlySales' => array_map(
                static fn (HourlySalesPointData $point): array => $point->toArray(),
                $this->hourlySales,
            ),
            'topProducts' => array_map(
                static fn (TopProductRowData $product): array => $product->toArray(),
                $this->topProducts,
            ),
        ];
    }
}
