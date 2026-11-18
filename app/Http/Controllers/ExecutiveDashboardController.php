<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Modules\Audit\Queries\GetBranchAuditLogsQuery;
use App\Modules\Identity\Enums\StaffRole;
use App\Modules\Identity\Queries\GetEvaluatorContextQuery;
use App\Modules\Inventory\Queries\GetBranchInventoryLedgerQuery;
use App\Modules\Reporting\Queries\GetExecutiveDashboardMetricsQuery;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

final class ExecutiveDashboardController extends Controller
{
    public function __invoke(
        Request $request,
        GetEvaluatorContextQuery $getEvaluatorContext,
        GetExecutiveDashboardMetricsQuery $getMetrics,
        GetBranchInventoryLedgerQuery $getInventory,
        GetBranchAuditLogsQuery $getAuditLogs,
    ): Response {
        $context = $getEvaluatorContext->execute($request);
        $activeRole = StaffRole::from((string) $context['activeUser']['role']);

        abort_unless(
            $activeRole->canAccessExecutiveWorkspace(),
            403,
            'Executive workspace access is restricted to Owner, Branch Manager, Inventory Manager, and Admin roles.',
        );

        $activeBranchId = (int) $context['activeBranch']['id'];

        $requestedBranch = $request->query('branch_id');
        if ($requestedBranch === 'all') {
            $scopeBranchId = null;
        } elseif (is_numeric($requestedBranch) && (int) $requestedBranch > 0) {
            $scopeBranchId = (int) $requestedBranch;
        } else {
            $scopeBranchId = in_array($activeRole, [StaffRole::RestaurantOwner, StaffRole::EnterpriseSystemAdmin], true)
                ? null
                : $activeBranchId;
        }

        $dateFrom = $request->string('date_from')->trim()->toString() ?: null;
        $dateTo = $request->string('date_to')->trim()->toString() ?: null;
        $inventoryBranchId = $scopeBranchId ?? $activeBranchId;

        $metrics = $getMetrics->execute($scopeBranchId, $dateFrom, $dateTo);
        $inventory = $getInventory->execute($inventoryBranchId);
        $auditData = $getAuditLogs->execute(
            branchId: $scopeBranchId,
            eventType: $request->string('event_type')->trim()->toString() ?: null,
            criticalOnly: $request->boolean('critical_only'),
            search: $request->string('search')->trim()->toString() ?: null,
        );

        return Inertia::render('Executive/ExecutiveWorkspace', [
            'metrics' => $metrics->toArray(),
            'inventory' => $inventory,
            'auditLogs' => $auditData['logs'],
            'auditEventTypes' => $auditData['eventTypes'],
            'filters' => [
                'branchId' => $scopeBranchId,
                'inventoryBranchId' => $inventoryBranchId,
                'dateFrom' => $dateFrom,
                'dateTo' => $dateTo,
            ],
        ]);
    }
}
