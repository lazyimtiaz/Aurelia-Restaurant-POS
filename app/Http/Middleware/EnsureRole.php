<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Modules\Identity\Services\CurrentStaffContext;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

final class EnsureRole
{
    public function __construct(
        private readonly CurrentStaffContext $staffContext,
    ) {}

    public function handle(Request $request, Closure $next, string ...$sections): Response
    {
        $staff = $this->staffContext->requireStaff($request);

        foreach ($sections as $section) {
            if ($staff->role->canAccessSection($section)) {
                return $next($request);
            }
        }

        abort(403, 'Your role does not have permission to access this workspace.');
    }
}
