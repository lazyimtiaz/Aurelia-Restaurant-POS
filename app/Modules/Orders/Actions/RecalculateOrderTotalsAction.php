<?php

declare(strict_types=1);

namespace App\Modules\Orders\Actions;

use App\Modules\Kitchen\Enums\ItemPrepState;
use App\Modules\Orders\Models\Order;
use App\Modules\Restaurant\Models\Branch;
use App\Support\Money\TaxCalculator;

final class RecalculateOrderTotalsAction
{
    public function execute(Order $order): Order
    {
        $branch = Branch::query()->findOrFail($order->branch_id);

        $subtotalCents = (int) $order->items()
            ->where('prep_state', '!=', ItemPrepState::Voided->value)
            ->sum('line_total_cents');

        $discountCents = TaxCalculator::compute($subtotalCents, $order->discount_bps);

        $totals = TaxCalculator::calculateOrderTotals(
            subtotalCents: $subtotalCents,
            discountCents: $discountCents,
            serviceChargeBps: $branch->service_charge_bps,
            taxRateBps: $branch->tax_rate_bps,
        );

        $order->update([
            'subtotal_cents' => $totals->subtotalCents,
            'discount_cents' => $totals->discountCents,
            'service_charge_cents' => $totals->serviceChargeCents,
            'tax_cents' => $totals->taxCents,
            'total_cents' => $totals->totalCents,
        ]);

        return $order->refresh();
    }
}
