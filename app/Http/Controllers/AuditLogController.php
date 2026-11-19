<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Modules\Audit\Queries\GetBranchAuditLogsQuery;
use App\Modules\Identity\Services\CurrentStaffContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class AuditLogController extends Controller
{
    public function index(
        Request $request,
        CurrentStaffContext $staffContext,
        GetBranchAuditLogsQuery $getAuditLogs,
    ): JsonResponse {
        $staff = $staffContext->requireStaff($request);
        $activeBranch = $staffContext->requireActiveBranch($request);

        $branchParam = $request->query('branch_id');
        if ($branchParam === 'all' && $staff->role->canSwitchActiveBranch()) {
            $branchId = null;
        } elseif (is_numeric($branchParam) && (int) $branchParam > 0 && $staff->role->canSwitchActiveBranch()) {
            $branchId = (int) $branchParam;
        } else {
            $branchId = $activeBranch->id;
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
