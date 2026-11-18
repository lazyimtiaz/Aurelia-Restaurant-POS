<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Modules\Identity\Enums\StaffRole;
use App\Modules\Identity\Queries\GetEvaluatorContextQuery;
use App\Modules\Inventory\Actions\ReceiveSupplierStockAction;
use App\Modules\Inventory\Actions\RecordManualWastageAction;
use DomainException;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use InvalidArgumentException;

final class InventoryController extends Controller
{
    public function receive(
        Request $request,
        GetEvaluatorContextQuery $getEvaluatorContext,
        ReceiveSupplierStockAction $receiveStock,
    ): RedirectResponse {
        $context = $getEvaluatorContext->execute($request);
        $activeRole = StaffRole::from((string) $context['activeUser']['role']);

        abort_unless($activeRole->canAccessExecutiveWorkspace(), 403);

        $validated = $request->validate([
            'branch_id' => ['nullable', 'integer', 'min:1'],
            'ingredient_id' => ['required', 'integer', 'min:1'],
            'quantity' => ['required', 'integer', 'min:1'],
            'unit_cost_cents' => ['required', 'integer', 'min:0'],
            'supplier_ref' => ['nullable', 'string', 'max:120'],
        ]);

        $branchId = isset($validated['branch_id'])
            ? (int) $validated['branch_id']
            : (int) $context['activeBranch']['id'];
        $actorId = (int) $context['activeUser']['id'];

        try {
            $receiveStock->execute(
                branchId: $branchId,
                ingredientId: (int) $validated['ingredient_id'],
                quantity: (int) $validated['quantity'],
                unitCostCents: (int) $validated['unit_cost_cents'],
                supplierRef: (string) ($validated['supplier_ref'] ?? 'Direct Delivery'),
                actorUserId: $actorId,
            );
        } catch (DomainException|InvalidArgumentException $e) {
            throw ValidationException::withMessages(['inventory' => $e->getMessage()]);
        }

        return back()->with('success', 'Supplier stock received and branch availability synchronized.');
    }

    public function wastage(
        Request $request,
        GetEvaluatorContextQuery $getEvaluatorContext,
        RecordManualWastageAction $recordWastage,
    ): RedirectResponse {
        $context = $getEvaluatorContext->execute($request);
        $activeRole = StaffRole::from((string) $context['activeUser']['role']);

        abort_unless($activeRole->canAccessExecutiveWorkspace(), 403);

        $validated = $request->validate([
            'branch_id' => ['nullable', 'integer', 'min:1'],
            'ingredient_id' => ['required', 'integer', 'min:1'],
            'quantity' => ['required', 'integer', 'min:1'],
            'reason' => ['required', 'string', 'max:180'],
        ]);

        $branchId = isset($validated['branch_id'])
            ? (int) $validated['branch_id']
            : (int) $context['activeBranch']['id'];
        $actorId = (int) $context['activeUser']['id'];

        try {
            $recordWastage->execute(
                branchId: $branchId,
                ingredientId: (int) $validated['ingredient_id'],
                quantity: (int) $validated['quantity'],
                reason: (string) $validated['reason'],
                actorUserId: $actorId,
            );
        } catch (DomainException|InvalidArgumentException $e) {
            throw ValidationException::withMessages(['inventory' => $e->getMessage()]);
        }

        return back()->with('success', 'Manual wastage recorded and audit logged.');
    }
}
