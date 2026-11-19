<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Modules\Identity\Exceptions\InvalidManagerPinException;
use App\Modules\Identity\Services\CurrentStaffContext;
use App\Modules\Shifts\Actions\ApproveShiftVarianceAction;
use App\Modules\Shifts\Actions\CloseShiftAction;
use App\Modules\Shifts\Actions\OpenShiftAction;
use App\Modules\Shifts\Enums\ShiftState;
use App\Modules\Shifts\Queries\GetBranchShiftsQuery;
use DomainException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use InvalidArgumentException;

final class ShiftReconciliationController extends Controller
{
    public function index(
        Request $request,
        CurrentStaffContext $staffContext,
        GetBranchShiftsQuery $getBranchShifts,
    ): Response|JsonResponse {
        $branch = $staffContext->requireActiveBranch($request);
        $shifts = $getBranchShifts->execute($branch->id);

        if ($request->wantsJson() && ! $request->inertia()) {
            return response()->json(['shifts' => $shifts]);
        }

        return Inertia::render('Shifts/ShiftsPage', [
            'shifts' => $shifts,
        ]);
    }

    public function openShift(
        Request $request,
        CurrentStaffContext $staffContext,
        OpenShiftAction $openShift,
    ): RedirectResponse {
        $validated = $request->validate([
            'opening_cash_cents' => ['required', 'integer', 'min:0'],
        ]);

        $staff = $staffContext->requireStaff($request);
        $branch = $staffContext->requireActiveBranch($request);

        try {
            $openShift->execute($branch->id, $staff->id, (int) $validated['opening_cash_cents']);
        } catch (DomainException|InvalidArgumentException $e) {
            throw ValidationException::withMessages(['shift' => $e->getMessage()]);
        }

        return back()->with('success', 'New cash drawer shift opened.');
    }

    public function closeShift(
        Request $request,
        int $shiftId,
        CloseShiftAction $closeShift,
    ): RedirectResponse {
        $validated = $request->validate([
            'counted_cash_cents' => ['required', 'integer', 'min:0'],
            'notes' => ['nullable', 'string', 'max:250'],
        ]);

        try {
            $closed = $closeShift->execute(
                shiftId: $shiftId,
                countedCashCents: (int) $validated['counted_cash_cents'],
                notes: $validated['notes'] ?? null,
            );
        } catch (DomainException|InvalidArgumentException $e) {
            throw ValidationException::withMessages(['shift' => $e->getMessage()]);
        }

        $msg = $closed->state === ShiftState::VarianceFlagged
            ? 'Shift closed with cash variance flagged for Manager PIN review.'
            : 'Shift reconciled and closed cleanly.';

        return back()->with('success', $msg);
    }

    public function approveVariance(
        Request $request,
        int $shiftId,
        CurrentStaffContext $staffContext,
        ApproveShiftVarianceAction $approveVariance,
    ): RedirectResponse {
        $validated = $request->validate([
            'manager_pin' => ['required', 'string', 'max:12'],
            'resolution_note' => ['required', 'string', 'max:250'],
        ]);

        $staff = $staffContext->requireStaff($request);

        try {
            $approveVariance->execute(
                shiftId: $shiftId,
                managerPin: (string) $validated['manager_pin'],
                actorUserId: $staff->id,
                resolutionNote: (string) $validated['resolution_note'],
            );
        } catch (InvalidManagerPinException $e) {
            throw ValidationException::withMessages(['manager_pin' => $e->getMessage()]);
        } catch (DomainException $e) {
            throw ValidationException::withMessages(['shift' => $e->getMessage()]);
        }

        return back()->with('success', 'Shift variance approved and closed.');
    }
}
