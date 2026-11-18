<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Modules\Billing\Actions\BuildThermalReceiptAction;
use App\Modules\Billing\Actions\RefundPaymentAction;
use App\Modules\Billing\Actions\ReopenOrderFromBillingAction;
use App\Modules\Billing\Actions\RequestOrderBillAction;
use App\Modules\Billing\Actions\SettleBillSplitAction;
use App\Modules\Billing\Actions\SplitOrderBillAction;
use App\Modules\Billing\DTOs\RefundPaymentData;
use App\Modules\Billing\DTOs\SeatItemAllocationData;
use App\Modules\Billing\DTOs\SettleBillSplitData;
use App\Modules\Billing\DTOs\SplitOrderBillData;
use App\Modules\Billing\Enums\PaymentState;
use App\Modules\Billing\Enums\SplitMode;
use App\Modules\Billing\Enums\TenderMethod;
use App\Modules\Billing\Exceptions\CannotReopenPartiallyPaidOrderException;
use App\Modules\Billing\Exceptions\RefundExceedsCapturedAmountException;
use App\Modules\Identity\Exceptions\InvalidManagerPinException;
use App\Modules\Identity\Queries\GetEvaluatorContextQuery;
use DomainException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use InvalidArgumentException;

final class BillingController extends Controller
{
    public function requestBill(
        int $orderId,
        RequestOrderBillAction $requestBill,
    ): RedirectResponse {
        try {
            $requestBill->execute($orderId);
        } catch (DomainException $e) {
            throw ValidationException::withMessages(['billing' => $e->getMessage()]);
        }

        return back()->with('activeOrderId', $orderId);
    }

    public function reopenOrder(
        int $orderId,
        ReopenOrderFromBillingAction $reopenOrder,
    ): RedirectResponse {
        try {
            $reopenOrder->execute($orderId);
        } catch (CannotReopenPartiallyPaidOrderException|DomainException $e) {
            throw ValidationException::withMessages(['billing' => $e->getMessage()]);
        }

        return back()->with('activeOrderId', $orderId);
    }

    public function splitOrder(
        Request $request,
        int $orderId,
        SplitOrderBillAction $splitBill,
    ): RedirectResponse {
        $validated = $request->validate([
            'mode' => ['required', Rule::enum(SplitMode::class)],
            'equal_ways' => ['nullable', 'integer', 'min:2', 'max:20'],
            'seat_groups' => ['nullable', 'array'],
        ]);

        $mode = SplitMode::from($validated['mode']);
        $seatGroups = [];

        if ($mode === SplitMode::ItemSeat && is_array($validated['seat_groups'] ?? null)) {
            foreach ($validated['seat_groups'] as $label => $allocations) {
                $seatGroups[(string) $label] = array_map(
                    static fn (array $row): SeatItemAllocationData => new SeatItemAllocationData(
                        orderItemId: (int) $row['order_item_id'],
                        shareNumerator: (int) ($row['share_numerator'] ?? 1),
                        shareDenominator: (int) ($row['share_denominator'] ?? 1),
                    ),
                    $allocations,
                );
            }
        }

        try {
            $splitBill->execute(new SplitOrderBillData(
                orderId: $orderId,
                mode: $mode,
                equalWays: isset($validated['equal_ways']) ? (int) $validated['equal_ways'] : null,
                seatGroups: $seatGroups,
            ));
        } catch (CannotReopenPartiallyPaidOrderException|DomainException|InvalidArgumentException $e) {
            throw ValidationException::withMessages(['split' => $e->getMessage()]);
        }

        return back()->with('activeOrderId', $orderId);
    }

    public function paySplit(
        Request $request,
        int $billSplitId,
        GetEvaluatorContextQuery $getEvaluatorContext,
        SettleBillSplitAction $settleSplit,
    ): RedirectResponse {
        $validated = $request->validate([
            'tender_method' => ['required', Rule::enum(TenderMethod::class)],
            'amount_tendered_cents' => ['required', 'integer', 'min:0'],
            'tip_cents' => ['nullable', 'integer', 'min:0'],
            'idempotency_key' => ['required', 'string', 'max:100'],
        ]);

        $context = $getEvaluatorContext->execute($request);
        $shiftId = (int) ($context['activeShift']['id'] ?? 0);
        $actorId = (int) $context['activeUser']['id'];
        $simulateDecline = (bool) ($context['simulations']['simulateCardDecline'] ?? false);

        try {
            $tx = $settleSplit->execute(new SettleBillSplitData(
                billSplitId: $billSplitId,
                shiftId: $shiftId,
                actorUserId: $actorId,
                tenderMethod: TenderMethod::from($validated['tender_method']),
                amountTenderedCents: (int) $validated['amount_tendered_cents'],
                tipCents: (int) ($validated['tip_cents'] ?? 0),
                idempotencyKey: (string) $validated['idempotency_key'],
                simulateDecline: $simulateDecline,
            ));
        } catch (DomainException|InvalidArgumentException $e) {
            throw ValidationException::withMessages(['payment' => $e->getMessage()]);
        }

        if ($tx->state === PaymentState::Failed) {
            throw ValidationException::withMessages([
                'payment' => $tx->failure_reason ?? 'Payment declined by issuer.',
            ]);
        }

        return back()
            ->with('activeOrderId', $tx->order_id)
            ->with('success', 'Payment captured successfully.');
    }

    public function refundPayment(
        Request $request,
        int $paymentId,
        GetEvaluatorContextQuery $getEvaluatorContext,
        RefundPaymentAction $refundPayment,
    ): RedirectResponse {
        $validated = $request->validate([
            'refund_amount_cents' => ['required', 'integer', 'min:1'],
            'manager_pin' => ['required', 'string', 'max:12'],
            'reason' => ['required', 'string', 'max:180'],
            'wastage' => ['required', 'boolean'],
        ]);

        $context = $getEvaluatorContext->execute($request);
        $shiftId = (int) ($context['activeShift']['id'] ?? 0);
        $actorId = (int) $context['activeUser']['id'];

        try {
            $refundPayment->execute(new RefundPaymentData(
                paymentTransactionId: $paymentId,
                refundAmountCents: (int) $validated['refund_amount_cents'],
                managerPin: (string) $validated['manager_pin'],
                actorUserId: $actorId,
                reason: (string) $validated['reason'],
                wastage: (bool) $validated['wastage'],
                activeShiftId: $shiftId,
            ));
        } catch (InvalidManagerPinException $e) {
            throw ValidationException::withMessages(['manager_pin' => $e->getMessage()]);
        } catch (RefundExceedsCapturedAmountException|DomainException|InvalidArgumentException $e) {
            throw ValidationException::withMessages(['refund' => $e->getMessage()]);
        }

        return back()->with('success', 'Refund issued and logged.');
    }

    public function showReceipt(
        int $billSplitId,
        BuildThermalReceiptAction $buildReceipt,
    ): JsonResponse {
        return response()->json($buildReceipt->execute($billSplitId));
    }
}
