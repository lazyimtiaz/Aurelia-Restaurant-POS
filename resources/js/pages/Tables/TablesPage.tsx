import { useState } from 'react';
import { Head, router, usePage } from '@inertiajs/react';
import { Bell, Clock, CheckCircle2, ArrowRightLeft, Plus, Sparkles, Users, X } from 'lucide-react';
import { PosAppLayout } from '@/layouts/PosAppLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useBranchEcho } from '@/hooks/useBranchEcho';
import { formatCents } from '@/lib/money';
import { TableTransferDialog } from '@/modules/pos/TableTransferDialog';
import type { ActiveOrderData, DiningTableData, FloorZoneData, TableStateValue } from '@/types/pos';
import type { PosSharedProps } from '@/types/pos-app';

interface TablesPageProps {
    zones: FloorZoneData[];
    activeOrders: ActiveOrderData[];
}

const STATE_STYLES: Record<TableStateValue, { card: string; badge: 'success' | 'warning' | 'destructive' | 'secondary' | 'outline' }> = {
    available: { card: 'border-emerald-200 bg-white hover:border-emerald-400', badge: 'success' },
    occupied: { card: 'border-orange-300 bg-orange-50/70 hover:border-orange-500', badge: 'warning' },
    billing: { card: 'border-rose-300 bg-rose-50/70 hover:border-rose-500', badge: 'destructive' },
    reserved: { card: 'border-amber-300 bg-amber-50/70 hover:border-amber-500', badge: 'warning' },
    dirty: { card: 'border-stone-300 bg-stone-100/80 hover:border-stone-400', badge: 'secondary' },
};

function elapsedLabel(iso: string | null): string {
    if (!iso) {
        return '';
    }
    const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
    const hrs = Math.floor(mins / 60);
    const rem = mins % 60;
    return hrs > 0 ? `${hrs}h ${rem}m` : `${mins}m`;
}

