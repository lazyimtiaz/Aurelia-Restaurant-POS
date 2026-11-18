<?php

declare(strict_types=1);

namespace App\Modules\Shifts\Enums;

enum ShiftState: string
{
    case Open = 'open';
    case Closed = 'closed';
    case VarianceFlagged = 'variance_flagged';
}
