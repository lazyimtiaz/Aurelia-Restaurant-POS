<?php

declare(strict_types=1);

namespace App\Modules\Floor\Exceptions;

use DomainException;

final class TableNotAvailableException extends DomainException
{
    public static function forTable(string $tableCode, string $currentState): self
    {
        return new self("Table {$tableCode} cannot be claimed while in '{$currentState}' state.");
    }
}
