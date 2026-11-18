<?php

declare(strict_types=1);

namespace App\Modules\Orders\DTOs;

readonly class OrderItemInputData
{
    /**
     * @param  list<int>  $modifierOptionIds
     */
    public function __construct(
        public int $menuItemVariantId,
        public int $quantity = 1,
        public array $modifierOptionIds = [],
        public ?int $seatNumber = null,
        public ?string $specialInstructions = null,
    ) {}
}
