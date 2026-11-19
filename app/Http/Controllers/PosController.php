<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Modules\Floor\Exceptions\TableNotAvailableException;
use App\Modules\Floor\Queries\GetBranchFloorQuery;
use App\Modules\Identity\Exceptions\InvalidManagerPinException;
use App\Modules\Identity\Services\CurrentStaffContext;
use App\Modules\Kitchen\Enums\VoidReason;
use App\Modules\Menu\Queries\GetBranchCatalogQuery;
use App\Modules\Orders\Actions\AddDraftOrderItemAction;
use App\Modules\Orders\Actions\ApplyOrderDiscountAction;
use App\Modules\Orders\Actions\CancelDraftOrderAction;
use App\Modules\Orders\Actions\FireOrderRoundAction;
use App\Modules\Orders\Actions\OpenOrderTabAction;
use App\Modules\Orders\Actions\RemoveDraftOrderItemAction;
use App\Modules\Orders\Actions\UpdateDraftOrderItemQuantityAction;
use App\Modules\Orders\Actions\VoidOrderItemAction;
use App\Modules\Orders\DTOs\OrderItemInputData;
use App\Modules\Orders\Enums\ServiceType;
use App\Modules\Orders\Exceptions\NoDraftItemsToFireException;
use App\Modules\Orders\Queries\GetActiveBranchOrdersQuery;
use App\Modules\Shifts\Queries\FindActiveOpenShiftQuery;
use DomainException;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use InvalidArgumentException;

final class PosController extends Controller
{
    public function index(
        Request $request,
        CurrentStaffContext $staffContext,
        GetBranchCatalogQuery $getCatalog,
        GetBranchFloorQuery $getFloor,
        GetActiveBranchOrdersQuery $getActiveOrders,
    ): Response {
        $branch = $staffContext->requireActiveBranch($request);

        return Inertia::render('Pos/PosPage', [
            'catalog' => $getCatalog->execute($branch->id)->values()->all(),
            'zones' => $getFloor->execute($branch->id),
            'activeOrders' => $getActiveOrders->execute($branch->id),
            'initialOrderId' => $request->integer('order_id') ?: null,
        ]);
    }

    public function storeOrder(
        Request $request,
        CurrentStaffContext $staffContext,
        FindActiveOpenShiftQuery $findActiveShift,
        OpenOrderTabAction $openOrderTab,
    ): RedirectResponse {
        $validated = $request->validate([
            'service_type' => ['required', Rule::enum(ServiceType::class)],
            'table_id' => ['nullable', 'integer'],
            'guest_count' => ['nullable', 'integer', 'min:1', 'max:24'],
            'customer_name' => ['nullable', 'string', 'max:120'],
        ]);

        $staff = $staffContext->requireStaff($request);
        $branch = $staffContext->requireActiveBranch($request);
        $shift = $findActiveShift->execute($branch->id, $staff->id);

        try {
            $order = $openOrderTab->execute(
                branchId: $branch->id,
                shiftId: $shift?->id ?? 0,
                serverId: $staff->id,
                serviceType: ServiceType::from($validated['service_type']),
                tableId: isset($validated['table_id']) ? (int) $validated['table_id'] : null,
                guestCount: (int) ($validated['guest_count'] ?? 1),
                customerName: $validated['customer_name'] ?? null,
            );
        } catch (TableNotAvailableException|DomainException $e) {
            throw ValidationException::withMessages(['order' => $e->getMessage()]);
        }

        return back()
            ->with('activeOrderId', $order->id)
            ->with('success', "Order {$order->order_number} opened.");
    }

    public function cancelOrder(
        Request $request,
        int $orderId,
        CurrentStaffContext $staffContext,
        CancelDraftOrderAction $cancelOrder,
    ): RedirectResponse {
        $staff = $staffContext->requireStaff($request);

        try {
            $cancelled = $cancelOrder->execute($orderId, $staff->id);
        } catch (DomainException $e) {
            throw ValidationException::withMessages(['order' => $e->getMessage()]);
        }

        return back()->with('success', "Draft tab {$cancelled->order_number} cancelled.");
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

    public function updateItemQuantity(
        Request $request,
        int $itemId,
        UpdateDraftOrderItemQuantityAction $updateQuantity,
    ): RedirectResponse {
        $validated = $request->validate([
            'quantity' => ['required', 'integer', 'min:0', 'max:50'],
        ]);

        try {
            $order = $updateQuantity->execute($itemId, (int) $validated['quantity']);
        } catch (DomainException|InvalidArgumentException $e) {
            throw ValidationException::withMessages(['item' => $e->getMessage()]);
        }

        return back()->with('activeOrderId', $order->id);
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
        CurrentStaffContext $staffContext,
        FireOrderRoundAction $fireRound,
    ): RedirectResponse {
        $staff = $staffContext->requireStaff($request);

        try {
            $fireRound->execute($orderId, $staff->id);
        } catch (NoDraftItemsToFireException|DomainException $e) {
            throw ValidationException::withMessages(['fire' => $e->getMessage()]);
        }

        return back()
            ->with('activeOrderId', $orderId)
            ->with('success', 'Order round fired to kitchen stations.');
    }

    public function applyDiscount(
        Request $request,
        int $orderId,
        CurrentStaffContext $staffContext,
        ApplyOrderDiscountAction $applyDiscount,
    ): RedirectResponse {
        $validated = $request->validate([
            'discount_bps' => ['required', 'integer', 'min:0', 'max:10000'],
            'manager_pin' => ['nullable', 'string', 'max:12'],
        ]);

        $staff = $staffContext->requireStaff($request);

        try {
            $applyDiscount->execute(
                orderId: $orderId,
                discountBps: (int) $validated['discount_bps'],
                actorUserId: $staff->id,
                managerPin: $validated['manager_pin'] ?? null,
            );
        } catch (InvalidManagerPinException $e) {
            throw ValidationException::withMessages(['manager_pin' => $e->getMessage()]);
        }

        return back()
            ->with('activeOrderId', $orderId)
            ->with('success', 'Discount updated on order.');
    }

    public function voidItem(
        Request $request,
        int $itemId,
        CurrentStaffContext $staffContext,
        VoidOrderItemAction $voidOrderItem,
    ): RedirectResponse {
        $validated = $request->validate([
            'manager_pin' => ['required', 'string', 'max:12'],
            'reason' => ['required', Rule::enum(VoidReason::class)],
        ]);

        $staff = $staffContext->requireStaff($request);

        try {
            $voided = $voidOrderItem->execute(
                orderItemId: $itemId,
                managerPin: (string) $validated['manager_pin'],
                reason: VoidReason::from($validated['reason']),
                actorUserId: $staff->id,
            );
        } catch (InvalidManagerPinException $e) {
            throw ValidationException::withMessages(['manager_pin' => $e->getMessage()]);
        } catch (DomainException $e) {
            throw ValidationException::withMessages(['item' => $e->getMessage()]);
        }

        return back()
            ->with('activeOrderId', $voided->order_id)
            ->with('success', 'Item voided and audited.');
    }
}
