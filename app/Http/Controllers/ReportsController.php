<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Modules\Audit\Queries\GetBranchAuditLogsQuery;
use App\Modules\Identity\Services\CurrentStaffContext;
use App\Modules\Reporting\Queries\GetExecutiveDashboardMetricsQuery;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

final class ReportsController extends Controller
{
    public function index(
        Request $request,
        CurrentStaffContext $staffContext,
        GetExecutiveDashboardMetricsQuery $getMetrics,
        GetBranchAuditLogsQuery $getAuditLogs,
    ): Response {
        $staff = $staffContext->requireStaff($request);
        $activeBranch = $staffContext->requireActiveBranch($request);

        $requestedScope = $request->query('branch_id');
        if ($requestedScope === 'all' && $staff->role->canSwitchActiveBranch()) {
            $scopeBranchId = null;
        } elseif (is_numeric($requestedScope) && (int) $requestedScope > 0 && $staff->role->canSwitchActiveBranch()) {
            $scopeBranchId = (int) $requestedScope;
        } else {
            $scopeBranchId = $activeBranch->id;
        }

        $dateFrom = $request->string('date_from')->trim()->toString() ?: null;
        $dateTo = $request->string('date_to')->trim()->toString() ?: null;

        $metrics = $getMetrics->execute($scopeBranchId, $dateFrom, $dateTo);
        $auditData = $getAuditLogs->execute(
            branchId: $scopeBranchId,
            eventType: $request->string('event_type')->trim()->toString() ?: null,
            criticalOnly: $request->boolean('critical_only'),
            search: $request->string('search')->trim()->toString() ?: null,
        );

        return Inertia::render('Reports/ReportsPage', [
            'metrics' => $metrics->toArray(),
            'auditLogs' => $auditData['logs'],
            'auditEventTypes' => $auditData['eventTypes'],
            'filters' => [
                'branchId' => $scopeBranchId,
                'dateFrom' => $dateFrom,
                'dateTo' => $dateTo,
            ],
        ]);
    }
}
