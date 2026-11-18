<?php

declare(strict_types=1);

namespace App\Modules\Billing\Actions;

use App\Modules\Billing\DTOs\SeatItemAllocationData;
use App\Modules\Billing\DTOs\SplitOrderBillData;
use App\Modules\Billing\Enums\BillSplitState;
use App\Modules\Billing\Enums\SplitMode;
use App\Modules\Billing\Events\OrderBillSplitUpdated;
use App\Modules\Billing\Exceptions\CannotReopenPartiallyPaidOrderException;
use App\Modules\Billing\Models\BillSplit;
use App\Modules\Billing\Models\BillSplitItem;
use App\Modules\Kitchen\Enums\ItemPrepState;
use App\Modules\Orders\Enums\OrderState;
use App\Modules\Orders\Models\Order;
use App\Modules\Orders\Models\OrderItem;
use DomainException;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

final class SplitOrderBillAction
{
    /**
     * @return Collection<int, BillSplit>
     */
    public function execute(SplitOrderBillData $data): Collection
    {
        return DB::transaction(function () use ($data): Collection {
            $order = Order::query()->whereKey($data->orderId)->lockForUpdate()->firstOrFail();

            if (! in_array($order->state, [OrderState::Billing, OrderState::Open, OrderState::Draft], true)) {
                if ($order->state === OrderState::PartiallyPaid) {
                    throw CannotReopenPartiallyPaidOrderException::forOrder($order->order_number);
                }
                throw new DomainException("Order {$order->order_number} cannot be split in '{$order->state->value}' state.");
            }

            $hasPaidSplit = BillSplit::query()
                ->where('order_id', $order->id)
                ->where('state', BillSplitState::Paid->value)
                ->exists();

            if ($hasPaidSplit) {
                throw CannotReopenPartiallyPaidOrderException::forOrder($order->order_number);
            }

            $activeItems = OrderItem::query()
                ->where('order_id', $order->id)
                ->where('prep_state', '!=', ItemPrepState::Voided->value)
                ->orderBy('id')
                ->get()
                ->keyBy('id');

            if ($activeItems->isEmpty()) {
                throw new DomainException('Cannot split an order with zero billable items.');
            }

            BillSplit::query()->where('order_id', $order->id)->delete();

            $created = match ($data->mode) {
                SplitMode::Unified => $this->createEqualSplits($order, $activeItems, 1, SplitMode::Unified),
                SplitMode::Equal => $this->createEqualSplits(
                    $order,
                    $activeItems,
                    max(2, (int) ($data->equalWays ?? 2)),
                    SplitMode::Equal,
                ),
                SplitMode::ItemSeat => $this->createItemSeatSplits($order, $activeItems, $data->seatGroups),
            };

            OrderBillSplitUpdated::dispatch(
                branchId: $order->branch_id,
                orderId: $order->id,
                splitMode: $data->mode,
                checkCount: $created->count(),
            );

            return $created;
        });
    }

    /**
     * @param  Collection<int, OrderItem>  $activeItems
     * @return Collection<int, BillSplit>
     */
    private function createEqualSplits(Order $order, Collection $activeItems, int $ways, SplitMode $mode): Collection
    {
        $subtotals = $this->distributeEqually($order->subtotal_cents, $ways);
        $discounts = $this->distributeEqually($order->discount_cents, $ways);
        $services = $this->distributeEqually($order->service_charge_cents, $ways);
        $totals = $this->distributeEqually($order->total_cents, $ways);

        $created = collect();

        for ($i = 0; $i < $ways; $i++) {
            $taxCents = $totals[$i] - ($subtotals[$i] - $discounts[$i] + $services[$i]);

            $split = BillSplit::create([
                'order_id' => $order->id,
                'sequence_number' => $i + 1,
                'label' => $ways === 1 ? 'Check 1' : 'Check '.($i + 1)." of {$ways}",
                'split_mode' => $mode,
                'state' => BillSplitState::Pending,
                'subtotal_cents' => $subtotals[$i],
                'discount_cents' => $discounts[$i],
                'service_charge_cents' => $services[$i],
                'tax_cents' => $taxCents,
                'tip_cents' => 0,
                'total_cents' => $totals[$i],
            ]);

            if ($mode === SplitMode::Unified) {
                foreach ($activeItems as $item) {
                    BillSplitItem::create([
                        'bill_split_id' => $split->id,
                        'order_item_id' => $item->id,
                        'share_numerator' => 1,
                        'share_denominator' => 1,
                        'allocated_subtotal_cents' => $item->line_total_cents,
                    ]);
                }
            }

            $created->push($split);
        }

        return $created;
    }

