<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Modules\Identity\Queries\GetEvaluatorContextQuery;
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
        GetEvaluatorContextQuery $getEvaluatorContext,
        GetActiveKdsTicketsQuery $getActiveTickets,
    ): Response {
        $context = $getEvaluatorContext->execute($request);
        $branchId = (int) $context['activeBranch']['id'];

        $stationParam = $request->query('station');
        $station = is_string($stationParam) ? PrepStation::tryFrom($stationParam) : null;

        $stations = array_map(
            static fn (PrepStation $s): array => [
                'value' => $s->value,
                'label' => $s->label(),
            ],
            PrepStation::cases(),
        );

        return Inertia::render('Kds/KdsWorkspace', [
            'tickets' => $getActiveTickets->execute($branchId, $station)->values()->all(),
            'stations' => $stations,
            'activeStation' => $station?->value,
        ]);
    }

    public function bumpItem(
        Request $request,
        int $itemId,
        GetEvaluatorContextQuery $getEvaluatorContext,
        BumpKitchenItemStatusAction $bumpItem,
    ): RedirectResponse {
        $validated = $request->validate([
            'target_state' => ['required', Rule::enum(ItemPrepState::class)],
        ]);

        $context = $getEvaluatorContext->execute($request);
        $chefId = (int) $context['activeUser']['id'];

        try {
            $bumpItem->execute($itemId, ItemPrepState::from($validated['target_state']), $chefId);
        } catch (DomainException $e) {
            throw ValidationException::withMessages(['item' => $e->getMessage()]);
        }

        return back();
    }

    public function serveTicket(
        Request $request,
        int $ticketId,
        GetEvaluatorContextQuery $getEvaluatorContext,
        ServeKitchenTicketExpoAction $serveTicket,
    ): RedirectResponse {
        $context = $getEvaluatorContext->execute($request);
        $expoId = (int) $context['activeUser']['id'];
        $simulateLowStock = (bool) ($context['simulations']['triggerLowStockAuto86'] ?? false);

        try {
            $serveTicket->execute($ticketId, $expoId, $simulateLowStock);
        } catch (TicketNotReadyForExpoException $e) {
            throw ValidationException::withMessages(['ticket' => $e->getMessage()]);
        }

        return back();
    }
}
