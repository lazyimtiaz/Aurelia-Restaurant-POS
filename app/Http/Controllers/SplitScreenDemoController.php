<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Modules\Floor\Queries\GetBranchFloorQuery;
use App\Modules\Identity\Queries\GetEvaluatorContextQuery;
use App\Modules\Kitchen\Queries\GetActiveKdsTicketsQuery;
use App\Modules\Menu\Enums\PrepStation;
use App\Modules\Menu\Queries\GetBranchCatalogQuery;
use App\Modules\Orders\Queries\GetActiveBranchOrdersQuery;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

final class SplitScreenDemoController extends Controller
{
    public function index(
        Request $request,
        GetEvaluatorContextQuery $getEvaluatorContext,
        GetBranchCatalogQuery $getCatalog,
        GetBranchFloorQuery $getFloor,
        GetActiveBranchOrdersQuery $getActiveOrders,
        GetActiveKdsTicketsQuery $getActiveTickets,
    ): Response {
        $context = $getEvaluatorContext->execute($request);
        $branchId = (int) $context['activeBranch']['id'];

        $stations = array_map(
            static fn (PrepStation $s): array => [
                'value' => $s->value,
                'label' => $s->label(),
            ],
            PrepStation::cases(),
        );

        return Inertia::render('Evaluator/SplitScreenDemoWorkspace', [
            'catalog' => $getCatalog->execute($branchId)->values()->all(),
            'zones' => $getFloor->execute($branchId),
            'activeOrders' => $getActiveOrders->execute($branchId),
            'tickets' => $getActiveTickets->execute($branchId)->values()->all(),
            'stations' => $stations,
        ]);
    }
}
