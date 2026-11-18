<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Queries;

use App\Modules\Billing\Enums\PaymentState;
use App\Modules\Billing\Models\PaymentTransaction;
use App\Modules\Inventory\Enums\StockMovementType;
use App\Modules\Inventory\Models\StockMovement;
use App\Modules\Kitchen\Enums\ItemPrepState;
use App\Modules\Orders\Enums\OrderState;
use App\Modules\Orders\Models\Order;
use App\Modules\Orders\Models\OrderItem;
use App\Modules\Reporting\DTOs\BranchComparisonRowData;
use App\Modules\Reporting\DTOs\ExecutiveDashboardData;
use App\Modules\Reporting\DTOs\HourlySalesPointData;
use App\Modules\Reporting\DTOs\TopProductRowData;
use App\Modules\Restaurant\Models\Branch;
use App\Modules\Shifts\Enums\ShiftState;
use App\Modules\Shifts\Models\Shift;
use Carbon\CarbonImmutable;

final class GetExecutiveDashboardMetricsQuery
{
    public function execute(
        ?int $branchId = null,
        ?string $dateFrom = null,
        ?string $dateTo = null,
    ): ExecutiveDashboardData {
        $from = $dateFrom !== null && trim($dateFrom) !== ''
            ? CarbonImmutable::parse($dateFrom)->startOfDay()
            : null;
        $to = $dateTo !== null && trim($dateTo) !== ''
            ? CarbonImmutable::parse($dateTo)->endOfDay()
            : null;

        $branches = Branch::query()
            ->where(function ($query) use ($branchId): void {
                $query->where('is_active', true);
                if ($branchId !== null) {
                    $query->orWhere('id', $branchId);
                }
            })
            ->orderBy('id')
            ->get(['id', 'code', 'name']);

        $paidOrders = Order::query()
            ->where('state', OrderState::Paid->value)
            ->when($from !== null, fn ($q) => $q->where('created_at', '>=', $from))
            ->when($to !== null, fn ($q) => $q->where('created_at', '<=', $to))
            ->get(['id', 'branch_id', 'total_cents', 'created_at']);

        /** @var array<int, int> $grossRevenueByBranch */
        $grossRevenueByBranch = [];
        /** @var array<int, int> $ordersCountByBranch */
        $ordersCountByBranch = [];
        /** @var array<int, array{revenue: int, orders: int}> $hourlyBuckets */
        $hourlyBuckets = [];
        for ($hour = 0; $hour < 24; $hour++) {
            $hourlyBuckets[$hour] = ['revenue' => 0, 'orders' => 0];
        }

        foreach ($paidOrders as $order) {
            $bId = (int) $order->branch_id;
            $orderTotal = (int) $order->total_cents;
            $grossRevenueByBranch[$bId] = ($grossRevenueByBranch[$bId] ?? 0) + $orderTotal;
            $ordersCountByBranch[$bId] = ($ordersCountByBranch[$bId] ?? 0) + 1;

            if ($branchId === null || $bId === $branchId) {
                $hour = $order->created_at?->hour ?? 0;
                $hourlyBuckets[$hour]['revenue'] += $orderTotal;
                $hourlyBuckets[$hour]['orders'] += 1;
            }
        }

        $refundsByBranch = PaymentTransaction::query()
            ->where('state', PaymentState::Refunded->value)
            ->when($from !== null, fn ($q) => $q->where('created_at', '>=', $from))
            ->when($to !== null, fn ($q) => $q->where('created_at', '<=', $to))
            ->selectRaw('branch_id, SUM(amount_cents) as refund_sum')
            ->groupBy('branch_id')
            ->pluck('refund_sum', 'branch_id');

        $stockMovements = StockMovement::query()
            ->whereIn('movement_type', [
                StockMovementType::OrderSale->value,
                StockMovementType::Wastage->value,
            ])
            ->when($from !== null, fn ($q) => $q->where('created_at', '>=', $from))
            ->when($to !== null, fn ($q) => $q->where('created_at', '<=', $to))
            ->selectRaw('branch_id, movement_type, SUM(total_cost_cents) as cost_sum')
            ->groupBy('branch_id', 'movement_type')
            ->get();

        /** @var array<int, int> $cogsByBranch */
        $cogsByBranch = [];
        /** @var array<int, int> $wastageByBranch */
        $wastageByBranch = [];

        foreach ($stockMovements as $movement) {
            $bId = (int) $movement->branch_id;
            $cost = (int) $movement->cost_sum;
            $type = $movement->movement_type instanceof StockMovementType
                ? $movement->movement_type->value
                : (string) $movement->movement_type;

            if ($type === StockMovementType::OrderSale->value) {
                $cogsByBranch[$bId] = ($cogsByBranch[$bId] ?? 0) + $cost;
            } elseif ($type === StockMovementType::Wastage->value) {
                $wastageByBranch[$bId] = ($wastageByBranch[$bId] ?? 0) + $cost;
            }
        }

        $voidsByBranch = OrderItem::query()
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->where('order_items.prep_state', ItemPrepState::Voided->value)
            ->when($from !== null, fn ($q) => $q->where('order_items.created_at', '>=', $from))
            ->when($to !== null, fn ($q) => $q->where('order_items.created_at', '<=', $to))
            ->selectRaw('orders.branch_id as branch_id, SUM(order_items.line_total_cents) as void_sum')
            ->groupBy('orders.branch_id')
            ->pluck('void_sum', 'branch_id');

        $varianceByBranch = Shift::query()
            ->whereIn('state', [
                ShiftState::Closed->value,
                ShiftState::VarianceFlagged->value,
            ])
            ->whereNotNull('variance_cents')
            ->when($from !== null, fn ($q) => $q->where('closed_at', '>=', $from))
            ->when($to !== null, fn ($q) => $q->where('closed_at', '<=', $to))
            ->selectRaw('branch_id, SUM(variance_cents) as variance_sum')
            ->groupBy('branch_id')
            ->pluck('variance_sum', 'branch_id');

        /** @var list<BranchComparisonRowData> $branchComparisons */
        $branchComparisons = [];
        $totalRevenueCents = 0;
        $totalOrdersCount = 0;
        $totalCogsCents = 0;
        $totalVoidsCents = 0;
        $netCashVarianceCents = 0;
        $totalWastageCents = 0;

        foreach ($branches as $branch) {
            $bId = (int) $branch->id;
            $gross = $grossRevenueByBranch[$bId] ?? 0;
            $refundSum = (int) ($refundsByBranch[$bId] ?? 0);
            $netRevenue = max(0, $gross + $refundSum);
            $ordersCount = $ordersCountByBranch[$bId] ?? 0;
            $aov = $ordersCount > 0 ? intdiv($netRevenue, $ordersCount) : 0;
            $cogs = $cogsByBranch[$bId] ?? 0;
            $cogsBps = $netRevenue > 0 ? intdiv($cogs * 10000, $netRevenue) : 0;
            $voids = (int) ($voidsByBranch[$bId] ?? 0);
            $variance = (int) ($varianceByBranch[$bId] ?? 0);
            $wastage = $wastageByBranch[$bId] ?? 0;

            $branchComparisons[] = new BranchComparisonRowData(
                branchId: $bId,
                branchCode: $branch->code,
                branchName: $branch->name,
                revenueCents: $netRevenue,
                ordersCount: $ordersCount,
                averageOrderValueCents: $aov,
                cogsCents: $cogs,
                cogsPercentBps: $cogsBps,
                voidsCents: $voids,
                cashVarianceCents: $variance,
                wastageCents: $wastage,
            );

            if ($branchId === null || $bId === $branchId) {
                $totalRevenueCents += $netRevenue;
                $totalOrdersCount += $ordersCount;
                $totalCogsCents += $cogs;
                $totalVoidsCents += $voids;
                $netCashVarianceCents += $variance;
                $totalWastageCents += $wastage;
            }
        }

        $overallAov = $totalOrdersCount > 0 ? intdiv($totalRevenueCents, $totalOrdersCount) : 0;
        $overallCogsBps = $totalRevenueCents > 0 ? intdiv($totalCogsCents * 10000, $totalRevenueCents) : 0;

        /** @var list<HourlySalesPointData> $hourlySales */
        $hourlySales = [];
        for ($hour = 0; $hour < 24; $hour++) {
            $hourlySales[] = new HourlySalesPointData(
                hour: $hour,
                label: sprintf('%02d:00', $hour),
                revenueCents: $hourlyBuckets[$hour]['revenue'],
                ordersCount: $hourlyBuckets[$hour]['orders'],
            );
        }

        $topProductsRows = OrderItem::query()
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->where('orders.state', OrderState::Paid->value)
            ->where('order_items.prep_state', '!=', ItemPrepState::Voided->value)
            ->when($branchId !== null, fn ($q) => $q->where('orders.branch_id', $branchId))
            ->when($from !== null, fn ($q) => $q->where('orders.created_at', '>=', $from))
            ->when($to !== null, fn ($q) => $q->where('orders.created_at', '<=', $to))
            ->selectRaw('order_items.menu_item_variant_id as menu_item_variant_id, MAX(order_items.item_name_snapshot) as item_name, MAX(order_items.variant_name_snapshot) as variant_name, SUM(order_items.quantity) as quantity_sold, SUM(order_items.line_total_cents) as revenue_cents')
            ->groupBy('order_items.menu_item_variant_id')
            ->orderByDesc('revenue_cents')
            ->limit(10)
            ->get();

        $topProducts = $topProductsRows
            ->map(static fn ($row): TopProductRowData => new TopProductRowData(
                menuItemVariantId: (int) $row->menu_item_variant_id,
                itemName: (string) $row->item_name,
                variantName: (string) $row->variant_name,
                quantitySold: (int) $row->quantity_sold,
                revenueCents: (int) $row->revenue_cents,
            ))
            ->values()
            ->all();

        return new ExecutiveDashboardData(
            totalRevenueCents: $totalRevenueCents,
            totalOrdersCount: $totalOrdersCount,
            averageOrderValueCents: $overallAov,
            totalCogsCents: $totalCogsCents,
            cogsPercentBps: $overallCogsBps,
            totalVoidsCents: $totalVoidsCents,
            netCashVarianceCents: $netCashVarianceCents,
            branchComparisons: $branchComparisons,
            hourlySales: $hourlySales,
            topProducts: $topProducts,
            totalWastageCents: $totalWastageCents,
        );
    }
}
