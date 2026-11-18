<?php

declare(strict_types=1);

namespace App\Modules\Reporting\DTOs;

use Illuminate\Contracts\Support\Arrayable;

/**
 * @implements Arrayable<string, mixed>
 */
readonly class TopProductRowData implements Arrayable
{
    public function __construct(
        public int $menuItemVariantId,
        public string $itemName,
        public string $variantName,
        public int $quantitySold,
        public int $revenueCents,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'menuItemVariantId' => $this->menuItemVariantId,
            'itemName' => $this->itemName,
            'variantName' => $this->variantName,
            'quantitySold' => $this->quantitySold,
            'revenueCents' => $this->revenueCents,
        ];
    }
}
