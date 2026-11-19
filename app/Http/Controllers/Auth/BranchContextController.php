<?php

declare(strict_types=1);

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Modules\Identity\Services\CurrentStaffContext;
use App\Modules\Restaurant\Models\Branch;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

final class BranchContextController extends Controller
{
    public function switch(
        Request $request,
        CurrentStaffContext $staffContext,
    ): RedirectResponse {
        $staff = $staffContext->requireStaff($request);
        abort_unless($staff->role->canSwitchActiveBranch(), 403, 'Only Owners or Enterprise Admins can switch active branches.');

        $validated = $request->validate([
            'branch_id' => ['required', 'integer', 'exists:branches,id'],
        ]);

        $branch = Branch::query()->where('is_active', true)->findOrFail((int) $validated['branch_id']);
        $request->session()->put(CurrentStaffContext::SESSION_ACTIVE_BRANCH_ID, $branch->id);

        return back()->with('success', "Switched active branch to {$branch->name} ({$branch->code}).");
    }
}
