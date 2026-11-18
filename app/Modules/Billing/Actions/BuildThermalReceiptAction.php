<?php

declare(strict_types=1);

namespace App\Modules\Billing\Actions;

use App\Modules\Billing\DTOs\ThermalReceiptData;
use App\Modules\Billing\Models\BillSplit;
use App\Modules\Billing\Models\BillSplitItem;
use App\Modules\Billing\Models\PaymentTransaction;
use App\Modules\Kitchen\Enums\ItemPrepState;
use App\Modules\Orders\Models\OrderItem;

final class BuildThermalReceiptAction
{
    public function execute(int $billSplitId): ThermalReceiptData
    {
        $split = BillSplit::query()
            ->with([
                'order.branch',
                'order.table',
                'order.items' => fn ($q) => $q->where('prep_state', '!=', ItemPrepState::Voided->value),
                'items.orderItem',
                'transactions' => fn ($q) => $q->orderBy('id'),
            ])
            ->findOrFail($billSplitId);

        $order = $split->order;
        $branch = $order->branch;

        $lineItems = $split->items->isNotEmpty()
            ? $split->items->map(fn (BillSplitItem $splitItem): array => [
                'name' => $splitItem->orderItem->item_name_snapshot,
                'variant' => $splitItem->orderItem->variant_name_snapshot,
                'quantity' => $splitItem->orderItem->quantity,
                'share' => $splitItem->share_denominator > 1
                    ? "{$splitItem->share_numerator}/{$splitItem->share_denominator}"
                    : null,
                'amount_cents' => $splitItem->allocated_subtotal_cents,
            ])->values()->all()
            : $order->items->map(fn (OrderItem $item): array => [
                'name' => $item->item_name_snapshot,
                'variant' => $item->variant_name_snapshot,
                'quantity' => $item->quantity,
                'share' => null,
                'amount_cents' => $item->line_total_cents,
            ])->values()->all();

        $payments = $split->transactions->map(fn (PaymentTransaction $tx): array => [
            'id' => $tx->id,
            'tender_method' => $tx->tender_method->value,
            'state' => $tx->state->value,
            'amount_cents' => $tx->amount_cents,
            'tip_cents' => $tx->tip_cents,
            'tendered_cents' => $tx->tendered_cents,
            'change_cents' => $tx->change_cents,
            'reference' => $tx->gateway_reference,
            'created_at' => $tx->created_at?->toIso8601String(),
        ])->values()->all();

        return new ThermalReceiptData(
            billSplitId: $split->id,
            branchName: $branch->name,
            branchCode: $branch->code,
            orderNumber: $order->order_number,
            checkLabel: $split->label,
            splitMode: $split->split_mode->value,
            tableCode: $order->table?->code,
            customerName: $order->customer_name,
            issuedAtIso: now()->toIso8601String(),
            lineItems: $lineItems,
            subtotalCents: $split->subtotal_cents,
            discountCents: $split->discount_cents,
            serviceChargeCents: $split->service_charge_cents,
            taxCents: $split->tax_cents,
            tipCents: $split->tip_cents,
            totalCents: $split->total_cents,
            payments: $payments,
        );
    }
}
