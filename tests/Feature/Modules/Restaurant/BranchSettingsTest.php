<?php

declare(strict_types=1);

use App\Modules\Restaurant\Actions\UpdateBranchSettingsAction;
use App\Modules\Restaurant\DTOs\BranchConfigData;
use App\Modules\Restaurant\Models\Branch;

it('updates branch tax, service charge, and governance thresholds inside a transaction', function (): void {
    $branch = Branch::create([
        'code' => 'DTF',
        'name' => 'Downtown Flagship',
        'timezone' => 'America/New_York',
        'tax_rate_bps' => 825,
        'service_charge_bps' => 500,
        'discount_pin_threshold_bps' => 1500,
        'cash_variance_tolerance_cents' => 500,
        'operating_hours' => ['mon' => '11:00-23:00'],
        'is_active' => true,
    ]);

    $action = app(UpdateBranchSettingsAction::class);

    $updated = $action->execute($branch, new BranchConfigData(
        name: 'Downtown Flagship — Main',
        taxRateBps: 900,
        serviceChargeBps: 600,
        discountPinThresholdBps: 1000,
        cashVarianceToleranceCents: 250,
        isActive: true,
    ));

    expect($updated->name)->toBe('Downtown Flagship — Main')
        ->and($updated->tax_rate_bps)->toBe(900)
        ->and($updated->service_charge_bps)->toBe(600)
        ->and($updated->discount_pin_threshold_bps)->toBe(1000)
        ->and($updated->cash_variance_tolerance_cents)->toBe(250)
        ->and($updated->is_active)->toBeTrue();
});

it('rejects negative basis points or negative tolerance cents', function (): void {
    $branch = Branch::create([
        'code' => 'WFP',
        'name' => 'Waterfront Patio',
        'timezone' => 'America/New_York',
        'tax_rate_bps' => 825,
        'service_charge_bps' => 500,
        'discount_pin_threshold_bps' => 1500,
        'cash_variance_tolerance_cents' => 500,
        'is_active' => true,
    ]);

    $action = app(UpdateBranchSettingsAction::class);

    expect(fn () => $action->execute($branch, new BranchConfigData(
        name: 'Waterfront Patio',
        taxRateBps: -10,
        serviceChargeBps: 500,
        discountPinThresholdBps: 1500,
        cashVarianceToleranceCents: 500,
        isActive: true,
    )))->toThrow(InvalidArgumentException::class);

    expect(fn () => $action->execute($branch, new BranchConfigData(
        name: 'Waterfront Patio',
        taxRateBps: 825,
        serviceChargeBps: 500,
        discountPinThresholdBps: 1500,
        cashVarianceToleranceCents: -1,
        isActive: true,
    )))->toThrow(InvalidArgumentException::class);
});