    /**
     * @param  Collection<int, OrderItem>  $activeItems
     * @param  array<string, list<SeatItemAllocationData>>  $seatGroups
     * @return Collection<int, BillSplit>
     */
    private function createItemSeatSplits(Order $order, Collection $activeItems, array $seatGroups): Collection
    {
        if ($seatGroups === []) {
            throw new InvalidArgumentException('Seat groups cannot be empty for item/seat splitting.');
        }

        // Track exact fractional coverage per order_item_id using [num, den] reduced fractions.
        $coverage = [];
        $itemShareTotals = [];

        foreach ($seatGroups as $label => $allocations) {
            foreach ($allocations as $alloc) {
                if (! $activeItems->has($alloc->orderItemId)) {
                    throw new InvalidArgumentException("Order item {$alloc->orderItemId} is not billable on this order.");
                }
                if ($alloc->shareNumerator <= 0 || $alloc->shareDenominator <= 0 || $alloc->shareNumerator > $alloc->shareDenominator) {
                    throw new InvalidArgumentException('Invalid fractional share.');
                }

                $prev = $coverage[$alloc->orderItemId] ?? [0, 1];
                $coverage[$alloc->orderItemId] = $this->addFractions($prev[0], $prev[1], $alloc->shareNumerator, $alloc->shareDenominator);
                $itemShareTotals[$alloc->orderItemId][] = [
                    'group' => $label,
                    'num' => $alloc->shareNumerator,
                    'den' => $alloc->shareDenominator,
                ];
            }
        }

        foreach ($activeItems as $item) {
            $cov = $coverage[$item->id] ?? [0, 1];
            if ($cov[0] !== 1 || $cov[1] !== 1) {
                throw new InvalidArgumentException("Order item {$item->id} shares must sum to exactly 100% (1/1).");
            }
        }

        // Pre-allocate each item's exact cents across groups, putting odd-penny remainder on its last share.
        $groupItemAllocations = [];
        foreach ($itemShareTotals as $itemId => $shares) {
            /** @var OrderItem $item */
            $item = $activeItems->get($itemId);
            $allocatedSum = 0;
            $lastIdx = count($shares) - 1;

            foreach ($shares as $idx => $share) {
                $cents = $idx === $lastIdx
                    ? $item->line_total_cents - $allocatedSum
                    : intdiv($item->line_total_cents * $share['num'], $share['den']);

                $allocatedSum += $cents;
                $groupItemAllocations[$share['group']][] = [
                    'order_item_id' => $itemId,
                    'num' => $share['num'],
                    'den' => $share['den'],
                    'cents' => $cents,
                ];
            }
        }

        $groupLabels = array_keys($seatGroups);
        $groupCount = count($groupLabels);
        $orderSubtotal = max(1, $order->subtotal_cents);

        $usedDiscount = 0;
        $usedService = 0;
        $usedTax = 0;
        $created = collect();

        foreach ($groupLabels as $idx => $label) {
            $rows = $groupItemAllocations[$label] ?? [];
            $checkSubtotal = array_sum(array_column($rows, 'cents'));
            $isLast = $idx === $groupCount - 1;

            $checkDiscount = $isLast
                ? $order->discount_cents - $usedDiscount
                : intdiv(($checkSubtotal * $order->discount_cents) + intdiv($orderSubtotal, 2), $orderSubtotal);

            $checkService = $isLast
                ? $order->service_charge_cents - $usedService
                : intdiv(($checkSubtotal * $order->service_charge_cents) + intdiv($orderSubtotal, 2), $orderSubtotal);

            $checkTax = $isLast
                ? $order->tax_cents - $usedTax
                : intdiv(($checkSubtotal * $order->tax_cents) + intdiv($orderSubtotal, 2), $orderSubtotal);

            $usedDiscount += $checkDiscount;
            $usedService += $checkService;
            $usedTax += $checkTax;

            $checkTotal = $checkSubtotal - $checkDiscount + $checkService + $checkTax;

            $split = BillSplit::create([
                'order_id' => $order->id,
                'sequence_number' => $idx + 1,
                'label' => $label,
                'split_mode' => SplitMode::ItemSeat,
                'state' => BillSplitState::Pending,
                'subtotal_cents' => $checkSubtotal,
                'discount_cents' => $checkDiscount,
                'service_charge_cents' => $checkService,
                'tax_cents' => $checkTax,
                'tip_cents' => 0,
                'total_cents' => $checkTotal,
            ]);

            foreach ($rows as $row) {
                BillSplitItem::create([
                    'bill_split_id' => $split->id,
                    'order_item_id' => $row['order_item_id'],
                    'share_numerator' => $row['num'],
                    'share_denominator' => $row['den'],
                    'allocated_subtotal_cents' => $row['cents'],
                ]);
            }

            $created->push($split);
        }

        return $created;
    }

    /**
     * @return list<int>
     */
    private function distributeEqually(int $amountCents, int $ways): array
    {
        $base = intdiv($amountCents, $ways);
        $remainder = $amountCents % $ways;
        $parts = [];

        for ($i = 0; $i < $ways; $i++) {
            $parts[] = $base + ($i >= ($ways - $remainder) ? 1 : 0);
        }

        return $parts;
    }

    /**
     * @return array{0: int, 1: int}
     */
    private function addFractions(int $n1, int $d1, int $n2, int $d2): array
    {
        $num = ($n1 * $d2) + ($n2 * $d1);
        $den = $d1 * $d2;
        $gcd = $this->gcd($num, $den);

        return [intdiv($num, $gcd), intdiv($den, $gcd)];
    }

    private function gcd(int $a, int $b): int
    {
        $a = abs($a);
        $b = abs($b);

        while ($b !== 0) {
            [$a, $b] = [$b, $a % $b];
        }

        return max(1, $a);
    }
}
