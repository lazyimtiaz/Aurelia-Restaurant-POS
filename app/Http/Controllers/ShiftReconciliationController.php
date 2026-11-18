<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Modules\Identity\Exceptions\InvalidManagerPinException;
use App\Modules\Identity\Queries\GetEvaluatorContextQuery;
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
use InvalidArgumentException;

final class ShiftReconciliationController extends Controller
{
    public function index(
        Request $request,
        GetEvaluatorContextQuery $getEvaluatorContext,
        GetBranchShiftsQuery $getBranchShifts,
    ): JsonResponse {
        $context = $getEvaluatorContext->execute($request);
        $branchId = (int) $context['activeBranch']['id'];

        return response()->json([
            'shifts' => $getBranchShifts->execute($branchId),
        ]);
    }

    public function openShift(
        Request $request,
        GetEvaluatorContextQuery $getEvaluatorContext,
        OpenShiftAction $openShift,
    ): RedirectResponse {
        $validated = $request->validate([
            'opening_cash_cents' => ['required', 'integer', 'min:0'],
        ]);

        $context = $getEvaluatorContext->execute($request);
        $branchId = (int) $context['activeBranch']['id'];
        $userId = (int) $context['activeUser']['id'];

        try {
            $openShift->execute($branchId, $userId, (int) $validated['opening_cash_cents']);
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
        GetEvaluatorContextQuery $getEvaluatorContext,
        ApproveShiftVarianceAction $approveVariance,
    ): RedirectResponse {
        $validated = $request->validate([
            'manager_pin' => ['required', 'string', 'max:12'],
            'resolution_note' => ['required', 'string', 'max:250'],
        ]);

        $context = $getEvaluatorContext->execute($request);
        $actorId = (int) $context['activeUser']['id'];

        try {
            $approveVariance->execute(
                shiftId: $shiftId,
                managerPin: (string) $validated['manager_pin'],
                actorUserId: $actorId,
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
