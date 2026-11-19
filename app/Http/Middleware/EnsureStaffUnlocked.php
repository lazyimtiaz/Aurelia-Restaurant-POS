<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Modules\Identity\Services\CurrentStaffContext;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

final class EnsureStaffUnlocked
{
    public function __construct(
        private readonly CurrentStaffContext $staffContext,
    ) {}

    public function handle(Request $request, Closure $next): Response
    {
        $staff = $this->staffContext->staffUser($request);

        if ($staff === null) {
            $this->staffContext->lockStaffSession($request);

            if ($request->expectsJson()) {
                return response()->json(['message' => 'Staff PIN unlock required.'], 401);
            }

            return redirect('/lock');
        }

        $this->staffContext->touchActivity($request);

        return $next($request);
    }
}
