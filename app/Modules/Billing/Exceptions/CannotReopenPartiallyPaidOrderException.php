<?php

declare(strict_types=1);

namespace App\Modules\Billing\Exceptions;

use DomainException;

final class CannotReopenPartiallyPaidOrderException extends DomainException
{
    public static function forOrder(string $orderNumber): self
    {
        return new self("Order {$orderNumber} already has captured payments and cannot be reopened or re-split.");
    }
}
