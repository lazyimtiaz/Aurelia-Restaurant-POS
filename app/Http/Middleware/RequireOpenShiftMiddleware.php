<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Models\User;
use App\Modules\Shifts\Queries\FindActiveOpenShiftQuery;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

final class RequireOpenShiftMiddleware
{
    public function __construct(
        private readonly FindActiveOpenShiftQuery $findActiveOpenShift,
    ) {}

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user instanceof User) {
            return response()->json(['message' => 'Authentication required.'], 401);
        }

        $branchId = (int) ($request->hasSession() ? $request->session()->get('evaluator_branch_id', $user->branch_id) : $user->branch_id);

        if ($branchId <= 0 || $this->findActiveOpenShift->execute($branchId, $user->id) === null) {
            if ($request->expectsJson()) {
                return response()->json(['message' => 'An open shift is required at this branch before transacting.'], 409);
            }

            return redirect()->back()->with('error', 'An open shift is required at this branch before transacting.');
        }

        return $next($request);
    }
}
