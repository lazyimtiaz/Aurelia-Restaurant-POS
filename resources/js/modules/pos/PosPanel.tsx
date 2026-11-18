import { useEffect, useState } from 'react';
import { router, usePage } from '@inertiajs/react';
import { Plus, ShoppingBag, UtensilsCrossed } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useBranchEcho } from '@/hooks/useBranchEcho';
import { formatCents } from '@/lib/money';
import { ManagerPinModal } from '@/modules/pos/ManagerPinModal';
import { ModifierSheet } from '@/modules/pos/ModifierSheet';
import { MultiRoundCart } from '@/modules/pos/MultiRoundCart';
import { ProductGrid } from '@/modules/pos/ProductGrid';
import { TableTransferDialog } from '@/modules/pos/TableTransferDialog';
import type { MenuCategoryData, MenuItemData, SharedPageProps } from '@/types/evaluator';
import type { ActiveOrderData, FloorZoneData, OrderItemData } from '@/types/pos';

interface PosPanelProps {
    catalog: MenuCategoryData[];
    zones: FloorZoneData[];
    activeOrders: ActiveOrderData[];
    initialOrderId?: number | null;
    compact?: boolean;
}

export function PosPanel({
    catalog,
    zones,
    activeOrders,
    initialOrderId = null,
    compact = false,
}: PosPanelProps) {
    const { evaluator, flash } = usePage<SharedPageProps>().props;
    const [selectedOrderId, setSelectedOrderId] = useState<number | null>(
        initialOrderId ?? flash?.activeOrderId ?? activeOrders[0]?.id ?? null,
    );
    const [modifierItem, setModifierItem] = useState<MenuItemData | null>(null);
    const [pinAction, setPinAction] = useState<
        | { type: 'void'; item: OrderItemData }
        | { type: 'discount'; orderId: number; discountBps: number }
        | null
    >(null);
    const [pinError, setPinError] = useState<string | null>(null);
    const [transferOpen, setTransferOpen] = useState(false);
    const [selectedTableId, setSelectedTableId] = useState<number>(
        () => zones.flatMap((z) => z.tables).find((t) => t.state === 'available')?.id ?? 0,
    );
    const [takeawayName, setTakeawayName] = useState('');

    useEffect(() => {
        if (flash?.activeOrderId) {
            setSelectedOrderId(flash.activeOrderId);
        } else if (selectedOrderId && !activeOrders.some((o) => o.id === selectedOrderId)) {
            setSelectedOrderId(activeOrders[0]?.id ?? null);
        } else if (!selectedOrderId && activeOrders[0]) {
            setSelectedOrderId(activeOrders[0].id);
        }
    }, [flash?.activeOrderId, activeOrders, selectedOrderId]);

    useBranchEcho(evaluator.activeBranch.id, ['pos'], () => {
        router.reload({ only: ['catalog', 'zones', 'activeOrders'] });
    });

    const selectedOrder = activeOrders.find((o) => o.id === selectedOrderId) ?? activeOrders[0] ?? null;
    const availableTables = zones.flatMap((z) => z.tables).filter((t) => t.state === 'available' || t.state === 'reserved');

    const handleOpenDineIn = () => {
        const targetId = selectedTableId || availableTables[0]?.id;
        if (!targetId) {
            return;
        }
        router.post(
            '/pos/orders',
            { service_type: 'dine_in', table_id: targetId, guest_count: 2 },
            { preserveScroll: true },
        );
    };

    const handleOpenTakeaway = () => {
        router.post(
            '/pos/orders',
            {
                service_type: 'takeaway',
                customer_name: takeawayName.trim() || `Guest #${activeOrders.length + 1}`,
            },
            {
                preserveScroll: true,
                onSuccess: () => setTakeawayName(''),
            },
        );
    };

    const handleAddItem = (payload: {
        menu_item_variant_id: number;
        quantity: number;
        modifier_option_ids: number[];
        seat_number: number | null;
        special_instructions: string;
    }) => {
        if (!selectedOrder) {
            return;
        }
        router.post(`/pos/orders/${selectedOrder.id}/items`, payload, {
            preserveScroll: true,
            onSuccess: () => setModifierItem(null),
        });
    };

    const handleApplyDiscount = (orderId: number, discountBps: number) => {
        if (discountBps > evaluator.activeBranch.discount_pin_threshold_bps) {
            setPinError(null);
            setPinAction({ type: 'discount', orderId, discountBps });
            return;
        }
        router.post(`/pos/orders/${orderId}/discount`, { discount_bps: discountBps }, { preserveScroll: true });
    };

    const handlePinSubmit = ({ pin, reason }: { pin: string; reason?: string }) => {
        if (!pinAction) {
            return;
        }

        if (pinAction.type === 'void') {
            router.post(
                `/pos/order-items/${pinAction.item.id}/void`,
                { manager_pin: pin, reason: reason ?? 'customer_changed_mind' },
                {
                    preserveScroll: true,
                    onSuccess: () => {
                        setPinAction(null);
                        setPinError(null);
                    },
                    onError: (errors) => setPinError(errors.manager_pin || 'Invalid Manager PIN'),
                },
            );
            return;
        }

        router.post(
            `/pos/orders/${pinAction.orderId}/discount`,
            { discount_bps: pinAction.discountBps, manager_pin: pin },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setPinAction(null);
                    setPinError(null);
                },
                onError: (errors) => setPinError(errors.manager_pin || 'Invalid Manager PIN'),
            },
        );
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card p-3">
                <div className="flex flex-wrap items-center gap-2">
                    <select
                        value={selectedTableId || availableTables[0]?.id || ''}
                        onChange={(e) => setSelectedTableId(Number(e.target.value))}
                        className="rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs"
                    >
                        {availableTables.length === 0 && <option value="">No free tables</option>}
                        {availableTables.map((t) => (
                            <option key={t.id} value={t.id}>
                                Table {t.code} ({t.capacity}p)
                            </option>
                        ))}
                    </select>
                    <Button size="sm" disabled={availableTables.length === 0} onClick={handleOpenDineIn}>
                        <UtensilsCrossed className="h-3.5 w-3.5" />
                        Open Dine-In
                    </Button>
                </div>

                <div className="flex items-center gap-2">
                    <input
                        type="text"
                        placeholder="Takeaway guest name..."
                        value={takeawayName}
                        onChange={(e) => setTakeawayName(e.target.value)}
                        className="w-36 rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs"
                    />
                    <Button size="sm" variant="secondary" onClick={handleOpenTakeaway}>
                        <ShoppingBag className="h-3.5 w-3.5" />
                        Takeaway
                    </Button>
                </div>
            </div>

            {activeOrders.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {activeOrders.map((order) => {
                        const active = selectedOrder?.id === order.id;

                        return (
                            <button
                                key={order.id}
                                type="button"
                                onClick={() => setSelectedOrderId(order.id)}
                                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
                                    active
                                        ? 'border-primary bg-primary text-primary-foreground'
                                        : 'border-border bg-card hover:bg-muted'
                                }`}
                            >
                                <span className="font-mono">{order.order_number}</span>
                                <span>{order.table_code ? `· ${order.table_code}` : `· ${order.customer_name || 'TO'}`}</span>
                                <Badge variant={active ? 'secondary' : 'outline'} className="text-[10px]">
                                    {formatCents(order.total_cents)}
                                </Badge>
                            </button>
                        );
                    })}
                </div>
            )}

            <div className={`grid gap-4 ${compact ? 'grid-cols-1 xl:grid-cols-12' : 'grid-cols-1 lg:grid-cols-12'}`}>
                <div className={compact ? 'xl:col-span-7' : 'lg:col-span-7'}>
                    <ProductGrid
                        catalog={catalog}
                        disabled={!selectedOrder}
                        onSelectItem={(item) => setModifierItem(item)}
                    />
                    {!selectedOrder && (
                        <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                            <Plus className="h-3.5 w-3.5" /> Open a table or takeaway tab above to unlock menu ordering.
                        </p>
                    )}
                </div>

                <div className={compact ? 'xl:col-span-5' : 'lg:col-span-5'}>
                    <MultiRoundCart
                        order={selectedOrder}
                        onFireRound={(orderId) =>
                            router.post(`/pos/orders/${orderId}/fire`, {}, { preserveScroll: true })
                        }
                        onRemoveDraftItem={(itemId) =>
                            router.delete(`/pos/order-items/${itemId}`, { preserveScroll: true })
                        }
                        onRequestVoidItem={(item) => {
                            setPinError(null);
                            setPinAction({ type: 'void', item });
                        }}
                        onApplyDiscount={handleApplyDiscount}
                        onOpenTransfer={() => setTransferOpen(true)}
                    />
                </div>
            </div>

            <ModifierSheet
                item={modifierItem}
                onClose={() => setModifierItem(null)}
                onAdd={handleAddItem}
            />

            <ManagerPinModal
                open={pinAction !== null}
                title={pinAction?.type === 'void' ? 'Manager PIN Required to Void' : 'Manager PIN Required for Discount'}
                description={
                    pinAction?.type === 'void'
                        ? `Voiding "${pinAction.item.item_name}" after kitchen fire requires supervisor approval.`
                        : 'Discounts above branch threshold require Manager PIN.'
                }
                requireVoidReason={pinAction?.type === 'void'}
                errorMessage={pinError}
                onClose={() => {
                    setPinAction(null);
                    setPinError(null);
                }}
                onSubmit={handlePinSubmit}
            />

            <TableTransferDialog
                open={transferOpen}
                zones={zones}
                currentTableId={selectedOrder?.table_id ?? null}
                onClose={() => setTransferOpen(false)}
                onConfirm={(targetTableId, markSourceDirty) => {
                    if (!selectedOrder) {
                        return;
                    }
                    router.post(
                        `/floor/orders/${selectedOrder.id}/transfer`,
                        { target_table_id: targetTableId, mark_source_dirty: markSourceDirty },
                        {
                            preserveScroll: true,
                            onSuccess: () => setTransferOpen(false),
                        },
                    );
                }}
            />
        </div>
    );
}
