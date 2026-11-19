<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Modules\Identity\Services\CurrentStaffContext;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

final class EnsureTerminalSignedIn
{
    public function __construct(
        private readonly CurrentStaffContext $staffContext,
    ) {}

    public function handle(Request $request, Closure $next): Response
    {
        if (
            $this->staffContext->terminalUser($request) === null
            || $this->staffContext->terminalBranch($request) === null
        ) {
            if ($request->expectsJson()) {
                return response()->json(['message' => 'Terminal authentication required.'], 401);
            }

            return redirect('/login');
        }

        return $next($request);
    }
}
