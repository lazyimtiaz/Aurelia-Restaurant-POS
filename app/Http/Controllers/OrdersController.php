<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Modules\Identity\Services\CurrentStaffContext;
use App\Modules\Orders\Queries\GetActiveBranchOrdersQuery;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

final class OrdersController extends Controller
{
    public function index(
        Request $request,
        CurrentStaffContext $staffContext,
        GetActiveBranchOrdersQuery $getOrders,
    ): Response {
        $branch = $staffContext->requireActiveBranch($request);

        return Inertia::render('Orders/OrdersPage', [
            'orders' => $getOrders->boardOrders($branch->id),
        ]);
    }
}
