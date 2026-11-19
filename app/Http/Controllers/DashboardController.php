<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Modules\Identity\Services\CurrentStaffContext;
use App\Modules\Reporting\Queries\GetDashboardOverviewQuery;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

final class DashboardController extends Controller
{
    public function __invoke(
        Request $request,
        CurrentStaffContext $staffContext,
        GetDashboardOverviewQuery $getDashboardOverview,
    ): Response {
        $branch = $staffContext->requireActiveBranch($request);

        return Inertia::render('Dashboard/DashboardPage', [
            'overview' => $getDashboardOverview->execute($branch->id),
        ]);
    }
}
