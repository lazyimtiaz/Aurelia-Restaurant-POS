<?php

declare(strict_types=1);

namespace App\Modules\Reporting\DTOs;

use Illuminate\Contracts\Support\Arrayable;

/**
 * @implements Arrayable<string, mixed>
 */
readonly class HourlySalesPointData implements Arrayable
{
    public function __construct(
        public int $hour,
        public string $label,
        public int $revenueCents,
        public int $ordersCount,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'hour' => $this->hour,
            'label' => $this->label,
            'revenueCents' => $this->revenueCents,
            'ordersCount' => $this->ordersCount,
        ];
    }
}
