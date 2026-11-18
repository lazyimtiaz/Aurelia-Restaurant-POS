<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Modules\Identity\Actions\SwitchEvaluatorPersonaAction;
use App\Modules\Identity\Enums\StaffRole;
use App\Modules\Identity\Queries\GetEvaluatorContextQuery;
use App\Modules\Menu\Actions\ToggleBranchItemAvailabilityAction;
use App\Modules\Menu\Queries\GetBranchCatalogQuery;
use App\Modules\Restaurant\Queries\FindBranchByCodeOrIdQuery;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

final class EvaluatorDemoController extends Controller
{
    public function index(
        Request $request,
        GetEvaluatorContextQuery $getEvaluatorContext,
        GetBranchCatalogQuery $getBranchCatalog,
    ): Response {
        $context = $getEvaluatorContext->execute($request);
        $branchId = (int) $context['activeBranch']['id'];

        return Inertia::render('WelcomeDashboard', [
            'catalog' => $getBranchCatalog->execute($branchId)->values()->all(),
        ]);
    }

    public function switchRole(
        Request $request,
        SwitchEvaluatorPersonaAction $switchPersona,
    ): RedirectResponse {
        $validated = $request->validate([
            'role' => ['required', Rule::enum(StaffRole::class)],
        ]);

        $role = StaffRole::from($validated['role']);
        $branchId = $request->session()->get('evaluator_branch_id');

        $resolved = $switchPersona->execute(
            branchId: is_numeric($branchId) ? (int) $branchId : null,
            role: $role,
        );

        $request->session()->put('evaluator_branch_id', $resolved['branch']->id);
        $request->session()->put('evaluator_role', $resolved['user']->role->value);

        return back();
    }

    public function switchBranch(
        Request $request,
        FindBranchByCodeOrIdQuery $findBranch,
        SwitchEvaluatorPersonaAction $switchPersona,
    ): RedirectResponse {
        $validated = $request->validate([
            'branch_id' => ['nullable', 'integer'],
            'branch_code' => ['nullable', 'string', 'max:16'],
        ]);

        $branch = $findBranch->execute(
            branchId: isset($validated['branch_id']) ? (int) $validated['branch_id'] : null,
            branchCode: $validated['branch_code'] ?? null,
        );

        $currentRoleValue = $request->session()->get('evaluator_role', $request->user()?->role->value);
        $role = is_string($currentRoleValue) ? StaffRole::tryFrom($currentRoleValue) : null;

        $resolved = $switchPersona->execute(
            branchId: $branch->id,
            role: $role,
        );

        $request->session()->put('evaluator_branch_id', $resolved['branch']->id);
        $request->session()->put('evaluator_role', $resolved['user']->role->value);

        return back();
    }

    public function updateSimulations(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'simulate_card_decline' => ['sometimes', 'boolean'],
            'trigger_low_stock_auto_86' => ['sometimes', 'boolean'],
        ]);

        $current = $request->session()->get('evaluator_simulations', [
            'simulateCardDecline' => false,
            'triggerLowStockAuto86' => false,
        ]);

        $request->session()->put('evaluator_simulations', [
            'simulateCardDecline' => array_key_exists('simulate_card_decline', $validated)
                ? (bool) $validated['simulate_card_decline']
                : (bool) ($current['simulateCardDecline'] ?? false),
            'triggerLowStockAuto86' => array_key_exists('trigger_low_stock_auto_86', $validated)
                ? (bool) $validated['trigger_low_stock_auto_86']
                : (bool) ($current['triggerLowStockAuto86'] ?? false),
        ]);

        return back();
    }

    public function toggleCatalogItem86(
        Request $request,
        int $variantId,
        GetEvaluatorContextQuery $getEvaluatorContext,
        ToggleBranchItemAvailabilityAction $toggleAvailability,
    ): RedirectResponse {
        $validated = $request->validate([
            'is_available' => ['required', 'boolean'],
            'reason' => ['nullable', 'string', 'max:180'],
        ]);

        $context = $getEvaluatorContext->execute($request);
        $branchId = (int) $context['activeBranch']['id'];
        $actorId = (int) $context['activeUser']['id'];

        $toggleAvailability->execute(
            branchId: $branchId,
            variantId: $variantId,
            isAvailable: (bool) $validated['is_available'],
            reason: $validated['reason'] ?? null,
            actorUserId: $actorId,
        );

        return back();
    }
}
