import { useEffect, useMemo, useState } from 'react';
import { Head, router, usePage } from '@inertiajs/react';
import { AnimatePresence, motion } from 'motion/react';
import {
    ArrowRightLeft,
    Ban,
    CheckCircle2,
    Flame,
    Minus,
    Percent,
    Plus,
    Receipt,
    Search,
    ShoppingBag,
    Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AnimatedTabs, MotionDrawer, StatusPill, dispatchToast } from '@/design-system';
import { useBranchEcho } from '@/hooks/useBranchEcho';
import { PosAppLayout } from '@/layouts/PosAppLayout';
import { formatCents } from '@/lib/money';
import { cn } from '@/lib/utils';
import { ThermalReceiptDialog } from '@/modules/billing/ThermalReceiptDialog';
import { UnifiedPaymentModal } from '@/modules/billing/UnifiedPaymentModal';
import { DishThumbnail } from '@/modules/pos/DishThumbnail';
import { ManagerPinModal } from '@/modules/pos/ManagerPinModal';
import { ModifierSheet } from '@/modules/pos/ModifierSheet';
import { NewOrderModal } from '@/modules/pos/NewOrderModal';
import { TableTransferDialog } from '@/modules/pos/TableTransferDialog';
import type { ActiveOrderData, FloorZoneData, OrderItemData } from '@/types/pos';
import type { MenuCategoryData, MenuItemData, PosSharedProps } from '@/types/pos-app';

interface PosPageProps {
    catalog: MenuCategoryData[];
    zones: FloorZoneData[];
    activeOrders: ActiveOrderData[];
    initialOrderId?: number | null;
}

