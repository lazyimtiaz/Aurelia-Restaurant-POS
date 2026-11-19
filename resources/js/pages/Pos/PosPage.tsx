import { useEffect, useMemo, useState } from 'react';
import { router, usePage } from '@inertiajs/react';
import { Head } from '@inertiajs/react';
import {
    ArrowRightLeft,
    Ban,
    CheckCircle2,
    Flame,
    Percent,
    Plus,
    Receipt,
    Search,
    ShoppingBag,
    Trash2,
} from 'lucide-react';
import { PosAppLayout } from '@/layouts/PosAppLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useBranchEcho } from '@/hooks/useBranchEcho';
import { formatCents } from '@/lib/money';
import { UnifiedPaymentModal } from '@/modules/billing/UnifiedPaymentModal';
import { ThermalReceiptDialog } from '@/modules/billing/ThermalReceiptDialog';
import { DishThumbnail } from '@/modules/pos/DishThumbnail';
import { ManagerPinModal } from '@/modules/pos/ManagerPinModal';
import { ModifierSheet } from '@/modules/pos/ModifierSheet';
import { NewOrderModal } from '@/modules/pos/NewOrderModal';
import { TableTransferDialog } from '@/modules/pos/TableTransferDialog';
import type { VoidReasonValue } from '@/types/billing';
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

    const visibleItems = useMemo(() => {
        const needle = search.trim().toLowerCase();
        return catalog
            .filter((cat) => activeCategorySlug === 'all' || cat.slug === activeCategorySlug)
            .flatMap((cat) =>
                cat.items
                    .filter((item) => {
                        if (!needle) {
                            return true;
                        }
                        return (
                            item.name.toLowerCase().includes(needle) ||
                            item.variants.some((v) => v.sku.toLowerCase().includes(needle))
                        );
                    })
                    .map((item) => ({ ...item, categoryName: cat.name })),
            );
    }, [catalog, activeCategorySlug, search]);

    const handleQuickAddOrConfigure = (item: MenuItemData) => {
        if (!activeOrder || !canModifyItems) {
            return;
        }
        if (item.modifier_groups.length > 0 || item.variants.length > 1) {
            setModifierItem(item);
            return;
        }
        const variant = item.variants.find((v) => v.is_available);
        if (!variant) {
            return;
        }
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
    };

    const handleAddConfigured = (payload: {
        menu_item_variant_id: number;
        quantity: number;
        modifier_option_ids: number[];
        seat_number: number | null;
        special_instructions: string;
    }) => {
        if (!activeOrder) {
            return;
        }
        router.post(`/pos/orders/${activeOrder.id}/items`, payload, {
            preserveScroll: true,
            onSuccess: () => setModifierItem(null),
        });
    };

    const handleDiscountClick = (bps: number) => {
        if (!activeOrder) {
            return;
        }
        if (bps > pinThresholdBps) {
            setPinError(null);
            setPinModalState({ type: 'discount', discountBps: bps });
            return;
        }
        router.post(`/pos/orders/${activeOrder.id}/discount`, { discount_bps: bps }, { preserveScroll: true });
    };

    const handlePinConfirm = (pin: string, reason?: VoidReasonValue) => {
        if (!pinModalState || !activeOrder) {
            return;
        }
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
                    onError: (errors) => setPinError(errors.manager_pin || errors.item || 'Invalid PIN.'),
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
        if (!activeOrder) {
            return;
        }
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
            },
        );
    };

    const draftItems = activeOrder?.items.filter((i) => i.prep_state === 'draft') ?? [];
    const firedItems =
        activeOrder?.items.filter((i) => i.prep_state !== 'draft' && i.prep_state !== 'voided') ?? [];

    return (
        <PosAppLayout
            title="POS Register"
            subtitle="Tap menu items to add to the check, send rounds to kitchen stations, and settle payments."
        >
            <Head title="POS Register — Aurelia POS" />

            <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-3 shadow-2xs">
                    <div className="flex flex-1 items-center gap-2 overflow-x-auto">
                        {activeOrders.map((order) => {
                            const selected = activeOrder?.id === order.id;
                            return (
                                <button
                                    key={order.id}
                                    type="button"
                                    onClick={() => setSelectedOrderId(order.id)}
                                    className={`shrink-0 rounded-xl border px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                                        selected
                                            ? 'border-primary bg-orange-50 text-orange-700 ring-1 ring-primary/30'
                                            : 'border-border bg-background text-stone-700 hover:bg-muted'
                                    }`}
                                >
                                    <span>{order.order_number}</span>
                                    <span className="ml-1.5 text-muted-foreground">
                                        {order.table_code ? `T-${order.table_code}` : order.customer_name || 'TA'}
                                    </span>
                                    <span className="ml-1.5 font-mono font-bold">
                                        {formatCents(order.total_cents)}
                                    </span>
                                </button>
                            );
                        })}
                        {activeOrders.length === 0 && (
                            <span className="px-2 text-xs text-muted-foreground">
                                No active open orders — click + New Order to start.
                            </span>
                        )}
                    </div>

                    <Button
                        type="button"
                        onClick={() => setNewOrderOpen(true)}
                        className="shrink-0 rounded-xl font-semibold"
                    >
                        <Plus className="h-4 w-4" />
                        New Order
                    </Button>
                </div>

                <div className="grid gap-5 lg:grid-cols-12">
                    <div className="space-y-4 lg:col-span-8">
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-3.5">
                            <div className="flex flex-wrap gap-1.5">
                                <button
                                    type="button"
                                    onClick={() => setActiveCategorySlug('all')}
                                    className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                                        activeCategorySlug === 'all'
                                            ? 'bg-primary text-primary-foreground shadow-2xs'
                                            : 'bg-muted text-stone-700 hover:bg-orange-50'
                                    }`}
                                >
                                    All Menu
                                </button>
                                {catalog.map((category) => (
                                    <button
                                        key={category.id}
                                        type="button"
                                        onClick={() => setActiveCategorySlug(category.slug)}
                                        className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                                            activeCategorySlug === category.slug
                                                ? 'bg-primary text-primary-foreground shadow-2xs'
                                                : 'bg-muted text-stone-700 hover:bg-orange-50'
                                        }`}
                                    >
                                        {category.name} ({category.items.length})
                                    </button>
                                ))}
                            </div>

                            <div className="relative w-full sm:w-56">
                                <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                                <input
                                    type="search"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Search dish or SKU..."
                                    className="w-full rounded-xl border border-input bg-background py-1.5 pr-3 pl-8 text-xs focus:border-primary focus:outline-none"
                                />
                            </div>
                        </div>

                        <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
                            {visibleItems.map((item) => {
                                const availableVariants = item.variants.filter((v) => v.is_available);
                                const isSoldOut = availableVariants.length === 0;
                                const leadVariant = availableVariants[0] ?? item.variants[0];

                                return (
                                    <div
                                        key={item.id}
                                        className={`group flex flex-col justify-between rounded-2xl border border-border bg-card p-3.5 shadow-2xs transition ${
                                            isSoldOut ? 'opacity-65' : 'hover:border-orange-300 hover:shadow-md'
                                        }`}
                                    >
                                        <div>
                                            <div className="relative">
                                                <DishThumbnail
                                                    imagePath={item.image_path}
                                                    name={item.name}
                                                    station={item.prep_station}
                                                    className="h-32 w-full"
                                                />
                                                {isSoldOut && (
                                                    <Badge variant="destructive" className="absolute top-2 right-2">
                                                        Out of Stock
                                                    </Badge>
                                                )}
                                            </div>

                                            <div className="mt-3">
                                                <div className="flex items-start justify-between gap-2">
                                                    <h3 className="text-sm font-bold leading-snug">{item.name}</h3>
                                                    {leadVariant && (
                                                        <span className="shrink-0 font-mono text-sm font-bold text-primary">
                                                            {formatCents(leadVariant.effective_price_cents)}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                                                    {item.description}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="mt-3 flex items-center justify-between gap-2 pt-2 border-t border-border/60">
                                            <span className="text-[11px] font-medium text-muted-foreground">
                                                {item.variants.length > 1
                                                    ? `${item.variants.length} sizes`
                                                    : item.prep_station_label}
                                            </span>
                                            <Button
                                                type="button"
                                                size="sm"
                                                disabled={!activeOrder || !canModifyItems || isSoldOut}
                                                onClick={() => handleQuickAddOrConfigure(item)}
                                                className="rounded-xl"
                                            >
                                                <Plus className="h-3.5 w-3.5" />
                                                {item.modifier_groups.length > 0 || item.variants.length > 1
                                                    ? 'Customize'
                                                    : 'Add'}
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="lg:col-span-4">
                        <div className="sticky top-20 flex flex-col justify-between rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4">
                            {!activeOrder ? (
                                <div className="space-y-3 py-16 text-center">
                                    <ShoppingBag className="mx-auto h-10 w-10 text-muted-foreground/60" />
                                    <div className="text-base font-bold">No Active Order Selected</div>
                                    <p className="text-xs text-muted-foreground">
                                        Open a dine-in table or quick takeaway tab to start ringing items.
                                    </p>
                                    <Button type="button" onClick={() => setNewOrderOpen(true)}>
                                        <Plus className="h-4 w-4" />
                                        Create Order
                                    </Button>
                                </div>
                            ) : (
                                <>
                                    <div className="flex items-start justify-between border-b border-border pb-3">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h2 className="text-base font-bold">{activeOrder.order_number}</h2>
                                                <Badge variant="outline">{activeOrder.state}</Badge>
                                            </div>
                                            <p className="mt-0.5 text-xs text-muted-foreground">
                                                {activeOrder.table_code
                                                    ? `Table ${activeOrder.table_code} (${activeOrder.guest_count} guests)`
                                                    : activeOrder.customer_name || 'Takeaway Order'}
                                            </p>
                                        </div>
                                        {activeOrder.table_id && canModifyItems && (
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="outline"
                                                onClick={() => setTransferOpen(true)}
                                            >
                                                <ArrowRightLeft className="h-3.5 w-3.5" />
                                                Move
                                            </Button>
                                        )}
                                    </div>

                                    <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
                                        {draftItems.length > 0 && (
                                            <div className="space-y-2">
                                                <div className="text-[11px] font-bold uppercase text-orange-700">
                                                    Draft Cart ({draftItems.length})
                                                </div>
                                                {draftItems.map((item) => (
                                                    <div
                                                        key={item.id}
                                                        className="flex items-start justify-between gap-2 rounded-xl border border-orange-200 bg-orange-50/50 p-2.5 text-xs"
                                                    >
                                                        <div className="min-w-0">
                                                            <div className="font-semibold">
                                                                {item.quantity}× {item.item_name} ({item.variant_name})
                                                            </div>
                                                            {item.modifiers.length > 0 && (
                                                                <div className="text-[11px] text-muted-foreground">
                                                                    {item.modifiers.map((m) => m.name).join(', ')}
                                                                </div>
                                                            )}
                                                            {item.special_instructions && (
                                                                <div className="italic text-orange-800">
                                                                    “{item.special_instructions}”
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-mono font-bold">
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
                                                                    className="text-rose-600 hover:text-rose-700 cursor-pointer"
                                                                    aria-label="Remove item"
                                                                >
                                                                    <Trash2 className="h-3.5 w-3.5" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {firedItems.length > 0 && (
                                            <div className="space-y-2">
                                                <div className="text-[11px] font-bold uppercase text-muted-foreground">
                                                    Sent to Kitchen ({firedItems.length})
                                                </div>
                                                {firedItems.map((item) => (
                                                    <div
                                                        key={item.id}
                                                        className="flex items-start justify-between gap-2 rounded-xl border border-border bg-muted/30 p-2.5 text-xs"
                                                    >
                                                        <div className="min-w-0">
                                                            <div className="flex items-center gap-1.5 font-medium">
                                                                <span>
                                                                    {item.quantity}× {item.item_name}
                                                                </span>
                                                                <Badge variant="outline" className="text-[10px]">
                                                                    {item.prep_state}
                                                                </Badge>
                                                            </div>
                                                            {item.modifiers.length > 0 && (
                                                                <div className="text-[11px] text-muted-foreground">
                                                                    {item.modifiers.map((m) => m.name).join(', ')}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="flex flex-col items-end gap-1">
                                                            <span className="font-mono font-semibold">
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
                                                                    <Ban className="h-3 w-3" /> Void
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {canModifyItems && (
                                        <div className="space-y-1.5 border-t border-border pt-3">
                                            <div className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground uppercase">
                                                <Percent className="h-3 w-3" /> Discount
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
                                                        className={`rounded-lg border py-1.5 text-xs font-semibold cursor-pointer ${
                                                            activeOrder.discount_bps === opt.bps
                                                                ? 'border-primary bg-orange-50 text-orange-700'
                                                                : 'border-border bg-background hover:bg-muted'
                                                        }`}
                                                    >
                                                        {opt.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div className="space-y-1.5 border-t border-border pt-3 text-xs">
                                        <div className="flex justify-between text-muted-foreground">
                                            <span>Subtotal</span>
                                            <span className="font-mono">{formatCents(activeOrder.subtotal_cents)}</span>
                                        </div>
                                        {activeOrder.discount_cents > 0 && (
                                            <div className="flex justify-between text-emerald-700">
                                                <span>Discount</span>
                                                <span className="font-mono">
                                                    -{formatCents(activeOrder.discount_cents)}
                                                </span>
                                            </div>
                                        )}
                                        <div className="flex justify-between text-muted-foreground">
                                            <span>Service Charge</span>
                                            <span className="font-mono">
                                                {formatCents(activeOrder.service_charge_cents)}
                                            </span>
                                        </div>
                                        <div className="flex justify-between text-muted-foreground">
                                            <span>Tax</span>
                                            <span className="font-mono">{formatCents(activeOrder.tax_cents)}</span>
                                        </div>
                                        <div className="flex justify-between border-t border-border pt-2 text-base font-bold">
                                            <span>Total</span>
                                            <span className="font-mono">{formatCents(activeOrder.total_cents)}</span>
                                        </div>
                                    </div>

                                    <div className="space-y-2 pt-1">
                                        {draftItems.length > 0 && canModifyItems && (
                                            <Button
                                                type="button"
                                                variant="outline"
                                                className="w-full rounded-xl py-5 font-semibold border-orange-300 text-orange-700 hover:bg-orange-50"
                                                onClick={() =>
                                                    router.post(
                                                        `/pos/orders/${activeOrder.id}/fire`,
                                                        {},
                                                        { preserveScroll: true },
                                                    )
                                                }
                                            >
                                                <Flame className="h-4 w-4" />
                                                Send to Kitchen ({draftItems.length} draft)
                                            </Button>
                                        )}

                                        <Button
                                            type="button"
                                            disabled={draftItems.length > 0 || firedItems.length === 0}
                                            onClick={handleOpenCharge}
                                            className="w-full rounded-xl py-5 text-sm font-bold"
                                        >
                                            {activeOrder.state === 'billing' || activeOrder.state === 'partially_paid' ? (
                                                <>
                                                    <Receipt className="h-4 w-4" />
                                                    Settle Payment · {formatCents(activeOrder.total_cents)}
                                                </>
                                            ) : (
                                                <>
                                                    <CheckCircle2 className="h-4 w-4" />
                                                    Charge {formatCents(activeOrder.total_cents)}
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <NewOrderModal open={newOrderOpen} zones={zones} onClose={() => setNewOrderOpen(false)} />
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
                title={pinModalState?.type === 'void' ? 'Manager PIN — Void Sent Item' : 'Manager PIN — Discount Approval'}
                description={
                    pinModalState?.type === 'void'
                        ? `Authorize voiding "${pinModalState.item.item_name}".`
                        : 'Discount exceeds standard threshold and requires manager authorization.'
                }
                requireVoidReason={pinModalState?.type === 'void'}
                errorMessage={pinError}
                onClose={() => setPinModalState(null)}
                onConfirm={handlePinConfirm}
            />
        </PosAppLayout>
    );
}
