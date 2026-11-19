<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Modules\Floor\Actions\RequestTableServiceAction;
use App\Modules\Floor\Actions\TransferTableAction;
use App\Modules\Floor\Actions\UpdateTableStateAction;
use App\Modules\Floor\Enums\TableState;
use App\Modules\Floor\Exceptions\TableNotAvailableException;
use App\Modules\Floor\Queries\GetBranchFloorQuery;
use App\Modules\Identity\Services\CurrentStaffContext;
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
        CurrentStaffContext $staffContext,
        GetBranchFloorQuery $getBranchFloor,
        GetActiveBranchOrdersQuery $getActiveOrders,
    ): Response {
        $branch = $staffContext->requireActiveBranch($request);

        return Inertia::render('Tables/TablesPage', [
            'zones' => $getBranchFloor->execute($branch->id),
            'activeOrders' => $getActiveOrders->execute($branch->id),
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
        CurrentStaffContext $staffContext,
        RequestTableServiceAction $requestService,
    ): RedirectResponse {
        $validated = $request->validate([
            'request_type' => ['required', 'string', 'max:64'],
        ]);

        $staff = $staffContext->requireStaff($request);
        $requestService->execute($tableId, $validated['request_type'], $staff->id);

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
