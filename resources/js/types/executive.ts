export interface BranchComparisonRowData {
    branchId: number;
    branchCode: string;
    branchName: string;
    revenueCents: number;
    ordersCount: number;
    averageOrderValueCents: number;
    cogsCents: number;
    cogsPercentBps: number;
    voidsCents: number;
    cashVarianceCents: number;
    wastageCents: number;
}

export interface HourlySalesPointData {
    hour: number;
    label: string;
    revenueCents: number;
    ordersCount: number;
}

export interface TopProductRowData {
    menuItemVariantId: number;
    itemName: string;
    variantName: string;
    quantitySold: number;
    revenueCents: number;
}

export interface ExecutiveDashboardMetricsData {
    totalRevenueCents: number;
    totalOrdersCount: number;
    averageOrderValueCents: number;
    totalCogsCents: number;
    cogsPercentBps: number;
    totalVoidsCents: number;
    netCashVarianceCents: number;
    totalWastageCents: number;
    branchComparisons: BranchComparisonRowData[];
    hourlySales: HourlySalesPointData[];
    topProducts: TopProductRowData[];
}

export interface AffectedVariantStockData {
    variant_id: number;
    sku: string;
    item_name: string;
    variant_name: string;
    quantity_required: number;
    is_available: boolean;
    eighty_sixed_reason: string | null;
}

export interface BranchStockRowData {
    id: number;
    branch_id: number;
    ingredient_id: number;
    code: string;
    name: string;
    unit: string;
    unit_label: string;
    unit_short: string;
    quantity_on_hand: number;
    auto_86_threshold: number;
    is_low_stock: boolean;
    unit_cost_cents: number;
    stock_value_cents: number;
    affected_variants: AffectedVariantStockData[];
}

export interface StockMovementRowData {
    id: number;
    ingredient_id: number;
    ingredient_code: string;
    ingredient_name: string;
    unit_short: string;
    movement_type: string;
    movement_label: string;
    reference_type: string;
    reference_id: string;
    quantity_delta: number;
    unit_cost_cents: number;
    total_cost_cents: number;
    actor_name: string;
    notes: string | null;
    created_at_iso: string | null;
}

export interface BranchInventoryLedgerData {
    stocks: BranchStockRowData[];
    recentMovements: StockMovementRowData[];
}

export interface AuditLogRowData {
    id: number;
    branch_id: number;
    branch_code: string;
    branch_name: string;
    event_type: string;
    auditable_type: string;
    auditable_id: string;
    actor_name: string;
    actor_role: string;
    approver_name: string | null;
    is_critical: boolean;
    payload: Record<string, unknown>;
    created_at_iso: string | null;
}

export interface ExecutiveFiltersData {
    branchId: number | null;
    inventoryBranchId: number;
    dateFrom: string | null;
    dateTo: string | null;
}
