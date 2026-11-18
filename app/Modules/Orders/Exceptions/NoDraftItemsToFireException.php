<?php

declare(strict_types=1);

namespace App\Modules\Orders\Exceptions;

use DomainException;

final class NoDraftItemsToFireException extends DomainException
{
    public static function forOrder(string $orderNumber): self
    {
        return new self("Order {$orderNumber} has no draft items to fire to the kitchen.");
    }
}
