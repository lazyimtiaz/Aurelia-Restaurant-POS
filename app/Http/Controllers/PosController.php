<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Modules\Floor\Exceptions\TableNotAvailableException;
use App\Modules\Floor\Queries\GetBranchFloorQuery;
use App\Modules\Identity\Exceptions\InvalidManagerPinException;
use App\Modules\Identity\Queries\GetEvaluatorContextQuery;
use App\Modules\Kitchen\Enums\VoidReason;
use App\Modules\Menu\Queries\GetBranchCatalogQuery;
use App\Modules\Orders\Actions\AddDraftOrderItemAction;
use App\Modules\Orders\Actions\ApplyOrderDiscountAction;
use App\Modules\Orders\Actions\FireOrderRoundAction;
use App\Modules\Orders\Actions\OpenOrderTabAction;
use App\Modules\Orders\Actions\RemoveDraftOrderItemAction;
use App\Modules\Orders\Actions\VoidOrderItemAction;
use App\Modules\Orders\DTOs\OrderItemInputData;
use App\Modules\Orders\Enums\ServiceType;
use App\Modules\Orders\Exceptions\NoDraftItemsToFireException;
use App\Modules\Orders\Queries\GetActiveBranchOrdersQuery;
use DomainException;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

final class PosController extends Controller
{
    public function index(
        Request $request,
        GetEvaluatorContextQuery $getEvaluatorContext,
        GetBranchCatalogQuery $getCatalog,
        GetBranchFloorQuery $getFloor,
        GetActiveBranchOrdersQuery $getActiveOrders,
    ): Response {
        $context = $getEvaluatorContext->execute($request);
        $branchId = (int) $context['activeBranch']['id'];

        return Inertia::render('Pos/PosWorkspace', [
            'catalog' => $getCatalog->execute($branchId)->values()->all(),
            'zones' => $getFloor->execute($branchId),
            'activeOrders' => $getActiveOrders->execute($branchId),
            'initialOrderId' => $request->integer('order_id') ?: null,
        ]);
    }

    public function storeOrder(
        Request $request,
        GetEvaluatorContextQuery $getEvaluatorContext,
        OpenOrderTabAction $openOrderTab,
    ): RedirectResponse {
        $validated = $request->validate([
            'service_type' => ['required', Rule::enum(ServiceType::class)],
            'table_id' => ['nullable', 'integer'],
            'guest_count' => ['nullable', 'integer', 'min:1', 'max:24'],
            'customer_name' => ['nullable', 'string', 'max:120'],
        ]);

        $context = $getEvaluatorContext->execute($request);
        $branchId = (int) $context['activeBranch']['id'];
        $shiftId = (int) ($context['activeShift']['id'] ?? 0);
        $actorId = (int) $context['activeUser']['id'];

        try {
            $order = $openOrderTab->execute(
                branchId: $branchId,
                shiftId: $shiftId,
                serverId: $actorId,
                serviceType: ServiceType::from($validated['service_type']),
                tableId: isset($validated['table_id']) ? (int) $validated['table_id'] : null,
                guestCount: (int) ($validated['guest_count'] ?? 1),
                customerName: $validated['customer_name'] ?? null,
            );
        } catch (TableNotAvailableException|DomainException $e) {
            throw ValidationException::withMessages(['order' => $e->getMessage()]);
        }

        return back()->with('activeOrderId', $order->id);
    }

    public function addItem(
        Request $request,
        int $orderId,
        AddDraftOrderItemAction $addDraftItem,
    ): RedirectResponse {
        $validated = $request->validate([
            'menu_item_variant_id' => ['required', 'integer'],
            'quantity' => ['required', 'integer', 'min:1', 'max:50'],
            'modifier_option_ids' => ['sometimes', 'array'],
            'modifier_option_ids.*' => ['integer'],
            'seat_number' => ['nullable', 'integer', 'min:1', 'max:24'],
            'special_instructions' => ['nullable', 'string', 'max:240'],
        ]);

        try {
            $addDraftItem->execute($orderId, new OrderItemInputData(
                menuItemVariantId: (int) $validated['menu_item_variant_id'],
                quantity: (int) $validated['quantity'],
                modifierOptionIds: array_map('intval', $validated['modifier_option_ids'] ?? []),
                seatNumber: isset($validated['seat_number']) ? (int) $validated['seat_number'] : null,
                specialInstructions: $validated['special_instructions'] ?? null,
            ));
        } catch (DomainException $e) {
            throw ValidationException::withMessages(['menu_item_variant_id' => $e->getMessage()]);
        }

        return back()->with('activeOrderId', $orderId);
    }

    public function removeItem(
        int $itemId,
        RemoveDraftOrderItemAction $removeDraftItem,
    ): RedirectResponse {
        try {
            $order = $removeDraftItem->execute($itemId);
        } catch (DomainException $e) {
            throw ValidationException::withMessages(['item' => $e->getMessage()]);
        }

        return back()->with('activeOrderId', $order->id);
    }

    public function fireRound(
        Request $request,
        int $orderId,
        GetEvaluatorContextQuery $getEvaluatorContext,
        FireOrderRoundAction $fireRound,
    ): RedirectResponse {
        $context = $getEvaluatorContext->execute($request);
        $actorId = (int) $context['activeUser']['id'];

        try {
            $fireRound->execute($orderId, $actorId);
        } catch (NoDraftItemsToFireException|DomainException $e) {
            throw ValidationException::withMessages(['fire' => $e->getMessage()]);
        }

        return back()->with('activeOrderId', $orderId);
    }

    public function applyDiscount(
        Request $request,
        int $orderId,
        GetEvaluatorContextQuery $getEvaluatorContext,
        ApplyOrderDiscountAction $applyDiscount,
    ): RedirectResponse {
        $validated = $request->validate([
            'discount_bps' => ['required', 'integer', 'min:0', 'max:10000'],
            'manager_pin' => ['nullable', 'string', 'max:12'],
        ]);

        $context = $getEvaluatorContext->execute($request);
        $actorId = (int) $context['activeUser']['id'];

        try {
            $applyDiscount->execute(
                orderId: $orderId,
                discountBps: (int) $validated['discount_bps'],
                actorUserId: $actorId,
                managerPin: $validated['manager_pin'] ?? null,
            );
        } catch (InvalidManagerPinException $e) {
            throw ValidationException::withMessages(['manager_pin' => $e->getMessage()]);
        }

        return back()->with('activeOrderId', $orderId);
    }

    public function voidItem(
        Request $request,
        int $itemId,
        GetEvaluatorContextQuery $getEvaluatorContext,
        VoidOrderItemAction $voidOrderItem,
    ): RedirectResponse {
        $validated = $request->validate([
            'manager_pin' => ['required', 'string', 'max:12'],
            'reason' => ['required', Rule::enum(VoidReason::class)],
        ]);

        $context = $getEvaluatorContext->execute($request);
        $actorId = (int) $context['activeUser']['id'];

        try {
            $voided = $voidOrderItem->execute(
                orderItemId: $itemId,
                managerPin: (string) $validated['manager_pin'],
                reason: VoidReason::from($validated['reason']),
                actorUserId: $actorId,
            );
        } catch (InvalidManagerPinException $e) {
            throw ValidationException::withMessages(['manager_pin' => $e->getMessage()]);
        } catch (DomainException $e) {
            throw ValidationException::withMessages(['item' => $e->getMessage()]);
        }

        return back()->with('activeOrderId', $voided->order_id);
    }
}
