<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Modules\Identity\Services\CurrentStaffContext;
use App\Modules\Restaurant\Actions\UpdateBranchSettingsAction;
use App\Modules\Restaurant\DTOs\BranchConfigData;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use InvalidArgumentException;

final class SettingsController extends Controller
{
    public function index(
        Request $request,
        CurrentStaffContext $staffContext,
    ): Response {
        $branch = $staffContext->requireActiveBranch($request);

        return Inertia::render('Settings/SettingsPage', [
            'branchSettings' => [
                'id' => $branch->id,
                'code' => $branch->code,
                'name' => $branch->name,
                'timezone' => $branch->timezone,
                'tax_rate_bps' => $branch->tax_rate_bps,
                'service_charge_bps' => $branch->service_charge_bps,
                'discount_pin_threshold_bps' => $branch->discount_pin_threshold_bps,
                'cash_variance_tolerance_cents' => $branch->cash_variance_tolerance_cents,
                'operating_hours' => $branch->operating_hours ?? ['mon-sun' => '11:00-23:00'],
                'is_active' => $branch->is_active,
            ],
        ]);
    }

    public function updateBranch(
        Request $request,
        CurrentStaffContext $staffContext,
        UpdateBranchSettingsAction $updateSettings,
    ): RedirectResponse {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'timezone' => ['required', 'string', 'max:64'],
            'tax_rate_bps' => ['required', 'integer', 'min:0', 'max:3000'],
            'service_charge_bps' => ['required', 'integer', 'min:0', 'max:3000'],
            'discount_pin_threshold_bps' => ['required', 'integer', 'min:0', 'max:10000'],
            'cash_variance_tolerance_cents' => ['required', 'integer', 'min:0', 'max:100000'],
        ]);

        $branch = $staffContext->requireActiveBranch($request);

        try {
            $updateSettings->execute($branch, new BranchConfigData(
                name: (string) $validated['name'],
                taxRateBps: (int) $validated['tax_rate_bps'],
                serviceChargeBps: (int) $validated['service_charge_bps'],
                discountPinThresholdBps: (int) $validated['discount_pin_threshold_bps'],
                cashVarianceToleranceCents: (int) $validated['cash_variance_tolerance_cents'],
                isActive: $branch->is_active,
                timezone: (string) $validated['timezone'],
                operatingHours: $branch->operating_hours,
            ));
        } catch (InvalidArgumentException $e) {
            throw ValidationException::withMessages(['settings' => $e->getMessage()]);
        }

        return back()->with('success', 'Branch tax and governance settings updated.');
    }
}
