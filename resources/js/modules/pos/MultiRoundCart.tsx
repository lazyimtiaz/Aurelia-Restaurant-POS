import { AnimatePresence, motion } from 'motion/react';
import { CreditCard, Flame, Percent, RotateCcw, ShieldAlert, Split, Trash2, Utensils } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatBps, formatCents } from '@/lib/money';
import type { ActiveOrderData, OrderItemData } from '@/types/pos';

interface MultiRoundCartProps {
    order: ActiveOrderData | null;
    onFireRound: (orderId: number) => void;
    onRemoveDraftItem: (itemId: number) => void;
    onRequestVoidItem: (item: OrderItemData) => void;
    onApplyDiscount: (orderId: number, discountBps: number) => void;
    onOpenTransfer: () => void;
    onRequestBill: (orderId: number) => void;
    onReopenOrder: (orderId: number) => void;
    onOpenSplitDrawer: () => void;
    onOpenPayModal: () => void;
}

export function MultiRoundCart({
    order,
    onFireRound,
    onRemoveDraftItem,
    onRequestVoidItem,
    onApplyDiscount,
    onOpenTransfer,
    onRequestBill,
    onReopenOrder,
    onOpenSplitDrawer,
    onOpenPayModal,
}: MultiRoundCartProps) {
    if (!order) {
        return (
            <div className="flex h-full min-h-[360px] flex-col items-center justify-center rounded-2xl border border-dashed border-border p-6 text-center text-muted-foreground">
                <Utensils className="mb-2 h-8 w-8 opacity-40" />
                <p className="text-sm font-medium">No active order selected</p>
                <p className="mt-1 text-xs">Open a Dine-In table tab or Takeaway order to begin adding rounds.</p>
            </div>
        );
    }

    const draftItems = order.items.filter((i) => i.prep_state === 'draft');
    const firedItems = order.items.filter((i) => i.prep_state !== 'draft');

    return (
        <div className="flex flex-col rounded-2xl border border-border bg-card shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold">{order.order_number}</span>
                        <Badge variant="outline">{order.state}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        {order.table_code ? `Table ${order.table_code} · ${order.guest_count} guests` : `Takeaway · ${order.customer_name || 'Guest'}`}
                    </p>
                </div>

                {order.table_id && (
                    <Button size="sm" variant="outline" onClick={onOpenTransfer}>
                        Transfer Table
                    </Button>
                )}
            </div>

            <div className="max-h-[360px] flex-1 space-y-4 overflow-y-auto p-4">
                {draftItems.length > 0 && (
                    <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs font-semibold text-amber-700 uppercase">
                            <span>Draft (Unfired)</span>
                            <span>{draftItems.length} item(s)</span>
                        </div>
                        <AnimatePresence initial={false}>
                            {draftItems.map((item) => (
                                <motion.div
                                    key={item.id}
                                    layout
                                    initial={{ opacity: 0, y: 6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, x: -12 }}
                                    className="flex items-start justify-between gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-2.5 text-sm"
                                >
                                    <div>
                                        <div className="font-medium">
                                            {item.quantity}× {item.item_name}{' '}
                                            <span className="text-xs text-muted-foreground">({item.variant_name})</span>
                                        </div>
                                        {item.modifiers.length > 0 && (
                                            <div className="text-xs text-muted-foreground">
                                                + {item.modifiers.map((m) => m.name).join(', ')}
                                            </div>
                                        )}
                                        {item.special_instructions && (
                                            <div className="text-xs text-amber-700">Note: {item.special_instructions}</div>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono text-xs font-semibold">
                                            {formatCents(item.line_total_cents)}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => onRemoveDraftItem(item.id)}
                                            className="rounded p-1 text-rose-600 hover:bg-rose-500/10 cursor-pointer"
                                            title="Remove draft item"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                )}

                {firedItems.length > 0 && (
                    <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase">
                            <span>Fired to Kitchen ({order.kitchen_tickets.length} round{order.kitchen_tickets.length === 1 ? '' : 's'})</span>
                        </div>
                        {firedItems.map((item) => {
                            const isVoided = item.prep_state === 'voided';

                            return (
                                <div
                                    key={item.id}
                                    className={`flex items-start justify-between gap-2 rounded-xl border p-2.5 text-sm ${
                                        isVoided ? 'border-rose-500/20 bg-rose-500/5 opacity-60' : 'border-border bg-background/60'
                                    }`}
                                >
                                    <div>
                                        <div className={isVoided ? 'line-through font-medium' : 'font-medium'}>
                                            {item.quantity}× {item.item_name}
                                        </div>
                                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                            <Badge
                                                variant={
                                                    isVoided
                                                        ? 'destructive'
                                                        : item.prep_state === 'ready' || item.prep_state === 'served'
                                                          ? 'success'
                                                          : 'secondary'
                                                }
                                            >
                                                {item.prep_state}
                                            </Badge>
                                            {item.seat_number && (
                                                <span className="text-[11px] text-muted-foreground">
                                                    Seat {item.seat_number}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`font-mono text-xs font-semibold ${isVoided ? 'line-through' : ''}`}>
                                            {formatCents(item.line_total_cents)}
                                        </span>
                                        {!isVoided && item.prep_state !== 'served' && (
                                            <button
                                                type="button"
                                                onClick={() => onRequestVoidItem(item)}
                                                className="rounded p-1 text-amber-600 hover:bg-amber-500/10 cursor-pointer"
                                                title="Manager PIN Void"
                                            >
                                                <ShieldAlert className="h-3.5 w-3.5" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <div className="space-y-3 border-t border-border p-4 text-sm">
                <div className="flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Percent className="h-3 w-3" /> Discount:
                    </span>
                    {[0, 1000, 2000].map((bps) => (
                        <Button
                            key={bps}
                            size="sm"
                            variant={order.discount_bps === bps ? 'default' : 'outline'}
                            onClick={() => onApplyDiscount(order.id, bps)}
                        >
                            {bps === 0 ? 'None' : `${formatBps(bps)}${bps > 1500 ? ' (PIN)' : ''}`}
                        </Button>
                    ))}
                </div>

                <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Subtotal</span>
                        <span className="font-mono">{formatCents(order.subtotal_cents)}</span>
                    </div>
                    {order.discount_cents > 0 && (
                        <div className="flex justify-between text-emerald-700">
                            <span>Discount ({formatBps(order.discount_bps)})</span>
                            <span className="font-mono">-{formatCents(order.discount_cents)}</span>
                        </div>
                    )}
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Service Charge</span>
                        <span className="font-mono">{formatCents(order.service_charge_cents)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Tax</span>
                        <span className="font-mono">{formatCents(order.tax_cents)}</span>
                    </div>
                    <div className="flex justify-between border-t border-border pt-1.5 text-base font-bold">
                        <span>Total</span>
                        <span className="font-mono">{formatCents(order.total_cents)}</span>
                    </div>
                </div>

                <div className="space-y-2">
                    <Button
                        type="button"
                        className="w-full"
                        disabled={draftItems.length === 0 || order.state === 'billing' || order.state === 'partially_paid'}
                        onClick={() => onFireRound(order.id)}
                    >
                        <Flame className="h-4 w-4" />
                        Fire Round ({draftItems.length} draft item{draftItems.length === 1 ? '' : 's'})
                    </Button>

                    {order.state === 'open' && draftItems.length === 0 && (
                        <Button
                            type="button"
                            variant="secondary"
                            className="w-full"
                            onClick={() => onRequestBill(order.id)}
                        >
                            <CreditCard className="h-4 w-4" />
                            Request Bill &amp; Checkout
                        </Button>
                    )}

                    {(order.state === 'billing' || order.state === 'partially_paid') && (
                        <div className="grid grid-cols-2 gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                disabled={order.state === 'partially_paid'}
                                onClick={onOpenSplitDrawer}
                            >
                                <Split className="h-3.5 w-3.5" />
                                Split Bill
                            </Button>
                            <Button type="button" onClick={onOpenPayModal}>
                                <CreditCard className="h-3.5 w-3.5" />
                                Collect Pay
                            </Button>
                            {order.state === 'billing' && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="col-span-2 text-xs"
                                    onClick={() => onReopenOrder(order.id)}
                                >
                                    <RotateCcw className="h-3 w-3" />
                                    Reopen Tab to Add Items
                                </Button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
