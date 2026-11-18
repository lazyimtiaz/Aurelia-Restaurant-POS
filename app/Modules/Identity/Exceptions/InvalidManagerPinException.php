<?php

declare(strict_types=1);

namespace App\Modules\Identity\Exceptions;

use DomainException;

final class InvalidManagerPinException extends DomainException
{
    public static function invalid(): self
    {
        return new self('Invalid 4-digit Branch Manager PIN for this branch.');
    }
}
