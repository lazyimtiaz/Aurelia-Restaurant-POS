<?php

declare(strict_types=1);

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Modules\Identity\Actions\UnlockStaffByPinAction;
use App\Modules\Identity\Exceptions\InvalidStaffPinException;
use App\Modules\Identity\Exceptions\TooManyPinAttemptsException;
use App\Modules\Identity\Services\CurrentStaffContext;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

final class StaffLockController extends Controller
{
    public function show(
        Request $request,
        CurrentStaffContext $staffContext,
    ): Response {
        $terminalBranch = $staffContext->terminalBranch($request);
        abort_if($terminalBranch === null, 401);

        return Inertia::render('Auth/StaffLockPage', [
            'terminalBranch' => [
                'id' => $terminalBranch->id,
                'code' => $terminalBranch->code,
                'name' => $terminalBranch->name,
            ],
            'staffMembers' => $staffContext->staffForLockScreen($terminalBranch->id),
        ]);
    }

    public function unlock(
        Request $request,
        CurrentStaffContext $staffContext,
        UnlockStaffByPinAction $unlockStaff,
    ): RedirectResponse {
        $validated = $request->validate([
            'user_id' => ['required', 'integer', 'min:1'],
            'pin' => ['required', 'string', 'max:12'],
        ]);

        $terminalBranch = $staffContext->terminalBranch($request);
        if ($terminalBranch === null) {
            return redirect('/login');
        }

        try {
            $staff = $unlockStaff->execute(
                terminalBranchId: $terminalBranch->id,
                staffUserId: (int) $validated['user_id'],
                pin: (string) $validated['pin'],
            );
        } catch (TooManyPinAttemptsException|InvalidStaffPinException $e) {
            throw ValidationException::withMessages(['pin' => $e->getMessage()]);
        }

        Auth::login($staff);
        $staffContext->unlockStaffSession($request, $staff, $terminalBranch);

        return redirect($staff->role->homeRoute());
    }

    public function home(
        Request $request,
        CurrentStaffContext $staffContext,
    ): RedirectResponse {
        return redirect($staffContext->requireStaff($request)->role->homeRoute());
    }

    public function lock(
        Request $request,
        CurrentStaffContext $staffContext,
    ): RedirectResponse {
        $staffContext->lockStaffSession($request);

        $terminalUser = $staffContext->terminalUser($request);
        if ($terminalUser !== null) {
            Auth::login($terminalUser);
        }

        return redirect('/lock');
    }
}
