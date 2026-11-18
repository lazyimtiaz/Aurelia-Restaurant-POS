<?php

declare(strict_types=1);

namespace App\Modules\Kitchen\Enums;

enum TicketState: string
{
    case Fired = 'fired';
    case InPrep = 'in_prep';
    case Ready = 'ready';
    case Served = 'served';
}
