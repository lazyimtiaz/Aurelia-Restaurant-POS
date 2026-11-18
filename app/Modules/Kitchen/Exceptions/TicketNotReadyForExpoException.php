<?php

declare(strict_types=1);

namespace App\Modules\Kitchen\Exceptions;

use DomainException;

final class TicketNotReadyForExpoException extends DomainException
{
    public static function forTicket(int $ticketId): self
    {
        return new self("Kitchen ticket #{$ticketId} still has items in preparation across stations.");
    }
}
