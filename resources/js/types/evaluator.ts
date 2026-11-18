export type StaffRoleValue =
    | 'enterprise_system_admin'
    | 'restaurant_owner'
    | 'branch_manager'
    | 'cashier'
    | 'waiter'
    | 'chef'
    | 'kitchen_expediter'
    | 'inventory_manager';

export interface ActiveUserData {
    id: number;
    name: string;
    email: string;
    role: StaffRoleValue;
    role_label: string;
    branch_id: number | null;
    can_authorize_pin: boolean;
}

export interface BranchData {
    id: number;
    code: string;
    name: string;
    timezone: string;
    tax_rate_bps: number;
    service_charge_bps: number;
    discount_pin_threshold_bps: number;
    cash_variance_tolerance_cents: number;
    is_active?: boolean;
}

export interface RoleOptionData {
    value: StaffRoleValue;
    label: string;
    can_authorize_pin: boolean;
}

export interface ActiveShiftData {
    id: number;
    state: 'open' | 'closed' | 'variance_flagged';
    opening_cash_cents: number;
    expected_cash_cents: number;
    opened_at: string | null;
}

export interface SimulationFlagsData {
    simulateCardDecline: boolean;
    triggerLowStockAuto86: boolean;
}

export interface EvaluatorContextData {
    activeUser: ActiveUserData;
    activeBranch: BranchData;
    branches: BranchData[];
    roles: RoleOptionData[];
    activeShift: ActiveShiftData | null;
    simulations: SimulationFlagsData;
}

export interface SharedPageProps {
    [key: string]: unknown;
    evaluator: EvaluatorContextData;
    flash?: {
        success?: string | null;
        error?: string | null;
        activeOrderId?: number | null;
    };
}

export interface ModifierOptionData {
    id: number;
    name: string;
    price_delta_cents: number;
}

export interface ModifierGroupData {
    id: number;
    name: string;
    min_select: number;
    max_select: number;
    is_required: boolean;
    options: ModifierOptionData[];
}

export interface MenuVariantData {
    id: number;
    name: string;
    sku: string;
    base_price_cents: number;
    price_override_cents: number | null;
    effective_price_cents: number;
    is_available: boolean;
    eighty_sixed_reason: string | null;
}

export interface MenuItemData {
    id: number;
    name: string;
    slug: string;
    description: string | null;
    prep_station: 'grill' | 'cold_salad' | 'pastry' | 'bar';
    prep_station_label: string;
    allergen_tags: string[];
    variants: MenuVariantData[];
    modifier_groups: ModifierGroupData[];
}

export interface MenuCategoryData {
    id: number;
    name: string;
    slug: string;
    items: MenuItemData[];
}
