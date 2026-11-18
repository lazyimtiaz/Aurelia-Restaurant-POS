<?php

declare(strict_types=1);

namespace App\Modules\Billing\Enums;

enum BillSplitState: string
{
    case Pending = 'pending';
    case Paid = 'paid';
    case Failed = 'failed';
}
