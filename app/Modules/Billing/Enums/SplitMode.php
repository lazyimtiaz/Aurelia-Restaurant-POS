<?php

declare(strict_types=1);

namespace App\Modules\Billing\Enums;

enum SplitMode: string
{
    case Unified = 'unified';
    case ItemSeat = 'item_seat';
    case Equal = 'equal';
}