export default function PosPage({
    catalog,
    zones,
    activeOrders,
    initialOrderId = null,
}: PosPageProps) {
    const { auth, flash } = usePage<PosSharedProps>().props;
    const branchId = auth?.activeBranch.id ?? 0;
    const pinThresholdBps = auth?.activeBranch.discount_pin_threshold_bps ?? 1500;

    const [selectedOrderId, setSelectedOrderId] = useState<number | null>(
        initialOrderId ?? flash?.activeOrderId ?? activeOrders[0]?.id ?? null,
    );
    const [activeCategorySlug, setActiveCategorySlug] = useState<string>('all');
    const [search, setSearch] = useState('');

    const [newOrderOpen, setNewOrderOpen] = useState(false);
    const [pendingItem, setPendingItem] = useState<MenuItemData | null>(null);
    const [mobileCartOpen, setMobileCartOpen] = useState(false);
    const [modifierItem, setModifierItem] = useState<MenuItemData | null>(null);
    const [transferOpen, setTransferOpen] = useState(false);
    const [paymentOpen, setPaymentOpen] = useState(false);
    const [receiptSplitId, setReceiptSplitId] = useState<number | null>(null);
    const [pinModalState, setPinModalState] = useState<
        { type: 'void'; item: OrderItemData } | { type: 'discount'; discountBps: number } | null
    >(null);
    const [pinError, setPinError] = useState<string | null>(null);

    useEffect(() => {
        if (flash?.activeOrderId) {
            setSelectedOrderId(flash.activeOrderId);
            return;
        }
        if (activeOrders.length > 0 && !activeOrders.some((o) => o.id === selectedOrderId)) {
            setSelectedOrderId(activeOrders[0].id);
        }
    }, [flash?.activeOrderId, activeOrders]);

    useBranchEcho(branchId, ['pos'], () => {
        router.reload({ only: ['catalog', 'zones', 'activeOrders'] });
    });

    const activeOrder = activeOrders.find((o) => o.id === selectedOrderId) ?? activeOrders[0] ?? null;
    const canModifyItems =
        activeOrder !== null && (activeOrder.state === 'draft' || activeOrder.state === 'open');

    useEffect(() => {
        if (!pendingItem || !activeOrder || !canModifyItems) return;
        const itemToProcess = pendingItem;
        setPendingItem(null);

        if (itemToProcess.modifier_groups.length > 0 || itemToProcess.variants.length > 1) {
            setModifierItem(itemToProcess);
            return;
        }
        const variant = itemToProcess.variants.find((v) => v.is_available);
        if (!variant) return;
        router.post(
            `/pos/orders/${activeOrder.id}/items`,
            {
                menu_item_variant_id: variant.id,
                quantity: 1,
                modifier_option_ids: [],
                seat_number: 1,
                special_instructions: '',
            },
            { preserveScroll: true },
        );
    }, [activeOrder?.id, canModifyItems, pendingItem]);

    const categoryTabs = useMemo(
        () => [
            {
                id: 'all',
                label: 'All Menu',
                count: catalog.reduce((sum, c) => sum + c.items.length, 0),
            },
            ...catalog.map((cat) => ({
                id: cat.slug,
                label: cat.name,
                count: cat.items.length,
            })),
        ],
        [catalog],
    );

    const visibleItems = useMemo(() => {
        const needle = search.trim().toLowerCase();
        return catalog
            .filter((cat) => activeCategorySlug === 'all' || cat.slug === activeCategorySlug)
            .flatMap((cat) =>
                cat.items
                    .filter((item) => {
                        if (!needle) return true;
                        return (
                            item.name.toLowerCase().includes(needle) ||
                            item.variants.some((v) => v.sku.toLowerCase().includes(needle))
                        );
                    })
                    .map((item) => ({ ...item, categoryName: cat.name })),
            );
    }, [catalog, activeCategorySlug, search]);

    const handleQuickAddOrConfigure = (item: MenuItemData) => {
        if (!activeOrder) {
            setPendingItem(item);
            setNewOrderOpen(true);
            return;
        }
        if (!canModifyItems) return;
        if (item.modifier_groups.length > 0 || item.variants.length > 1) {
            setModifierItem(item);
            return;
        }
        const variant = item.variants.find((v) => v.is_available);
        if (!variant) return;
        router.post(
            `/pos/orders/${activeOrder.id}/items`,
            {
                menu_item_variant_id: variant.id,
                quantity: 1,
                modifier_option_ids: [],
                seat_number: 1,
                special_instructions: '',
            },
            {
                preserveScroll: true,
                onError: (errors) =>
                    dispatchToast('error', Object.values(errors)[0] || 'Could not add item to order.'),
            },
        );
    };

    const handleAddConfigured = (payload: {
        menu_item_variant_id: number;
        quantity: number;
        modifier_option_ids: number[];
        seat_number: number | null;
        special_instructions: string;
    }) => {
        if (!activeOrder) return;
        router.post(`/pos/orders/${activeOrder.id}/items`, payload, {
            preserveScroll: true,
            onSuccess: () => setModifierItem(null),
            onError: (errors) =>
                dispatchToast('error', Object.values(errors)[0] || 'Could not add configured item.'),
        });
    };

    const handleDiscountClick = (bps: number) => {
        if (!activeOrder) return;
        if (bps > pinThresholdBps) {
            setPinError(null);
            setPinModalState({ type: 'discount', discountBps: bps });
            return;
        }
        router.post(
            `/pos/orders/${activeOrder.id}/discount`,
            { discount_bps: bps },
            {
                preserveScroll: true,
                onError: (errors) =>
                    dispatchToast('error', Object.values(errors)[0] || 'Could not apply discount.'),
            },
        );
    };

    const handlePinConfirm = ({ pin, reason }: { pin: string; reason?: string }) => {
        if (!pinModalState || !activeOrder) return;
        setPinError(null);

        if (pinModalState.type === 'void') {
            router.post(
                `/pos/order-items/${pinModalState.item.id}/void`,
                {
                    manager_pin: pin,
                    reason: reason ?? 'customer_changed_mind',
                },
                {
                    preserveScroll: true,
                    onSuccess: () => setPinModalState(null),
                    onError: (errors) =>
                        setPinError(
                            errors.manager_pin || errors.reason || errors.item || 'Authorization failed.',
                        ),
                },
            );
            return;
        }

        router.post(
            `/pos/orders/${activeOrder.id}/discount`,
            {
                discount_bps: pinModalState.discountBps,
                manager_pin: pin,
            },
            {
                preserveScroll: true,
                onSuccess: () => setPinModalState(null),
                onError: (errors) => setPinError(errors.manager_pin || 'Invalid PIN.'),
            },
        );
    };

    const handleOpenCharge = () => {
        if (!activeOrder) return;
        setMobileCartOpen(false);
        if (activeOrder.state === 'billing' || activeOrder.state === 'partially_paid') {
            setPaymentOpen(true);
            return;
        }
        router.post(
            `/billing/orders/${activeOrder.id}/request-bill`,
            {},
            {
                preserveScroll: true,
                onSuccess: () => setPaymentOpen(true),
                onError: (errors) =>
                    dispatchToast('error', Object.values(errors)[0] || 'Could not request bill.'),
            },
        );
    };

    const handleCancelDraftOrder = () => {
        if (!activeOrder) return;
        setMobileCartOpen(false);
        router.delete(`/pos/orders/${activeOrder.id}`, {
            preserveScroll: true,
            onError: (errors) =>
                dispatchToast('error', Object.values(errors)[0] || 'Could not cancel draft tab.'),
        });
    };

    const draftItems = activeOrder?.items.filter((i) => i.prep_state === 'draft') ?? [];
    const firedItems =
        activeOrder?.items.filter((i) => i.prep_state !== 'draft' && i.prep_state !== 'voided') ?? [];
    const totalTicketItems =
        draftItems.reduce((s, i) => s + i.quantity, 0) +
        firedItems.reduce((s, i) => s + i.quantity, 0);

    const renderOrderDetail = () => {
        if (!activeOrder) {
            return (
                <div className="space-y-4 py-14 text-center px-4">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--surface-inset)] text-muted-foreground border border-border">
                        <ShoppingBag className="h-6 w-6" />
                    </div>
                    <div>
                        <div className="ds-section-title">No Active Order Selected</div>
                        <p className="ds-caption mt-1">
                            Open a seated dining room tab or counter takeaway order to start ringing items.
                        </p>
                    </div>
                    <Button type="button" onClick={() => setNewOrderOpen(true)}>
                        <Plus className="h-4 w-4" />
                        <span>Create Order</span>
                    </Button>
                </div>
            );
        }

        return (
            <div className="flex flex-col space-y-4">
                <div className="flex items-start justify-between gap-2 border-b border-border pb-3.5">
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <h2 className="ds-section-title font-mono">{activeOrder.order_number}</h2>
                            <StatusPill
                                tone={
                                    activeOrder.state === 'billing'
                                        ? 'warning'
                                        : activeOrder.state === 'partially_paid'
                                          ? 'danger'
                                          : 'brand'
                                }
                                label={activeOrder.state.replace('_', ' ')}
                            />
                        </div>
                        <p className="ds-caption mt-0.5 truncate">
                            {activeOrder.table_code
                                ? `Table ${activeOrder.table_code} (${activeOrder.guest_count} guests)`
                                : activeOrder.customer_name || 'Takeaway Order'}
                        </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                        {activeOrder.table_id && canModifyItems && (
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => setTransferOpen(true)}
                            >
                                <ArrowRightLeft className="h-3.5 w-3.5" />
                                <span>Move</span>
                            </Button>
                        )}
                        {activeOrder.state === 'draft' && firedItems.length === 0 && (
                            <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={handleCancelDraftOrder}
                                className="text-rose-600 hover:bg-rose-500/10 hover:text-rose-700"
                            >
                                Cancel Tab
                            </Button>
                        )}
                    </div>
                </div>

                <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
                    {draftItems.length === 0 && firedItems.length === 0 && (
                        <p className="py-6 text-center ds-caption">
                            Tap dishes from the menu to add items to this ticket.
                        </p>
                    )}

                    {draftItems.length > 0 && (
                        <div className="space-y-2">
                            <span className="ds-overline block text-primary">
                                Draft Cart ({draftItems.length})
                            </span>
                            <AnimatePresence initial={false}>
                                {draftItems.map((item) => (
                                    <motion.div
                                        key={item.id}
                                        layout
                                        initial={{ opacity: 0, y: 6 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, x: 16 }}
                                        transition={{ duration: 0.16 }}
                                        className="flex items-start justify-between gap-2 rounded-xl border border-primary/25 bg-accent/60 p-3 text-xs"
                                    >
                                        <div className="min-w-0">
                                            <div className="font-semibold text-foreground">
                                                {item.quantity}× {item.item_name} ({item.variant_name})
                                            </div>
                                            {item.modifiers.length > 0 && (
                                                <div className="mt-0.5 text-[11px] text-muted-foreground">
                                                    {item.modifiers.map((m) => m.name).join(', ')}
                                                </div>
                                            )}
                                            {item.special_instructions && (
                                                <div className="mt-0.5 italic text-primary">
                                                    “{item.special_instructions}”
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex shrink-0 flex-col items-end gap-1.5">
                                            <div className="flex items-center gap-2">
                                                <span className="ds-num-sm text-foreground">
                                                    {formatCents(item.line_total_cents)}
                                                </span>
                                                {canModifyItems && (
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            router.delete(`/pos/order-items/${item.id}`, {
                                                                preserveScroll: true,
                                                            })
                                                        }
                                                        className="flex h-7 w-7 items-center justify-center rounded-lg text-rose-600 hover:bg-rose-500/10 cursor-pointer"
                                                        aria-label="Remove item"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                            {canModifyItems && (
                                                <div className="inline-flex items-center gap-1 rounded-lg border border-border bg-card p-0.5">
                                                    <button
                                                        type="button"
                                                        aria-label={`Decrease quantity of ${item.item_name}`}
                                                        onClick={() =>
                                                            router.patch(
                                                                `/pos/order-items/${item.id}`,
                                                                { quantity: item.quantity - 1 },
                                                                { preserveScroll: true },
                                                            )
                                                        }
                                                        className="flex h-6 w-6 items-center justify-center rounded-md text-foreground hover:bg-secondary cursor-pointer"
                                                    >
                                                        <Minus className="h-3 w-3" />
                                                    </button>
                                                    <span className="min-w-5 text-center font-mono text-xs font-bold tabular-nums">
                                                        {item.quantity}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        aria-label={`Increase quantity of ${item.item_name}`}
                                                        onClick={() =>
                                                            router.patch(
                                                                `/pos/order-items/${item.id}`,
                                                                { quantity: item.quantity + 1 },
                                                                { preserveScroll: true },
                                                            )
                                                        }
                                                        className="flex h-6 w-6 items-center justify-center rounded-md text-foreground hover:bg-secondary cursor-pointer"
                                                    >
                                                        <Plus className="h-3 w-3" />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>
                    )}

                    {firedItems.length > 0 && (
                        <div className="space-y-2">
                            <span className="ds-overline block">
                                Sent to Kitchen ({firedItems.length})
                            </span>
                            <AnimatePresence initial={false}>
                                {firedItems.map((item) => (
                                    <motion.div
                                        key={item.id}
                                        layout
                                        initial={{ opacity: 0, y: 6 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="flex items-start justify-between gap-2 rounded-xl border border-border bg-[var(--surface-inset)] p-3 text-xs"
                                    >
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-1.5 font-medium text-foreground">
                                                <span>
                                                    {item.quantity}× {item.item_name}
                                                </span>
                                                <StatusPill
                                                    tone={
                                                        item.prep_state === 'ready' || item.prep_state === 'served'
                                                            ? 'success'
                                                            : item.prep_state === 'in_prep'
                                                              ? 'warning'
                                                              : 'neutral'
                                                    }
                                                    dot={false}
                                                    label={item.prep_state}
                                                />
                                            </div>
                                            {item.modifiers.length > 0 && (
                                                <div className="mt-0.5 text-[11px] text-muted-foreground">
                                                    {item.modifiers.map((m) => m.name).join(', ')}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex shrink-0 flex-col items-end gap-1">
                                            <span className="ds-num-sm text-foreground">
                                                {formatCents(item.line_total_cents)}
                                            </span>
                                            {canModifyItems && item.prep_state !== 'served' && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setPinError(null);
                                                        setPinModalState({ type: 'void', item });
                                                    }}
                                                    className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-rose-600 hover:underline cursor-pointer"
                                                >
                                                    <Ban className="h-3 w-3" />
                                                    <span>Void</span>
                                                </button>
                                            )}
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>
                    )}
                </div>

                {canModifyItems && (
                    <div className="space-y-2 border-t border-border pt-3">
                        <div className="ds-overline flex items-center gap-1">
                            <Percent className="h-3 w-3" />
                            <span>Discount</span>
                        </div>
                        <div className="grid grid-cols-3 gap-1.5">
                            {[
                                { label: 'None', bps: 0 },
                                { label: '10%', bps: 1000 },
                                { label: '20% (PIN)', bps: 2000 },
                            ].map((opt) => (
                                <button
                                    key={opt.bps}
                                    type="button"
                                    onClick={() => handleDiscountClick(opt.bps)}
                                    className={cn(
                                        'rounded-xl border py-2 text-xs font-semibold transition cursor-pointer',
                                        activeOrder.discount_bps === opt.bps
                                            ? 'border-primary bg-accent text-primary'
                                            : 'border-border bg-card hover:bg-[var(--surface-inset)]',
                                    )}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <div className="space-y-1.5 border-t border-dashed border-border pt-3 text-xs">
                    <div className="flex justify-between text-muted-foreground">
                        <span>Subtotal</span>
                        <span className="font-mono tabular-nums">
                            {formatCents(activeOrder.subtotal_cents)}
                        </span>
                    </div>
                    {activeOrder.discount_cents > 0 && (
                        <div className="flex justify-between text-emerald-700 font-medium">
                            <span>Discount</span>
                            <span className="font-mono tabular-nums">
                                -{formatCents(activeOrder.discount_cents)}
                            </span>
                        </div>
                    )}
                    <div className="flex justify-between text-muted-foreground">
                        <span>Service Charge</span>
                        <span className="font-mono tabular-nums">
                            {formatCents(activeOrder.service_charge_cents)}
                        </span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                        <span>Tax</span>
                        <span className="font-mono tabular-nums">{formatCents(activeOrder.tax_cents)}</span>
                    </div>
                    <div className="flex items-center justify-between border-t border-border pt-2.5 text-base font-bold text-foreground">
                        <span>Total</span>
                        <motion.span
                            key={activeOrder.total_cents}
                            initial={{ scale: 1.06 }}
                            animate={{ scale: 1 }}
                            transition={{ duration: 0.2 }}
                            className="ds-num-md text-foreground"
                        >
                            {formatCents(activeOrder.total_cents)}
                        </motion.span>
                    </div>
                </div>

                <div className="space-y-2.5 pt-1">
                    {activeOrder.state === 'billing' && (
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="w-full"
                            onClick={() =>
                                router.post(
                                    `/billing/orders/${activeOrder.id}/reopen`,
                                    {},
                                    {
                                        preserveScroll: true,
                                        onError: (errors) =>
                                            dispatchToast(
                                                'error',
                                                Object.values(errors)[0] || 'Could not reopen order.',
                                            ),
                                    },
                                )
                            }
                        >
                            Reopen Order to Add Items
                        </Button>
                    )}

                    {draftItems.length > 0 && canModifyItems && (
                        <Button
                            type="button"
                            variant="outline"
                            size="lg"
                            className="w-full border-primary/40 text-primary hover:bg-accent"
                            onClick={() =>
                                router.post(
                                    `/pos/orders/${activeOrder.id}/fire`,
                                    {},
                                    {
                                        preserveScroll: true,
                                        onError: (errors) =>
                                            dispatchToast(
                                                'error',
                                                Object.values(errors)[0] || 'Could not fire round to kitchen.',
                                            ),
                                    },
                                )
                            }
                        >
                            <Flame className="h-4 w-4" />
                            <span>Send to Kitchen ({draftItems.length} draft)</span>
                        </Button>
                    )}

                    <Button
                        type="button"
                        size="lg"
                        disabled={draftItems.length > 0 || firedItems.length === 0}
                        onClick={handleOpenCharge}
                        className="w-full"
                    >
                        {activeOrder.state === 'billing' || activeOrder.state === 'partially_paid' ? (
                            <>
                                <Receipt className="h-4 w-4" />
                                <span>Settle Payment · {formatCents(activeOrder.total_cents)}</span>
                            </>
                        ) : (
                            <>
                                <CheckCircle2 className="h-4 w-4" />
                                <span>Charge {formatCents(activeOrder.total_cents)}</span>
                            </>
                        )}
                    </Button>
                </div>
            </div>
        );
    };

    return (
        <PosAppLayout
            title="POS Register"
            subtitle="Ring items onto live table tabs, fire tickets to kitchen lines, and settle checks."
        >
            <Head title="POS Register — Aurelia POS" />

            <div className="space-y-5 pb-20 lg:pb-0">
                {/* Active Order Switcher Strip */}
                <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-3.5 shadow-bistro-card sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                        {activeOrders.map((order) => {
                            const selected = activeOrder?.id === order.id;
                            return (
                                <button
                                    key={order.id}
                                    type="button"
                                    onClick={() => setSelectedOrderId(order.id)}
                                    className={cn(
                                        'inline-flex max-w-full items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold transition cursor-pointer',
                                        selected
                                            ? 'border-primary bg-accent text-primary ring-1 ring-primary/25'
                                            : 'border-border bg-[var(--surface-inset)] text-stone-700 hover:bg-secondary/70',
                                    )}
                                >
                                    <span className="font-mono whitespace-nowrap">{order.order_number}</span>
                                    <span className="truncate text-muted-foreground">
                                        {order.table_code ? `T-${order.table_code}` : order.customer_name || 'TA'}
                                    </span>
                                    <span className="font-mono font-bold whitespace-nowrap text-foreground tabular-nums">
                                        {formatCents(order.total_cents)}
                                    </span>
                                </button>
                            );
                        })}
                        {activeOrders.length === 0 && (
                            <span className="px-2 ds-caption">
                                No active open orders — tap New Order to open a tab.
                            </span>
                        )}
                    </div>

                    <Button
                        type="button"
                        onClick={() => setNewOrderOpen(true)}
                        className="w-full shrink-0 sm:w-auto"
                    >
                        <Plus className="h-4 w-4" />
                        <span>New Order</span>
                    </Button>
                </div>

                {/* Main Split Workspace */}
                <div className="grid gap-6 lg:grid-cols-12 items-start">
                    {/* Left Menu Explorer */}
                    <div className="space-y-4 lg:col-span-7 xl:col-span-8 min-w-0">
                        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-3.5 shadow-bistro-card">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <span className="ds-overline px-1">Menu Categories</span>
                                <div className="relative w-full sm:w-64 shrink-0">
                                    <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                                    <input
                                        type="search"
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        placeholder="Search dish or SKU..."
                                        className="h-9 w-full rounded-xl border border-input bg-[var(--surface-inset)] pr-3 pl-9 text-xs focus:border-primary focus:bg-card focus:outline-none"
                                    />
                                </div>
                            </div>

                            <AnimatedTabs
                                items={categoryTabs}
                                value={activeCategorySlug}
                                onChange={setActiveCategorySlug}
                                layoutId="pos-menu-categories"
                                wrap
                            />
                        </div>

                        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
                            {visibleItems.map((item) => {
                                const availableVariants = item.variants.filter((v) => v.is_available);
                                const isSoldOut = availableVariants.length === 0;
                                const leadVariant = availableVariants[0] ?? item.variants[0];

                                return (
                                    <Card
                                        key={item.id}
                                        variant={isSoldOut ? 'default' : 'interactive'}
                                        className={cn(
                                            'group flex flex-col justify-between p-3.5',
                                            isSoldOut && 'opacity-65',
                                        )}
                                    >
                                        <div>
                                            <div className="relative">
                                                <DishThumbnail
                                                    imagePath={item.image_path}
                                                    name={item.name}
                                                    station={item.prep_station}
                                                    slug={item.slug}
                                                    className="aspect-[16/10] w-full"
                                                />
                                                {isSoldOut && (
                                                    <div className="absolute top-2.5 right-2.5">
                                                        <StatusPill tone="danger" dot={false} label="Out of Stock" />
                                                    </div>
                                                )}
                                            </div>

                                            <div className="mt-3.5">
                                                <div className="flex items-start justify-between gap-2">
                                                    <h3 className="ds-card-title leading-snug text-foreground">
                                                        {item.name}
                                                    </h3>
                                                    {leadVariant && (
                                                        <span className="ds-num-sm shrink-0 text-primary">
                                                            {formatCents(leadVariant.effective_price_cents)}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="ds-caption mt-1 line-clamp-2">{item.description}</p>
                                            </div>
                                        </div>

                                        <div className="mt-3.5 flex items-center justify-between gap-2 border-t border-border/60 pt-3">
                                            <span className="truncate text-[11px] font-medium text-muted-foreground">
                                                {item.variants.length > 1
                                                    ? `${item.variants.length} portions`
                                                    : item.prep_station_label}
                                            </span>
                                            <Button
                                                type="button"
                                                size="sm"
                                                disabled={isSoldOut || (activeOrder !== null && !canModifyItems)}
                                                onClick={() => handleQuickAddOrConfigure(item)}
                                            >
                                                <Plus className="h-3.5 w-3.5" />
                                                <span>
                                                    {item.modifier_groups.length > 0 || item.variants.length > 1
                                                        ? 'Customize'
                                                        : 'Add'}
                                                </span>
                                            </Button>
                                        </div>
                                    </Card>
                                );
                            })}
                        </div>
                    </div>

                    {/* Desktop Sticky Order Ticket Rail */}
                    <div className="hidden lg:block lg:col-span-5 xl:col-span-4">
                        <Card className="sticky top-20 p-5 shadow-bistro-card">
                            {renderOrderDetail()}
                        </Card>
                    </div>
                </div>
            </div>

            {/* Mobile & Portrait Tablet Compact Floating Action Button (<lg) */}
            <div className="fixed right-4 bottom-5 z-30 lg:hidden">
                {activeOrder ? (
                    <button
                        type="button"
                        onClick={() => setMobileCartOpen(true)}
                        className="relative inline-flex items-center gap-2 rounded-full bg-[#181512] px-4 py-3 text-sm font-semibold text-white shadow-bistro-floating ring-1 ring-white/10 transition hover:bg-stone-800 active:scale-[0.97] cursor-pointer"
                    >
                        <Receipt className="h-4 w-4 text-amber-400" />
                        <span>View Ticket</span>
                        {(totalTicketItems > 0 || activeOrders.length > 0) && (
                            <span className="absolute -top-2 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 font-mono text-[11px] font-bold text-white ring-2 ring-background shadow-sm tabular-nums">
                                {totalTicketItems > 0 ? totalTicketItems : activeOrders.length}
                            </span>
                        )}
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={() => setNewOrderOpen(true)}
                        className="relative inline-flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-bistro-floating transition hover:bg-[#c2410c] active:scale-[0.97] cursor-pointer"
                    >
                        <Plus className="h-4 w-4" />
                        <span>New Order</span>
                        {activeOrders.length > 0 && (
                            <span className="absolute -top-2 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#181512] px-1.5 font-mono text-[11px] font-bold text-amber-400 ring-2 ring-background shadow-sm tabular-nums">
                                {activeOrders.length}
                            </span>
                        )}
                    </button>
                )}
            </div>

            {/* Mobile & Tablet Order Cart Drawer */}
            <MotionDrawer
                open={mobileCartOpen}
                onClose={() => setMobileCartOpen(false)}
                side="bottom"
                title={activeOrder ? `Ticket ${activeOrder.order_number}` : 'Order Ticket'}
                description={
                    activeOrder?.table_code
                        ? `Table ${activeOrder.table_code} · ${activeOrder.guest_count} guests`
                        : activeOrder?.customer_name || 'Takeaway Order'
                }
            >
                <div className="p-5 pb-8">{renderOrderDetail()}</div>
            </MotionDrawer>

            <NewOrderModal
                open={newOrderOpen}
                zones={zones}
                description={
                    pendingItem
                        ? `Start a dine-in or takeaway tab to add ${pendingItem.name}.`
                        : undefined
                }
                onClose={() => {
                    setNewOrderOpen(false);
                    setPendingItem(null);
                }}
                onCreated={() => setNewOrderOpen(false)}
            />
            <ModifierSheet item={modifierItem} onClose={() => setModifierItem(null)} onAdd={handleAddConfigured} />

            {activeOrder && (
                <>
                    <TableTransferDialog
                        open={transferOpen}
                        zones={zones}
                        currentTableId={activeOrder.table_id}
                        onClose={() => setTransferOpen(false)}
                        onConfirm={(targetTableId, markDirty) => {
                            router.post(
                                `/tables/orders/${activeOrder.id}/transfer`,
                                { target_table_id: targetTableId, mark_source_dirty: markDirty },
                                { preserveScroll: true, onSuccess: () => setTransferOpen(false) },
                            );
                        }}
                    />

                    <UnifiedPaymentModal
                        open={paymentOpen}
                        order={activeOrder}
                        onClose={() => setPaymentOpen(false)}
                        onOpenReceipt={(splitId) => setReceiptSplitId(splitId)}
                    />
                </>
            )}

            <ThermalReceiptDialog billSplitId={receiptSplitId} onClose={() => setReceiptSplitId(null)} />

            <ManagerPinModal
                open={pinModalState !== null}
                title={
                    pinModalState?.type === 'void'
                        ? 'Manager PIN — Void Sent Item'
                        : 'Manager PIN — Discount Approval'
                }
                description={
                    pinModalState?.type === 'void'
                        ? `Authorize voiding "${pinModalState.item.item_name}".`
                        : 'Discount exceeds standard threshold and requires manager authorization.'
                }
                requireVoidReason={pinModalState?.type === 'void'}
                errorMessage={pinError}
                onClose={() => setPinModalState(null)}
                onSubmit={handlePinConfirm}
            />
        </PosAppLayout>
    );
}
