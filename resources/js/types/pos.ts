import type { BillSplitData } from '@/types/billing';

export type TableStateValue = 'available' | 'reserved' | 'occupied' | 'billing' | 'dirty';

export interface TableActiveOrderSummary {
    id: number;
    order_number: string;
    state: string;
    total_cents: number;
    server_name: string | null;
    ready_tickets_count: number;
}

export interface DiningTableData {
    id: number;
    code: string;
    capacity: number;
    state: TableStateValue;
    state_label: string;
    current_guest_count: number;
    occupied_since: string | null;
    active_order: TableActiveOrderSummary | null;
}

export interface FloorZoneData {
    id: number;
    name: string;
    tables: DiningTableData[];
}

export interface OrderItemModifierData {
    id: number;
    name: string;
    price_delta_cents: number;
}

export interface OrderItemData {
    id: number;
    kitchen_ticket_id: number | null;
    menu_item_variant_id: number;
    item_name: string;
    variant_name: string;
    prep_station: 'grill' | 'cold_salad' | 'pastry' | 'bar';
    prep_state: 'draft' | 'queued' | 'in_prep' | 'ready' | 'served' | 'voided';
    quantity: number;
    unit_price_cents: number;
    modifiers_total_cents: number;
    line_total_cents: number;
    seat_number: number | null;
    special_instructions: string | null;
    void_reason: string | null;
    modifiers: OrderItemModifierData[];
}

export interface OrderTicketSummaryData {
    id: number;
    round_number: number;
    state: 'fired' | 'in_prep' | 'ready' | 'served';
    fired_at: string;
}

export interface ActiveOrderData {
    id: number;
    order_number: string;
    service_type: 'dine_in' | 'takeaway' | 'pickup';
    state: 'draft' | 'open' | 'billing' | 'partially_paid' | 'paid' | 'voided';
    table_id: number | null;
    table_code: string | null;
    guest_count: number;
    customer_name: string | null;
    server_name: string | null;
    subtotal_cents: number;
    discount_bps: number;
    discount_cents: number;
    service_charge_cents: number;
    tax_cents: number;
    total_cents: number;
    opened_at: string;
    closed_at?: string | null;
    kitchen_tickets: OrderTicketSummaryData[];
    items: OrderItemData[];
    bill_splits?: BillSplitData[];
}

export interface KdsTicketItemData {
    id: number;
    item_name: string;
    variant_name: string;
    prep_station: 'grill' | 'cold_salad' | 'pastry' | 'bar';
    prep_station_label: string;
    prep_state: 'draft' | 'queued' | 'in_prep' | 'ready' | 'served' | 'voided';
    quantity: number;
    seat_number: number | null;
    special_instructions: string | null;
    void_reason: string | null;
    modifiers: { id: number; name: string }[];
}

export interface KdsTicketData {
    id: number;
    order_id: number;
    order_number: string | null;
    service_type: string | null;
    table_code: string | null;
    customer_name: string | null;
    round_number: number;
    state: 'fired' | 'in_prep' | 'ready' | 'served';
    fired_at: string;
    ready_at: string | null;
    items: KdsTicketItemData[];
}
