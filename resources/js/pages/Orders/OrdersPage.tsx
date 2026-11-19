import { useMemo, useState } from 'react';
import { Head, router, usePage } from '@inertiajs/react';
import { Receipt, RotateCcw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AnimatedTabs, MotionDrawer, StatusPill, type StatusPillTone } from '@/design-system';
import { useBranchEcho } from '@/hooks/useBranchEcho';
import { PosAppLayout } from '@/layouts/PosAppLayout';
import { formatCents } from '@/lib/money';
import { cn } from '@/lib/utils';
import { RefundModal } from '@/modules/billing/RefundModal';
import { ThermalReceiptDialog } from '@/modules/billing/ThermalReceiptDialog';
import { UnifiedPaymentModal } from '@/modules/billing/UnifiedPaymentModal';
import type { PaymentTransactionData } from '@/types/billing';
import type { ActiveOrderData } from '@/types/pos';
import type { PosSharedProps } from '@/types/pos-app';

interface OrdersPageProps {
    orders: ActiveOrderData[];
}

type OrderFilterTab = 'all' | 'in_progress' | 'ready' | 'completed';

function deriveOrderStage(order: ActiveOrderData): {
    label: string;
    category: Exclude<OrderFilterTab, 'all'>;
    tone: StatusPillTone;
    pulse?: boolean;
} {
    if (order.state === 'paid') {
        return { label: 'Completed', category: 'completed', tone: 'neutral' };
    }
    if (order.state === 'billing' || order.state === 'partially_paid') {
        return {
            label: order.state === 'partially_paid' ? 'Partially Paid' : 'Ready to Pay',
            category: 'ready',
            tone: 'warning',
            pulse: true,
        };
    }
    const activeItems = order.items.filter(
        (i) => i.prep_state !== 'voided' && i.prep_state !== 'draft',
    );
    const allReadyOrServed =
        activeItems.length > 0 &&
        activeItems.every((i) => i.prep_state === 'ready' || i.prep_state === 'served');
    if (allReadyOrServed) {
        return { label: 'Ready', category: 'ready', tone: 'success', pulse: true };
    }
    return { label: 'In Progress', category: 'in_progress', tone: 'brand', pulse: true };
}

