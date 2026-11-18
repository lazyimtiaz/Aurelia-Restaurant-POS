<?php

declare(strict_types=1);

namespace App\Modules\Restaurant\Actions;

use App\Modules\Restaurant\DTOs\BranchConfigData;
use App\Modules\Restaurant\Models\Branch;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

final class UpdateBranchSettingsAction
{
    public function execute(Branch $branch, BranchConfigData $data): Branch
    {
        if (
            $data->taxRateBps < 0
            || $data->serviceChargeBps < 0
            || $data->discountPinThresholdBps < 0
            || $data->cashVarianceToleranceCents < 0
        ) {
            throw new InvalidArgumentException('Branch rates and tolerance cents must be non-negative.');
        }

        if ($data->discountPinThresholdBps > 10000) {
            throw new InvalidArgumentException('Discount PIN threshold cannot exceed 10000 basis points (100%).');
        }

        return DB::transaction(function () use ($branch, $data): Branch {
            $locked = Branch::query()->whereKey($branch->id)->lockForUpdate()->firstOrFail();

            $locked->update([
                'name' => $data->name,
                'tax_rate_bps' => $data->taxRateBps,
                'service_charge_bps' => $data->serviceChargeBps,
                'discount_pin_threshold_bps' => $data->discountPinThresholdBps,
                'cash_variance_tolerance_cents' => $data->cashVarianceToleranceCents,
                'is_active' => $data->isActive,
                'timezone' => $data->timezone ?? $locked->timezone,
                'operating_hours' => $data->operatingHours ?? $locked->operating_hours,
            ]);

            return $locked->refresh();
        });
    }
}
