<?php

declare(strict_types=1);

namespace App\Modules\Billing\Exceptions;

use DomainException;

final class RefundExceedsCapturedAmountException extends DomainException
{
    public static function forRemaining(int $remainingCents): self
    {
        return new self("Requested refund exceeds remaining captured balance ({$remainingCents} cents available).");
    }
}