export default function TablesPage({ zones, activeOrders }: TablesPageProps) {
    const { auth } = usePage<PosSharedProps>().props;
    const branchId = auth?.activeBranch.id ?? 0;

    const [selectedZoneId, setSelectedZoneId] = useState<number>(zones[0]?.id ?? 0);
    const [selectedTableId, setSelectedTableId] = useState<number | null>(null);
    const [transferOrderId, setTransferOrderId] = useState<number | null>(null);
    const [guestCount, setGuestCount] = useState(2);

    useBranchEcho(branchId, ['floor', 'pos'], () => {
        router.reload({ only: ['zones', 'activeOrders'] });
    });

    const activeZone = zones.find((z) => z.id === selectedZoneId) ?? zones[0];
    const allTables = zones.flatMap((z) => z.tables);
    const selectedTable: DiningTableData | null = allTables.find((t) => t.id === selectedTableId) ?? null;

    const handleOpenOrderOnTable = (table: DiningTableData) => {
        router.post(
            '/pos/orders',
            {
                service_type: 'dine_in',
                table_id: table.id,
                guest_count: Math.min(table.capacity, Math.max(1, guestCount)),
            },
            {
                onSuccess: () => {
                    router.visit('/pos');
                },
            },
        );
    };

    const handleUpdateState = (tableId: number, state: TableStateValue) => {
        router.post(`/tables/${tableId}/state`, { state }, { preserveScroll: true });
    };

    const handleServiceAlert = (tableId: number) => {
        router.post(
            `/tables/${tableId}/service-request`,
            { request_type: 'Server Check-In' },
            { preserveScroll: true },
        );
    };

    return (
        <PosAppLayout
            title="Dining Room Floor Plan"
            subtitle="Tap any table to seat guests, check running tabs, transfer orders, or mark cleared."
        >
            <Head title="Tables & Floor Plan — Aurelia POS" />

            <div className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-3.5 shadow-2xs">
                    <div className="flex flex-wrap items-center gap-2">
                        {zones.map((zone) => {
                            const active = activeZone?.id === zone.id;
                            const occupiedInZone = zone.tables.filter((t) => t.state !== 'available').length;
                            return (
                                <button
                                    key={zone.id}
                                    type="button"
                                    onClick={() => setSelectedZoneId(zone.id)}
                                    className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition cursor-pointer ${
                                        active
                                            ? 'bg-primary text-primary-foreground shadow-xs'
                                            : 'bg-muted text-stone-700 hover:bg-orange-50 hover:text-orange-700'
                                    }`}
                                >
                                    <span>{zone.name}</span>
                                    <span className="rounded-md bg-black/10 px-1.5 py-0.5 font-mono text-[10px]">
                                        {occupiedInZone}/{zone.tables.length}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Available
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                            <span className="h-2.5 w-2.5 rounded-full bg-orange-500" /> Occupied
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                            <span className="h-2.5 w-2.5 rounded-full bg-rose-500" /> Billing
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                            <span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Reserved
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                            <span className="h-2.5 w-2.5 rounded-full bg-stone-400" /> Needs Clearing
                        </span>
                    </div>
                </div>

                {activeZone && (
                    <div className="rounded-3xl border border-border bg-card/80 p-6 shadow-sm">
                        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-5">
                            {activeZone.tables.map((table) => {
                                const style = STATE_STYLES[table.state];
                                const isRound = table.capacity <= 2;
                                const isWide = table.capacity >= 6;
                                const elapsed = elapsedLabel(table.occupied_since);

                                return (
                                    <button
                                        key={table.id}
                                        type="button"
                                        onClick={() => setSelectedTableId(table.id)}
                                        className={`group relative flex flex-col items-center justify-center border-2 p-4 text-center transition-all cursor-pointer min-h-36 ${
                                            style.card
                                        } ${isRound ? 'rounded-full aspect-square mx-auto w-36' : isWide ? 'rounded-2xl sm:col-span-2' : 'rounded-2xl'}`}
                                    >
                                        <span className="text-lg font-bold tracking-tight text-foreground">
                                            {table.code}
                                        </span>

                                        <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                                            <Users className="h-3 w-3" />
                                            {table.current_guest_count > 0
                                                ? `${table.current_guest_count}/${table.capacity}`
                                                : `${table.capacity} seats`}
                                        </span>

                                        {table.active_order ? (
                                            <div className="mt-2 space-y-1">
                                                <div className="font-mono text-sm font-bold text-foreground">
                                                    {formatCents(table.active_order.total_cents)}
                                                </div>
                                                {elapsed && (
                                                    <div className="inline-flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
                                                        <Clock className="h-3 w-3" /> {elapsed}
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <Badge variant={style.badge} className="mt-2 text-[10px]">
                                                {table.state_label}
                                            </Badge>
                                        )}

                                        {(table.active_order?.ready_tickets_count ?? 0) > 0 && (
                                            <span className="absolute -top-2 -right-2 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white shadow">
                                                Food Ready
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {activeOrders.length > 0 && (
                    <div className="rounded-2xl border border-border bg-card p-4">
                        <h2 className="mb-3 text-sm font-bold">Open Floor Tabs ({activeOrders.length})</h2>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {activeOrders.map((order) => (
                                <div
                                    key={order.id}
                                    className="flex items-center justify-between rounded-xl border border-border bg-muted/30 px-3.5 py-2.5 text-sm"
                                >
                                    <div>
                                        <div className="font-semibold">
                                            {order.order_number} ·{' '}
                                            {order.table_code ? `Table ${order.table_code}` : 'Takeaway'}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            {order.server_name ?? 'Staff'} · {formatCents(order.total_cents)}
                                        </div>
                                    </div>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => router.visit(`/pos?order_id=${order.id}`)}
                                    >
                                        Open POS
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {selectedTable && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
                    <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4">
                        <div className="flex items-start justify-between">
                            <div>
                                <div className="flex items-center gap-2">
                                    <h3 className="text-lg font-bold">Table {selectedTable.code}</h3>
                                    <Badge variant={STATE_STYLES[selectedTable.state].badge}>
                                        {selectedTable.state_label}
                                    </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Capacity: {selectedTable.capacity} guests
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedTableId(null)}
                                className="rounded p-1 hover:bg-muted cursor-pointer"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        {selectedTable.active_order ? (
                            <div className="space-y-3">
                                <div className="rounded-xl border border-border bg-muted/40 p-3.5 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Active Tab</span>
                                        <span className="font-mono font-bold">
                                            {selectedTable.active_order.order_number}
                                        </span>
                                    </div>
                                    <div className="mt-1 flex justify-between">
                                        <span className="text-muted-foreground">Running Total</span>
                                        <span className="font-mono font-bold">
                                            {formatCents(selectedTable.active_order.total_cents)}
                                        </span>
                                    </div>
                                </div>

                                <div className="grid gap-2 sm:grid-cols-2">
                                    <Button
                                        type="button"
                                        onClick={() => router.visit(`/pos?order_id=${selectedTable.active_order!.id}`)}
                                    >
                                        Continue in POS
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => {
                                            setTransferOrderId(selectedTable.active_order!.id);
                                        }}
                                    >
                                        <ArrowRightLeft className="h-4 w-4" />
                                        Transfer Table
                                    </Button>
                                </div>

                                <Button
                                    type="button"
                                    variant="ghost"
                                    className="w-full"
                                    onClick={() => handleServiceAlert(selectedTable.id)}
                                >
                                    <Bell className="h-4 w-4 text-primary" />
                                    Send Server Check-In Alert
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {(selectedTable.state === 'available' || selectedTable.state === 'reserved') && (
                                    <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-3.5">
                                        <div className="flex items-center justify-between text-xs font-medium">
                                            <span>Party Size</span>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setGuestCount((g) => Math.max(1, g - 1))}
                                                    className="h-7 w-7 rounded-lg border border-border bg-card font-bold cursor-pointer"
                                                >
                                                    -
                                                </button>
                                                <span className="w-6 text-center font-mono font-bold">{guestCount}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => setGuestCount((g) => Math.min(selectedTable.capacity, g + 1))}
                                                    className="h-7 w-7 rounded-lg border border-border bg-card font-bold cursor-pointer"
                                                >
                                                    +
                                                </button>
                                            </div>
                                        </div>
                                        <Button
                                            type="button"
                                            className="w-full"
                                            onClick={() => handleOpenOrderOnTable(selectedTable)}
                                        >
                                            <Plus className="h-4 w-4" />
                                            Seat Party &amp; Open Order
                                        </Button>
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-2">
                                    {selectedTable.state !== 'available' && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => handleUpdateState(selectedTable.id, 'available')}
                                        >
                                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                            Mark Available
                                        </Button>
                                    )}
                                    {selectedTable.state === 'available' && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => handleUpdateState(selectedTable.id, 'reserved')}
                                        >
                                            <Sparkles className="h-4 w-4 text-amber-600" />
                                            Hold Reserved
                                        </Button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <TableTransferDialog
                open={transferOrderId !== null}
                zones={zones}
                currentTableId={selectedTable?.id ?? null}
                onClose={() => setTransferOrderId(null)}
                onConfirm={(targetTableId, markDirty) => {
                    if (!transferOrderId) {
                        return;
                    }
                    router.post(
                        `/tables/orders/${transferOrderId}/transfer`,
                        { target_table_id: targetTableId, mark_source_dirty: markDirty },
                        {
                            preserveScroll: true,
                            onSuccess: () => {
                                setTransferOrderId(null);
                                setSelectedTableId(null);
                            },
                        },
                    );
                }}
            />
        </PosAppLayout>
    );
}
