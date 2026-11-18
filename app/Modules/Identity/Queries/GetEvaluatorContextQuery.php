<?php

declare(strict_types=1);

namespace App\Modules\Identity\Queries;

use App\Models\User;
use App\Modules\Identity\Actions\SwitchEvaluatorPersonaAction;
use App\Modules\Identity\Enums\StaffRole;
use App\Modules\Restaurant\Models\Branch;
use App\Modules\Shifts\Queries\FindActiveOpenShiftQuery;
use Illuminate\Http\Request;

final class GetEvaluatorContextQuery
{
    public function __construct(
        private readonly SwitchEvaluatorPersonaAction $switchPersona,
        private readonly FindActiveOpenShiftQuery $findActiveOpenShift,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function execute(Request $request): array
    {
        $session = $request->hasSession() ? $request->session() : null;
        $branchId = $session?->get('evaluator_branch_id');
        $roleValue = $session?->get('evaluator_role');
        $requestedRole = is_string($roleValue) ? StaffRole::tryFrom($roleValue) : null;

        $user = $request->user();

        if (! $user instanceof User || Branch::query()->doesntExist()) {
            $resolved = $this->switchPersona->execute(
                branchId: is_numeric($branchId) ? (int) $branchId : null,
                role: $requestedRole,
            );
            $activeBranch = $resolved['branch'];
            $user = $resolved['user'];
            $session?->put('evaluator_branch_id', $activeBranch->id);
            $session?->put('evaluator_role', $user->role->value);
        } else {
            $activeBranch = is_numeric($branchId)
                ? (Branch::query()->find((int) $branchId) ?? Branch::query()->where('code', 'DTF')->firstOrFail())
                : ($user->branch ?? Branch::query()->where('code', 'DTF')->firstOrFail());
        }

        $activeShift = $this->findActiveOpenShift->execute($activeBranch->id, $user->id);

        $branches = Branch::query()
            ->orderBy('id')
            ->get()
            ->map(fn (Branch $b): array => [
                'id' => $b->id,
                'code' => $b->code,
                'name' => $b->name,
                'timezone' => $b->timezone,
                'tax_rate_bps' => $b->tax_rate_bps,
                'service_charge_bps' => $b->service_charge_bps,
                'discount_pin_threshold_bps' => $b->discount_pin_threshold_bps,
                'cash_variance_tolerance_cents' => $b->cash_variance_tolerance_cents,
                'is_active' => $b->is_active,
            ])
            ->values()
            ->all();

        $roles = array_map(
            static fn (StaffRole $role): array => [
                'value' => $role->value,
                'label' => $role->label(),
                'can_authorize_pin' => $role->canAuthorizeManagerPin(),
            ],
            StaffRole::cases(),
        );

        $simulations = $session?->get('evaluator_simulations', []) ?? [];

        return [
            'activeUser' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role->value,
                'role_label' => $user->role->label(),
                'branch_id' => $user->branch_id,
                'can_authorize_pin' => $user->role->canAuthorizeManagerPin(),
            ],
            'activeBranch' => [
                'id' => $activeBranch->id,
                'code' => $activeBranch->code,
                'name' => $activeBranch->name,
                'timezone' => $activeBranch->timezone,
                'tax_rate_bps' => $activeBranch->tax_rate_bps,
                'service_charge_bps' => $activeBranch->service_charge_bps,
                'discount_pin_threshold_bps' => $activeBranch->discount_pin_threshold_bps,
                'cash_variance_tolerance_cents' => $activeBranch->cash_variance_tolerance_cents,
            ],
            'branches' => $branches,
            'roles' => $roles,
            'activeShift' => $activeShift !== null ? [
                'id' => $activeShift->id,
                'state' => $activeShift->state->value,
                'opening_cash_cents' => $activeShift->opening_cash_cents,
                'expected_cash_cents' => $activeShift->expected_cash_cents,
                'opened_at' => $activeShift->opened_at?->toIso8601String(),
            ] : null,
            'simulations' => [
                'simulateCardDecline' => (bool) ($simulations['simulateCardDecline'] ?? false),
                'triggerLowStockAuto86' => (bool) ($simulations['triggerLowStockAuto86'] ?? false),
            ],
        ];
    }
}
