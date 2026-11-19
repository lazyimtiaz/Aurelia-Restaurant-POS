<?php

declare(strict_types=1);

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Modules\Identity\Actions\SignInTerminalAction;
use App\Modules\Identity\Actions\VerifyManagerPinAction;
use App\Modules\Identity\Exceptions\InvalidManagerPinException;
use App\Modules\Identity\Services\CurrentStaffContext;
use App\Modules\Restaurant\Models\Branch;
use DomainException;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

final class TerminalAuthController extends Controller
{
    public function show(
        Request $request,
        CurrentStaffContext $staffContext,
    ): Response|RedirectResponse {
        $staff = $staffContext->staffUser($request);
        if ($staff !== null) {
            return redirect($staff->role->homeRoute());
        }

        if ($staffContext->terminalUser($request) !== null && $staffContext->terminalBranch($request) !== null) {
            return redirect('/lock');
        }

        $branches = Branch::query()
            ->where('is_active', true)
            ->orderBy('id')
            ->get(['id', 'code', 'name'])
            ->map(static fn (Branch $b): array => [
                'id' => $b->id,
                'code' => $b->code,
                'name' => $b->name,
            ])
            ->values()
            ->all();

        return Inertia::render('Auth/TerminalLoginPage', [
            'branches' => $branches,
        ]);
    }

    public function store(
        Request $request,
        SignInTerminalAction $signInTerminal,
        CurrentStaffContext $staffContext,
    ): RedirectResponse {
        $validated = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
            'branch_id' => ['nullable', 'integer', 'min:1'],
        ]);

        try {
            $resolved = $signInTerminal->execute(
                email: (string) $validated['email'],
                password: (string) $validated['password'],
                branchId: isset($validated['branch_id']) ? (int) $validated['branch_id'] : null,
            );
        } catch (DomainException $e) {
            throw ValidationException::withMessages(['email' => $e->getMessage()]);
        }

        $request->session()->regenerate();
        Auth::login($resolved['user']);
        $staffContext->bindTerminalSession($request, $resolved['user'], $resolved['branch']);

        return redirect('/lock');
    }

    public function signOut(
        Request $request,
        CurrentStaffContext $staffContext,
        VerifyManagerPinAction $verifyManagerPin,
    ): RedirectResponse {
        $staff = $staffContext->staffUser($request);
        $terminalBranch = $staffContext->requireActiveBranch($request);

        if ($staff !== null) {
            abort_unless($staff->role->canSignInTerminal(), 403, 'Only Managers, Owners, or Admins can sign out a terminal.');
        } else {
            $validated = $request->validate([
                'manager_pin' => ['required', 'string', 'max:12'],
            ]);

            $terminalUser = $staffContext->terminalUser($request);
            try {
                $verifyManagerPin->execute(
                    branchId: $terminalBranch->id,
                    pin: (string) $validated['manager_pin'],
                    actorUserId: $terminalUser?->id ?? 0,
                    actionType: 'terminal_sign_out',
                );
            } catch (InvalidManagerPinException $e) {
                throw ValidationException::withMessages(['manager_pin' => $e->getMessage()]);
            }
        }

        $staffContext->signOutTerminalSession($request);
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect('/login');
    }
}
