<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Modules\Floor\Actions\RequestTableServiceAction;
use App\Modules\Floor\Actions\TransferTableAction;
use App\Modules\Floor\Actions\UpdateTableStateAction;
use App\Modules\Floor\Enums\TableState;
use App\Modules\Floor\Exceptions\TableNotAvailableException;
use App\Modules\Floor\Queries\GetBranchFloorQuery;
use App\Modules\Identity\Queries\GetEvaluatorContextQuery;
use App\Modules\Orders\Queries\GetActiveBranchOrdersQuery;
use DomainException;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

final class FloorController extends Controller
{
    public function index(
        Request $request,
        GetEvaluatorContextQuery $getEvaluatorContext,
        GetBranchFloorQuery $getBranchFloor,
        GetActiveBranchOrdersQuery $getActiveOrders,
    ): Response {
        $context = $getEvaluatorContext->execute($request);
        $branchId = (int) $context['activeBranch']['id'];

        return Inertia::render('Floor/FloorWorkspace', [
            'zones' => $getBranchFloor->execute($branchId),
            'activeOrders' => $getActiveOrders->execute($branchId),
        ]);
    }

    public function updateState(
        Request $request,
        int $tableId,
        UpdateTableStateAction $updateTableState,
    ): RedirectResponse {
        $validated = $request->validate([
            'state' => ['required', Rule::enum(TableState::class)],
            'guest_count' => ['nullable', 'integer', 'min:1', 'max:24'],
        ]);

        try {
            $updateTableState->execute(
                tableId: $tableId,
                targetState: TableState::from($validated['state']),
                guestCount: isset($validated['guest_count']) ? (int) $validated['guest_count'] : null,
            );
        } catch (TableNotAvailableException $e) {
            throw ValidationException::withMessages(['table' => $e->getMessage()]);
        }

        return back();
    }

    public function requestService(
        Request $request,
        int $tableId,
        GetEvaluatorContextQuery $getEvaluatorContext,
        RequestTableServiceAction $requestService,
    ): RedirectResponse {
        $validated = $request->validate([
            'request_type' => ['required', 'string', 'max:64'],
        ]);

        $context = $getEvaluatorContext->execute($request);
        $actorId = (int) $context['activeUser']['id'];

        $requestService->execute($tableId, $validated['request_type'], $actorId);

        return back()->with('success', 'Service alert broadcast to floor staff.');
    }

    public function transferOrder(
        Request $request,
        int $orderId,
        TransferTableAction $transferTable,
    ): RedirectResponse {
        $validated = $request->validate([
            'target_table_id' => ['required', 'integer'],
            'mark_source_dirty' => ['sometimes', 'boolean'],
        ]);

        try {
            $transferTable->execute(
                orderId: $orderId,
                targetTableId: (int) $validated['target_table_id'],
                markSourceDirty: (bool) ($validated['mark_source_dirty'] ?? false),
            );
        } catch (TableNotAvailableException|DomainException $e) {
            throw ValidationException::withMessages(['target_table_id' => $e->getMessage()]);
        }

        return back()->with('success', 'Table transferred successfully.');
    }
}
