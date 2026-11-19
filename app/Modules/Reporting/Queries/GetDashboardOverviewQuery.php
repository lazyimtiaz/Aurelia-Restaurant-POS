<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Queries;

use App\Modules\Floor\Enums\TableState;
use App\Modules\Floor\Models\DiningTable;
use App\Modules\Kitchen\Enums\ItemPrepState;
use App\Modules\Menu\Models\BranchMenuOverride;
use App\Modules\Orders\Enums\OrderState;
use App\Modules\Orders\Enums\ServiceType;
use App\Modules\Orders\Models\Order;
use App\Modules\Orders\Models\OrderItem;
use App\Modules\Orders\Queries\GetActiveBranchOrdersQuery;

final class GetDashboardOverviewQuery
{
    public function __construct(
        private readonly GetExecutiveDashboardMetricsQuery $getMetrics,
        private readonly GetActiveBranchOrdersQuery $getActiveOrders,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function execute(int $branchId): array
    {
        $metrics = $this->getMetrics->execute(branchId: $branchId)->toArray();

        $dineInOrdersCount = Order::query()
            ->where('branch_id', $branchId)
            ->where('service_type', ServiceType::DineIn->value)
            ->where('state', '!=', OrderState::Voided->value)
            ->count();

        $takeawayOrdersCount = Order::query()
            ->where('branch_id', $branchId)
            ->where('service_type', ServiceType::Takeaway->value)
            ->where('state', '!=', OrderState::Voided->value)
            ->count();

        $categoryRows = OrderItem::query()
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->join('menu_item_variants', 'menu_item_variants.id', '=', 'order_items.menu_item_variant_id')
            ->join('menu_items', 'menu_items.id', '=', 'menu_item_variants.menu_item_id')
            ->join('menu_categories', 'menu_categories.id', '=', 'menu_items.menu_category_id')
            ->where('orders.branch_id', $branchId)
            ->where('orders.state', OrderState::Paid->value)
            ->where('order_items.prep_state', '!=', ItemPrepState::Voided->value)
            ->selectRaw('menu_categories.id as category_id, MAX(menu_categories.name) as category_name, SUM(order_items.line_total_cents) as revenue_cents')
            ->groupBy('menu_categories.id')
            ->orderByDesc('revenue_cents')
            ->get();

        $categoryRevenueTotal = max(0, (int) $categoryRows->sum('revenue_cents'));
        $salesByCategory = $categoryRows->map(static function ($row) use ($categoryRevenueTotal): array {
            $revenueCents = (int) $row->revenue_cents;

            return [
                'categoryId' => (int) $row->category_id,
                'categoryName' => (string) $row->category_name,
                'revenueCents' => $revenueCents,
                'shareBps' => $categoryRevenueTotal > 0 ? intdiv($revenueCents * 10000, $categoryRevenueTotal) : 0,
            ];
        })->values()->all();

        $tableCountsByState = DiningTable::query()
            ->where('branch_id', $branchId)
            ->selectRaw('state, COUNT(*) as cnt')
            ->groupBy('state')
            ->pluck('cnt', 'state');

        $tableStatusCounts = [
            'available' => (int) ($tableCountsByState[TableState::Available->value] ?? 0),
            'occupied' => (int) ($tableCountsByState[TableState::Occupied->value] ?? 0),
            'reserved' => (int) ($tableCountsByState[TableState::Reserved->value] ?? 0),
            'dirty' => (int) ($tableCountsByState[TableState::Dirty->value] ?? 0),
        ];
        $tableStatusCounts['total'] = array_sum($tableStatusCounts);

        $outOfStockItems = BranchMenuOverride::query()
            ->with(['variant.menuItem'])
            ->where('branch_id', $branchId)
            ->where('is_available', false)
            ->get()
            ->map(static fn (BranchMenuOverride $override): array => [
                'variant_id' => $override->menu_item_variant_id,
                'sku' => $override->variant?->sku ?? '',
                'item_name' => $override->variant?->menuItem?->name ?? 'Menu Item',
                'variant_name' => $override->variant?->name ?? '',
                'image_path' => $override->variant?->menuItem?->image_path,
                'reason' => $override->eighty_sixed_reason ?? 'Out of stock',
            ])
            ->values()
            ->all();

        $liveOrders = array_slice($this->getActiveOrders->execute($branchId), 0, 6);

        return [
            'metrics' => $metrics,
            'dineInOrdersCount' => $dineInOrdersCount,
            'takeawayOrdersCount' => $takeawayOrdersCount,
            'salesByCategory' => $salesByCategory,
            'tableStatusCounts' => $tableStatusCounts,
            'liveOrders' => $liveOrders,
            'outOfStockItems' => $outOfStockItems,
        ];
    }
}
