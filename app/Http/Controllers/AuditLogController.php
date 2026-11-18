<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Modules\Audit\Queries\GetBranchAuditLogsQuery;
use App\Modules\Identity\Enums\StaffRole;
use App\Modules\Identity\Queries\GetEvaluatorContextQuery;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class AuditLogController extends Controller
{
    public function index(
        Request $request,
        GetEvaluatorContextQuery $getEvaluatorContext,
        GetBranchAuditLogsQuery $getAuditLogs,
    ): JsonResponse {
        $context = $getEvaluatorContext->execute($request);
        $activeRole = StaffRole::from((string) $context['activeUser']['role']);

        abort_unless($activeRole->canAccessExecutiveWorkspace(), 403);

        $branchParam = $request->query('branch_id');
        if ($branchParam === 'all') {
            $branchId = null;
        } elseif (is_numeric($branchParam) && (int) $branchParam > 0) {
            $branchId = (int) $branchParam;
        } else {
            $branchId = (int) $context['activeBranch']['id'];
        }

        $result = $getAuditLogs->execute(
            branchId: $branchId,
            eventType: $request->string('event_type')->trim()->toString() ?: null,
            criticalOnly: $request->boolean('critical_only'),
            search: $request->string('search')->trim()->toString() ?: null,
        );

        return response()->json($result);
    }
}
