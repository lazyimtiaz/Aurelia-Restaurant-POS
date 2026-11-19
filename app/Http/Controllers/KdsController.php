<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Modules\Identity\Services\CurrentStaffContext;
use App\Modules\Kitchen\Actions\BumpKitchenItemStatusAction;
use App\Modules\Kitchen\Actions\ServeKitchenTicketExpoAction;
use App\Modules\Kitchen\Enums\ItemPrepState;
use App\Modules\Kitchen\Exceptions\TicketNotReadyForExpoException;
use App\Modules\Kitchen\Queries\GetActiveKdsTicketsQuery;
use App\Modules\Menu\Enums\PrepStation;
use DomainException;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

final class KdsController extends Controller
{
    public function index(
        Request $request,
        CurrentStaffContext $staffContext,
        GetActiveKdsTicketsQuery $getActiveTickets,
    ): Response {
        $staff = $staffContext->requireStaff($request);
        $branch = $staffContext->requireActiveBranch($request);

        $stationParam = $request->query('station');
        $queryStation = is_string($stationParam) ? PrepStation::tryFrom($stationParam) : null;
        $initialStation = $queryStation
            ?? ($staff->assigned_station !== null ? PrepStation::tryFrom($staff->assigned_station) : null);

        $stations = array_map(
            static fn (PrepStation $s): array => [
                'value' => $s->value,
                'label' => $s->label(),
            ],
            PrepStation::cases(),
        );

        return Inertia::render('Kitchen/KitchenPage', [
            'tickets' => $getActiveTickets->execute($branch->id, $queryStation)->values()->all(),
            'stations' => $stations,
            'activeStation' => $initialStation?->value,
        ]);
    }

    public function bumpItem(
        Request $request,
        int $itemId,
        CurrentStaffContext $staffContext,
        BumpKitchenItemStatusAction $bumpItem,
    ): RedirectResponse {
        $validated = $request->validate([
            'target_state' => ['required', Rule::enum(ItemPrepState::class)],
        ]);

        $staff = $staffContext->requireStaff($request);

        try {
            $bumpItem->execute($itemId, ItemPrepState::from($validated['target_state']), $staff->id);
        } catch (DomainException $e) {
            throw ValidationException::withMessages(['item' => $e->getMessage()]);
        }

        return back();
    }

    public function serveTicket(
        Request $request,
        int $ticketId,
        CurrentStaffContext $staffContext,
        ServeKitchenTicketExpoAction $serveTicket,
    ): RedirectResponse {
        $staff = $staffContext->requireStaff($request);

        try {
            $serveTicket->execute($ticketId, $staff->id, false);
        } catch (TicketNotReadyForExpoException $e) {
            throw ValidationException::withMessages(['ticket' => $e->getMessage()]);
        }

        return back()->with('success', 'Ticket bumped & served from Expo.');
    }
}
