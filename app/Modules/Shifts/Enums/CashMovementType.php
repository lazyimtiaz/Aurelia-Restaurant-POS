<?php

declare(strict_types=1);

namespace App\Modules\Shifts\Enums;

enum CashMovementType: string
{
    case OpeningFloat = 'opening_float';
    case CashSale = 'cash_sale';
    case CashRefund = 'cash_refund';
    case PayIn = 'pay_in';
    case PayOut = 'pay_out';

    public function signedDelta(int $amountCents): int
    {
        return match ($this) {
            self::OpeningFloat, self::CashSale, self::PayIn => $amountCents,
            self::CashRefund, self::PayOut => -$amountCents,
        };
    }
}