export default function OrdersPage({ orders }: OrdersPageProps) {
    const { auth } = usePage<PosSharedProps>().props;
    const branchId = auth?.activeBranch.id ?? 0;

    const [activeTab, setActiveTab] = useState<OrderFilterTab>('all');
    const [search, setSearch] = useState('');
    const [detailOrderId, setDetailOrderId] = useState<number | null>(null);
    const [payOrderId, setPayOrderId] = useState<number | null>(null);
    const [receiptSplitId, setReceiptSplitId] = useState<number | null>(null);
    const [refundPayment, setRefundPayment] = useState<PaymentTransactionData | null>(null);

    useBranchEcho(branchId, ['pos', 'kds'], () => {
        router.reload({ only: ['orders'] });
    });

    const stageCounts = useMemo(() => {
        const counts = { all: orders.length, in_progress: 0, ready: 0, completed: 0 };
        orders.forEach((order) => {
            counts[deriveOrderStage(order).category] += 1;
        });
        return counts;
    }, [orders]);

    const filteredOrders = useMemo(() => {
        const needle = search.trim().toLowerCase();
        return orders.filter((order) => {
            const stage = deriveOrderStage(order);
            if (activeTab !== 'all' && stage.category !== activeTab) return false;
            if (!needle) return true;
            return (
                order.order_number.toLowerCase().includes(needle) ||
                (order.customer_name ?? '').toLowerCase().includes(needle) ||
                (order.table_code ?? '').toLowerCase().includes(needle)
            );
        });
    }, [orders, activeTab, search]);

    const detailOrder = orders.find((o) => o.id === detailOrderId) ?? null;
    const payOrder = orders.find((o) => o.id === payOrderId) ?? null;

    const openPayment = (order: ActiveOrderData) => {
        if (order.state === 'billing' || order.state === 'partially_paid') {
            setPayOrderId(order.id);
            return;
        }
        router.post(
            `/billing/orders/${order.id}/request-bill`,
            {},
            {
                preserveScroll: true,
                onSuccess: () => setPayOrderId(order.id),
            },
        );
    };

    return (
        <PosAppLayout
            title="Orders Board"
            subtitle="Inspect active tickets, settle split checks, reprint thermal receipts, and process refunds."
        >
            <Head title="Orders — Aurelia POS" />

            <div className="space-y-6">
                {/* Filter Tabs & Search */}
                <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-3.5 shadow-bistro-card lg:flex-row lg:items-center lg:justify-between">
                    <AnimatedTabs
                        layoutId="orders-filter-tabs"
                        value={activeTab}
                        onChange={setActiveTab}
                        items={[
                            { id: 'all', label: 'All', count: stageCounts.all },
                            { id: 'in_progress', label: 'In Progress', count: stageCounts.in_progress },
                            { id: 'ready', label: 'Ready / Billing', count: stageCounts.ready },
                            { id: 'completed', label: 'Completed', count: stageCounts.completed },
                        ]}
                    />

                    <div className="relative w-full lg:w-64 shrink-0">
                        <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                        <input
                            type="search"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search order #, table, or guest..."
                            className="h-10 w-full rounded-xl border border-input bg-[var(--surface-inset)] pr-3 pl-9 text-xs focus:border-primary focus:bg-card focus:outline-none"
                        />
                    </div>
                </div>

                {/* Orders Grid */}
                {filteredOrders.length === 0 ? (
                    <Card className="py-16 text-center text-sm text-muted-foreground">
                        No orders match this filter.
                    </Card>
                ) : (
                    <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
                        {filteredOrders.map((order) => {
                            const stage = deriveOrderStage(order);
                            const visibleItems = order.items.filter((i) => i.prep_state !== 'voided');
                            const previewItems = visibleItems.slice(0, 4);
                            const hasDraftItems = visibleItems.some((i) => i.prep_state === 'draft');

                            return (
                                <Card key={order.id} variant="interactive" className="flex flex-col justify-between p-4 sm:p-5 space-y-4">
                                    <div className="space-y-3.5">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex min-w-0 items-center gap-3">
                                                <div
                                                    className={cn(
                                                        'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-mono text-xs font-bold',
                                                        order.table_code
                                                            ? 'bg-emerald-700 text-white'
                                                            : 'bg-amber-400 text-stone-950',
                                                    )}
                                                >
                                                    {order.table_code ?? 'TA'}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="truncate ds-card-title">
                                                        {order.customer_name ||
                                                            (order.table_code
                                                                ? `Table ${order.table_code}`
                                                                : 'Takeaway Guest')}
                                                    </div>
                                                    <div className="truncate ds-caption font-mono">
                                                        {order.order_number} · {order.service_type.replace('_', ' ')}
                                                    </div>
                                                </div>
                                            </div>
                                            <StatusPill
                                                tone={stage.tone}
                                                pulse={stage.pulse}
                                                label={stage.label}
                                                className="shrink-0"
                                            />
                                        </div>

                                        <div className="space-y-1.5 border-t border-border/70 pt-3 text-xs">
                                            {previewItems.map((item) => (
                                                <div key={item.id} className="flex justify-between gap-2">
                                                    <span className="truncate text-foreground">
                                                        {item.quantity}× {item.item_name}
                                                    </span>
                                                    <span className="shrink-0 font-mono text-muted-foreground tabular-nums">
                                                        {formatCents(item.line_total_cents)}
                                                    </span>
                                                </div>
                                            ))}
                                            {visibleItems.length > 4 && (
                                                <div className="ds-caption font-medium">
                                                    +{visibleItems.length - 4} more items
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="space-y-3 border-t border-border pt-3.5">
                                        <div className="flex items-center justify-between">
                                            <span className="ds-label text-muted-foreground">Total</span>
                                            <span className="ds-num-sm text-foreground">
                                                {formatCents(order.total_cents)}
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2.5">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setDetailOrderId(order.id)}
                                            >
                                                See Details
                                            </Button>

                                            {order.state === 'paid' ? (
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="secondary"
                                                    disabled={!order.bill_splits?.[0]}
                                                    onClick={() => {
                                                        if (order.bill_splits?.[0]) {
                                                            setReceiptSplitId(order.bill_splits[0].id);
                                                        }
                                                    }}
                                                >
                                                    <Receipt className="h-3.5 w-3.5" />
                                                    <span>Receipt</span>
                                                </Button>
                                            ) : (
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    disabled={hasDraftItems || visibleItems.length === 0}
                                                    onClick={() => openPayment(order)}
                                                >
                                                    Pay Bills
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Order Inspection Drawer */}
            <MotionDrawer
                open={detailOrder !== null}
                onClose={() => setDetailOrderId(null)}
                side="right"
                title={detailOrder?.order_number}
                description={
                    detailOrder
                        ? detailOrder.table_code
                            ? `Table ${detailOrder.table_code}`
                            : detailOrder.customer_name || 'Takeaway'
                        : undefined
                }
            >
                {detailOrder && (
                    <div className="flex h-full flex-col justify-between p-5 sm:p-6 space-y-6">
                        <div className="space-y-5">
                            <div className="space-y-2 text-xs">
                                <span className="ds-overline block">Items</span>
                                {detailOrder.items.map((item) => (
                                    <div
                                        key={item.id}
                                        className="flex items-center justify-between gap-3 rounded-xl border border-border bg-[var(--surface-inset)] px-3.5 py-2.5"
                                    >
                                        <div className="min-w-0">
                                            <div className="truncate font-semibold text-foreground">
                                                {item.quantity}× {item.item_name} ({item.variant_name})
                                            </div>
                                            <div className="text-[11px] uppercase text-muted-foreground">
                                                {item.prep_state}
                                            </div>
                                        </div>
                                        <span className="ds-num-sm shrink-0 text-foreground">
                                            {formatCents(item.line_total_cents)}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            {(detailOrder.bill_splits?.length ?? 0) > 0 && (
                                <div className="space-y-2.5 text-xs">
                                    <span className="ds-overline block">Split Checks &amp; Transactions</span>
                                    {detailOrder.bill_splits!.map((split) => (
                                        <div
                                            key={split.id}
                                            className="rounded-2xl border border-border bg-card p-3.5 space-y-2.5"
                                        >
                                            <div className="flex items-center justify-between font-semibold">
                                                <span>{split.label}</span>
                                                <span className="ds-num-sm">{formatCents(split.total_cents)}</span>
                                            </div>
                                            {split.state === 'paid' && (
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="outline"
                                                    className="w-full"
                                                    onClick={() => setReceiptSplitId(split.id)}
                                                >
                                                    <Receipt className="h-3.5 w-3.5" />
                                                    <span>Thermal Receipt</span>
                                                </Button>
                                            )}
                                            {split.transactions
                                                .filter(
                                                    (tx) =>
                                                        tx.state === 'captured' &&
                                                        tx.refundable_remaining_cents > 0,
                                                )
                                                .map((tx) => (
                                                    <Button
                                                        key={tx.id}
                                                        type="button"
                                                        size="sm"
                                                        variant="ghost"
                                                        className="w-full text-rose-700 hover:bg-rose-500/10"
                                                        onClick={() => setRefundPayment(tx)}
                                                    >
                                                        <RotateCcw className="h-3.5 w-3.5" />
                                                        <span>
                                                            Refund {tx.tender_method.toUpperCase()} (
                                                            {formatCents(tx.refundable_remaining_cents)} avail)
                                                        </span>
                                                    </Button>
                                                ))}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="flex gap-2.5 border-t border-border pt-4">
                            {detailOrder.state !== 'paid' && (
                                <Button
                                    type="button"
                                    size="lg"
                                    className="flex-1"
                                    onClick={() => router.visit(`/pos?order_id=${detailOrder.id}`)}
                                >
                                    Open in POS
                                </Button>
                            )}
                            <Button
                                type="button"
                                variant="outline"
                                size="lg"
                                onClick={() => setDetailOrderId(null)}
                            >
                                Close
                            </Button>
                        </div>
                    </div>
                )}
            </MotionDrawer>

            <UnifiedPaymentModal
                open={payOrder !== null}
                order={payOrder}
                onClose={() => setPayOrderId(null)}
                onOpenReceipt={(splitId) => setReceiptSplitId(splitId)}
            />
            <ThermalReceiptDialog billSplitId={receiptSplitId} onClose={() => setReceiptSplitId(null)} />
            <RefundModal payment={refundPayment} onClose={() => setRefundPayment(null)} />
        </PosAppLayout>
    );
}
