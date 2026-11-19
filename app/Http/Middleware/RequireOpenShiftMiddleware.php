<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Models\User;
use App\Modules\Identity\Services\CurrentStaffContext;
use App\Modules\Restaurant\Models\Branch;
use App\Modules\Shifts\Queries\FindActiveOpenShiftQuery;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

final class RequireOpenShiftMiddleware
{
    public function __construct(
        private readonly CurrentStaffContext $staffContext,
        private readonly FindActiveOpenShiftQuery $findActiveOpenShift,
    ) {}

    public function handle(Request $request, Closure $next): Response
    {
        $staff = $this->staffContext->staffUser($request);
        $branch = $this->staffContext->activeBranch($request);

        if (! $staff instanceof User || ! $branch instanceof Branch) {
            return response()->json(['message' => 'Authentication required.'], 401);
        }

        if ($this->findActiveOpenShift->execute($branch->id, $staff->id) === null) {
            if ($request->expectsJson()) {
                return response()->json(['message' => 'An open shift is required at this branch before transacting.'], 409);
            }

            return redirect()->back()->with('error', 'An open shift is required at this branch before transacting.');
        }

        return $next($request);
    }
}
