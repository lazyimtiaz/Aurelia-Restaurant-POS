import { useMemo, useState } from 'react';
import { Head, router, usePage } from '@inertiajs/react';
import { Receipt, RotateCcw, Search, X } from 'lucide-react';
import { PosAppLayout } from '@/layouts/PosAppLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useBranchEcho } from '@/hooks/useBranchEcho';
import { formatCents } from '@/lib/money';
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

function deriveOrderStage(order: ActiveOrderData): { label: string; category: Exclude<OrderFilterTab, 'all'>; variant: 'success' | 'warning' | 'destructive' | 'outline' | 'secondary' } {
    if (order.state === 'paid') {
        return { label: 'Completed', category: 'completed', variant: 'outline' };
    }
    if (order.state === 'billing' || order.state === 'partially_paid') {
        return { label: order.state === 'partially_paid' ? 'Partially Paid' : 'Ready to Pay', category: 'ready', variant: 'warning' };
    }
    const activeItems = order.items.filter((i) => i.prep_state !== 'voided' && i.prep_state !== 'draft');
    const allReadyOrServed =
        activeItems.length > 0 && activeItems.every((i) => i.prep_state === 'ready' || i.prep_state === 'served');
    if (allReadyOrServed) {
        return { label: 'Ready', category: 'ready', variant: 'success' };
    }
    return { label: 'In Progress', category: 'in_progress', variant: 'secondary' };
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

    const filteredOrders = useMemo(() => {
        const needle = search.trim().toLowerCase();
        return orders.filter((order) => {
            const stage = deriveOrderStage(order);
            if (activeTab !== 'all' && stage.category !== activeTab) {
                return false;
            }
            if (!needle) {
                return true;
            }
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
            subtitle="Track open tabs, kitchen readiness, completed receipts, and split payments."
        >
            <Head title="Orders — Aurelia POS" />

            <div className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-3.5">
                    <div className="flex flex-wrap gap-2">
                        {(
                            [
                                ['all', 'All'],
                                ['in_progress', 'In Progress'],
                                ['ready', 'Ready / Billing'],
                                ['completed', 'Completed'],
                            ] as const
                        ).map(([tabKey, label]) => (
                            <button
                                key={tabKey}
                                type="button"
                                onClick={() => setActiveTab(tabKey)}
                                className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
                                    activeTab === tabKey
                                        ? 'bg-primary text-primary-foreground shadow-2xs'
                                        : 'bg-muted text-stone-700 hover:bg-orange-50'
                                }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    <div className="relative w-full sm:w-64">
                        <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                        <input
                            type="search"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search order #, table, or guest..."
                            className="w-full rounded-xl border border-input bg-background py-1.5 pr-3 pl-8 text-xs focus:border-primary focus:outline-none"
                        />
                    </div>
                </div>

                {filteredOrders.length === 0 ? (
                    <div className="rounded-2xl border border-border bg-card py-16 text-center text-sm text-muted-foreground">
                        No orders match this filter.
                    </div>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {filteredOrders.map((order) => {
                            const stage = deriveOrderStage(order);
                            const visibleItems = order.items.filter((i) => i.prep_state !== 'voided');
                            const previewItems = visibleItems.slice(0, 4);
                            const hasDraftItems = visibleItems.some((i) => i.prep_state === 'draft');

                            return (
                                <div
                                    key={order.id}
                                    className="flex flex-col justify-between rounded-2xl border border-border bg-card p-4 shadow-2xs space-y-4"
                                >
                                    <div className="space-y-3">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex items-center gap-3">
                                                <div
                                                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-bold text-xs ${
                                                        order.table_code
                                                            ? 'bg-emerald-700 text-white'
                                                            : 'bg-amber-400 text-stone-900'
                                                    }`}
                                                >
                                                    {order.table_code ?? 'TA'}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-sm">
                                                        {order.customer_name || (order.table_code ? `Table ${order.table_code}` : 'Takeaway Guest')}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {order.order_number} · {order.service_type.replace('_', ' ')}
                                                    </div>
                                                </div>
                                            </div>
                                            <Badge variant={stage.variant}>{stage.label}</Badge>
                                        </div>

                                        <div className="space-y-1.5 border-t border-border pt-2.5 text-xs">
                                            {previewItems.map((item) => (
                                                <div key={item.id} className="flex justify-between gap-2">
                                                    <span className="truncate">
                                                        {item.quantity}× {item.item_name}
                                                    </span>
                                                    <span className="font-mono text-muted-foreground">
                                                        {formatCents(item.line_total_cents)}
                                                    </span>
                                                </div>
                                            ))}
                                            {visibleItems.length > 4 && (
                                                <div className="text-[11px] font-medium text-muted-foreground">
                                                    +{visibleItems.length - 4} more items
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="space-y-3 border-t border-border pt-3">
                                        <div className="flex items-center justify-between text-sm font-bold">
                                            <span>Total</span>
                                            <span className="font-mono">{formatCents(order.total_cents)}</span>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                className="rounded-xl"
                                                onClick={() => setDetailOrderId(order.id)}
                                            >
                                                See Details
                                            </Button>

                                            {order.state === 'paid' ? (
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="secondary"
                                                    className="rounded-xl"
                                                    disabled={!order.bill_splits?.[0]}
                                                    onClick={() => {
                                                        if (order.bill_splits?.[0]) {
                                                            setReceiptSplitId(order.bill_splits[0].id);
                                                        }
                                                    }}
                                                >
                                                    <Receipt className="h-3.5 w-3.5" />
                                                    Receipt
                                                </Button>
                                            ) : (
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    className="rounded-xl"
                                                    disabled={hasDraftItems || visibleItems.length === 0}
                                                    onClick={() => openPayment(order)}
                                                >
                                                    Pay Bills
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {detailOrder && (
                <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs">
                    <div className="flex h-full w-full max-w-md flex-col justify-between border-l border-border bg-card p-6 shadow-2xl overflow-y-auto">
                        <div className="space-y-4">
                            <div className="flex items-start justify-between border-b border-border pb-3">
                                <div>
                                    <h3 className="text-lg font-bold">{detailOrder.order_number}</h3>
                                    <p className="text-xs text-muted-foreground">
                                        {detailOrder.table_code ? `Table ${detailOrder.table_code}` : detailOrder.customer_name || 'Takeaway'}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setDetailOrderId(null)}
                                    className="rounded p-1 hover:bg-muted cursor-pointer"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>

                            <div className="space-y-2 text-xs">
                                <div className="font-bold uppercase text-muted-foreground">Items</div>
                                {detailOrder.items.map((item) => (
                                    <div
                                        key={item.id}
                                        className="flex items-center justify-between rounded-xl border border-border bg-muted/30 px-3 py-2"
                                    >
                                        <div>
                                            <div className="font-medium">
                                                {item.quantity}× {item.item_name} ({item.variant_name})
                                            </div>
                                            <div className="text-[11px] text-muted-foreground uppercase">
                                                {item.prep_state}
                                            </div>
                                        </div>
                                        <span className="font-mono font-bold">
                                            {formatCents(item.line_total_cents)}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            {(detailOrder.bill_splits?.length ?? 0) > 0 && (
                                <div className="space-y-2 text-xs">
                                    <div className="font-bold uppercase text-muted-foreground">
                                        Split Checks &amp; Transactions
                                    </div>
                                    {detailOrder.bill_splits!.map((split) => (
                                        <div key={split.id} className="rounded-xl border border-border p-3 space-y-2">
                                            <div className="flex items-center justify-between font-semibold">
                                                <span>{split.label}</span>
                                                <span className="font-mono">{formatCents(split.total_cents)}</span>
                                            </div>
                                            {split.state === 'paid' && (
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="outline"
                                                    className="w-full"
                                                    onClick={() => setReceiptSplitId(split.id)}
                                                >
                                                    <Receipt className="h-3.5 w-3.5" /> Thermal Receipt
                                                </Button>
                                            )}
                                            {split.transactions
                                                .filter((tx) => tx.state === 'captured' && tx.refundable_remaining_cents > 0)
                                                .map((tx) => (
                                                    <Button
                                                        key={tx.id}
                                                        type="button"
                                                        size="sm"
                                                        variant="ghost"
                                                        className="w-full text-rose-700 hover:bg-rose-50"
                                                        onClick={() => setRefundPayment(tx)}
                                                    >
                                                        <RotateCcw className="h-3.5 w-3.5" />
                                                        Refund {tx.tender_method.toUpperCase()} ({formatCents(tx.refundable_remaining_cents)} avail)
                                                    </Button>
                                                ))}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="flex gap-2 border-t border-border pt-4">
                            {detailOrder.state !== 'paid' && (
                                <Button
                                    type="button"
                                    className="flex-1"
                                    onClick={() => router.visit(`/pos?order_id=${detailOrder.id}`)}
                                >
                                    Open in POS
                                </Button>
                            )}
                            <Button type="button" variant="outline" onClick={() => setDetailOrderId(null)}>
                                Close
                            </Button>
                        </div>
                    </div>
                </div>
            )}

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
