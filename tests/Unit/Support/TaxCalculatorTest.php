<?php

declare(strict_types=1);

use App\Support\Money\TaxCalculator;

it('computes half-up basis point tax and service charge without floats', function (): void {
    expect(TaxCalculator::compute(1250, 825))->toBe(103); // 103.125 -> 103
    expect(TaxCalculator::compute(1000, 825))->toBe(83);  // 82.5 -> 83 (half-up)
    expect(TaxCalculator::compute(0, 825))->toBe(0);
    expect(TaxCalculator::compute(1000, 0))->toBe(0);
});

it('applies discount before computing independent service charge and tax', function (): void {
    $totals = TaxCalculator::calculateOrderTotals(
        subtotalCents: 10000,
        discountCents: 1000,
        serviceChargeBps: 500,
        taxRateBps: 825,
    );

    expect($totals->subtotalCents)->toBe(10000)
        ->and($totals->discountCents)->toBe(1000)
        ->and($totals->netSubtotalCents)->toBe(9000)
        ->and($totals->serviceChargeCents)->toBe(450)
        ->and($totals->taxCents)->toBe(743)
        ->and($totals->totalCents)->toBe(10193);
});

it('rejects negative or over-subtotal discounts', function (): void {
    expect(fn () => TaxCalculator::calculateOrderTotals(1000, -1, 500, 825))
        ->toThrow(InvalidArgumentException::class);

    expect(fn () => TaxCalculator::calculateOrderTotals(1000, 1001, 500, 825))
        ->toThrow(InvalidArgumentException::class);
});
