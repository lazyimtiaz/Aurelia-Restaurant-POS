<?php

declare(strict_types=1);

namespace App\Modules\Kitchen\Enums;

enum ItemPrepState: string
{
    case Draft = 'draft';
    case Queued = 'queued';
    case InPrep = 'in_prep';
    case Ready = 'ready';
    case Served = 'served';
    case Voided = 'voided';
}
