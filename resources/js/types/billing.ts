export type SplitModeValue = 'unified' | 'item_seat' | 'equal';
export type BillSplitStateValue = 'pending' | 'paid' | 'failed';
export type TenderMethodValue = 'cash' | 'card' | 'qr';

export interface BillSplitItemData {
    order_item_id: number;
    share_numerator: number;
    share_denominator: number;
    allocated_subtotal_cents: number;
}

export interface PaymentTransactionData {
    id: number;
    tender_method: TenderMethodValue;
    state: 'captured' | 'failed' | 'refunded';
    amount_cents: number;
    tip_cents: number;
    tendered_cents: number;
    change_cents: number;
    failure_reason: string | null;
    gateway_reference: string | null;
    refundable_remaining_cents: number;
}

export interface BillSplitData {
    id: number;
    sequence_number: number;
    label: string;
    split_mode: SplitModeValue;
    state: BillSplitStateValue;
    subtotal_cents: number;
    discount_cents: number;
    service_charge_cents: number;
    tax_cents: number;
    tip_cents: number;
    total_cents: number;
    items: BillSplitItemData[];
    transactions: PaymentTransactionData[];
}

export interface ThermalReceiptPayload {
    billSplitId: number;
    branchName: string;
    branchCode: string;
    orderNumber: string;
    checkLabel: string;
    splitMode: string;
    tableCode: string | null;
    customerName: string | null;
    issuedAtIso: string;
    lineItems: {
        name: string;
        variant: string;
        quantity: number;
        share: string | null;
        amount_cents: number;
    }[];
    subtotalCents: number;
    discountCents: number;
    serviceChargeCents: number;
    taxCents: number;
    tipCents: number;
    totalCents: number;
    payments: {
        id: number;
        tender_method: string;
        state: string;
        amount_cents: number;
        tip_cents: number;
        tendered_cents: number;
        change_cents: number;
        reference: string | null;
        created_at: string | null;
    }[];
}

export interface ShiftSummaryRow {
    id: number;
    user_name: string | null;
    state: 'open' | 'closed' | 'variance_flagged';
    opening_cash_cents: number;
    expected_cash_cents: number | null;
    counted_cash_cents: number | null;
    variance_cents: number | null;
    opened_at: string | null;
    closed_at: string | null;
    resolution_note: string | null;
}
