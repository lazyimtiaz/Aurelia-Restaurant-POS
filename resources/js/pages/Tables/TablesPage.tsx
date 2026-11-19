import { useState } from 'react';
import { Head, router, usePage } from '@inertiajs/react';
import { motion } from 'motion/react';
import {
    ArrowRightLeft,
    Bell,
    CheckCircle2,
    Clock,
    Plus,
    Sparkles,
    Users,
} from 'lucide-react';
import { AnimatedTabs, MotionModal, StatusPill, type StatusPillTone } from '@/design-system';
import { Button } from '@/components/ui/button';
import { useBranchEcho } from '@/hooks/useBranchEcho';
import { formatCents } from '@/lib/money';
import { PosAppLayout } from '@/layouts/PosAppLayout';
import { TableTransferDialog } from '@/modules/pos/TableTransferDialog';
import { cn } from '@/lib/utils';
import type { ActiveOrderData, DiningTableData, FloorZoneData, TableStateValue } from '@/types/pos';
import type { PosSharedProps } from '@/types/pos-app';

interface TablesPageProps {
    zones: FloorZoneData[];
    activeOrders: ActiveOrderData[];
}

const STATE_STYLES: Record<
    TableStateValue,
    { card: string; chair: string; tone: StatusPillTone; pulse?: boolean }
> = {
    available: {
        card: 'border-emerald-500/35 bg-card hover:border-emerald-500 hover:shadow-bistro-card',
        chair: 'bg-emerald-500/20',
        tone: 'success',
    },
    occupied: {
        card: 'border-orange-400/70 bg-orange-50/75 hover:border-orange-500 shadow-bistro-card',
        chair: 'bg-orange-400/35',
        tone: 'brand',
        pulse: true,
    },
    billing: {
        card: 'border-rose-400/70 bg-rose-50/75 hover:border-rose-500 shadow-bistro-card',
        chair: 'bg-rose-400/35',
        tone: 'danger',
        pulse: true,
    },
    reserved: {
        card: 'border-amber-400/70 bg-amber-50/75 hover:border-amber-500 shadow-bistro-card',
        chair: 'bg-amber-400/35',
        tone: 'warning',
    },
    dirty: {
        card: 'border-stone-300 bg-stone-100/90 hover:border-stone-400',
        chair: 'bg-stone-300',
        tone: 'neutral',
    },
};

function elapsedLabel(iso: string | null): string {
    if (!iso) return '';
    const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
    const hrs = Math.floor(mins / 60);
    const rem = mins % 60;
    return hrs > 0 ? `${hrs}h ${rem}m` : `${mins}m`;
}

function SeatCapsules({ chairClass, capacity }: { chairClass: string; capacity: number }) {
    const isRound = capacity <= 2;
    const isWide = capacity >= 6;
    const topBottomCount = isWide ? 3 : 1;

    return (
        <>
            {/* Top perimeter chairs */}
            <div className="pointer-events-none absolute -top-2.5 left-1/2 flex -translate-x-1/2 gap-3">
                {Array.from({ length: topBottomCount }).map((_, idx) => (
                    <span
                        key={idx}
                        className={cn('h-2 w-6 rounded-full border border-border/60', chairClass)}
                    />
                ))}
            </div>
            {/* Bottom perimeter chairs */}
            <div className="pointer-events-none absolute -bottom-2.5 left-1/2 flex -translate-x-1/2 gap-3">
                {Array.from({ length: topBottomCount }).map((_, idx) => (
                    <span
                        key={idx}
                        className={cn('h-2 w-6 rounded-full border border-border/60', chairClass)}
                    />
                ))}
            </div>
            {/* Left & Right chairs for square/banquet tables */}
            {!isRound && (
                <>
                    <span
                        className={cn(
                            'pointer-events-none absolute top-1/2 -left-2.5 h-6 w-2 -translate-y-1/2 rounded-full border border-border/60',
                            chairClass,
                        )}
                    />
                    <span
                        className={cn(
                            'pointer-events-none absolute top-1/2 -right-2.5 h-6 w-2 -translate-y-1/2 rounded-full border border-border/60',
                            chairClass,
                        )}
                    />
                </>
            )}
        </>
    );
}

export default function TablesPage({ zones, activeOrders }: TablesPageProps) {
    const { auth } = usePage<PosSharedProps>().props;
    const branchId = auth?.activeBranch.id ?? 0;

    const [selectedZoneId, setSelectedZoneId] = useState<string>(
        zones[0] ? String(zones[0].id) : '',
    );
    const [selectedTableId, setSelectedTableId] = useState<number | null>(null);
    const [transferOrderId, setTransferOrderId] = useState<number | null>(null);
    const [guestCount, setGuestCount] = useState(2);

    useBranchEcho(branchId, ['floor', 'pos'], () => {
        router.reload({ only: ['zones', 'activeOrders'] });
    });

    const activeZone = zones.find((z) => String(z.id) === selectedZoneId) ?? zones[0];
    const allTables = zones.flatMap((z) => z.tables);
    const selectedTable: DiningTableData | null =
        allTables.find((t) => t.id === selectedTableId) ?? null;

    const zoneTabs = zones.map((zone) => ({
        id: String(zone.id),
        label: zone.name,
        count: zone.tables.filter((t) => t.state !== 'available').length,
    }));

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
            subtitle="Tap any table to seat parties, inspect tabs, transfer tables, or update clearing status."
        >
            <Head title="Tables & Floor Plan — Aurelia POS" />

            <div className="space-y-6">
                {/* Zone Tabs & Live Status Legend */}
                <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 shadow-bistro-card xl:flex-row xl:items-center xl:justify-between">
                    <AnimatedTabs
                        items={zoneTabs}
                        value={activeZone ? String(activeZone.id) : ''}
                        onChange={setSelectedZoneId}
                        layoutId="floor-zones"
                    />

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-medium text-muted-foreground">
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
                            <span className="h-2.5 w-2.5 rounded-full bg-stone-400" /> Clearing
                        </span>
                    </div>
                </div>

                {/* Architectural Floor Canvas */}
                {activeZone ? (
                    <div
                        className="rounded-3xl border border-border p-5 sm:p-8 shadow-bistro-card"
                        style={{
                            backgroundColor: 'var(--surface-inset)',
                            backgroundImage: 'radial-gradient(#D9D0C3 1px, transparent 1px)',
                            backgroundSize: '20px 20px',
                        }}
                    >
                        {activeZone.tables.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                <p className="ds-section-title">No tables configured in {activeZone.name}</p>
                                <p className="ds-caption mt-1">Select another dining zone above.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-7 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                                {activeZone.tables.map((table) => {
                                    const style = STATE_STYLES[table.state];
                                    const isRound = table.capacity <= 2;
                                    const isWide = table.capacity >= 6;
                                    const elapsed = elapsedLabel(table.occupied_since);

                                    return (
                                        <div
                                            key={table.id}
                                            className={cn(
                                                'flex items-center justify-center',
                                                isWide && 'sm:col-span-2',
                                            )}
                                        >
                                            <motion.button
                                                type="button"
                                                whileHover={{ y: -2 }}
                                                whileTap={{ scale: 0.97 }}
                                                onClick={() => {
                                                    setGuestCount(Math.min(2, table.capacity));
                                                    setSelectedTableId(table.id);
                                                }}
                                                className={cn(
                                                    'relative flex flex-col items-center justify-center border-2 p-4 text-center transition-colors cursor-pointer',
                                                    style.card,
                                                    isRound
                                                        ? 'h-40 w-40 rounded-full'
                                                        : isWide
                                                          ? 'min-h-40 w-full rounded-2xl'
                                                          : 'min-h-40 w-full max-w-[210px] rounded-2xl',
                                                )}
                                            >
                                                <SeatCapsules chairClass={style.chair} capacity={table.capacity} />

                                                <span className="ds-num-md text-foreground">{table.code}</span>

                                                <span className="mt-1 inline-flex items-center gap-1 ds-caption font-medium">
                                                    <Users className="h-3 w-3" />
                                                    <span>
                                                        {table.current_guest_count > 0
                                                            ? `${table.current_guest_count}/${table.capacity}`
                                                            : `${table.capacity} seats`}
                                                    </span>
                                                </span>

                                                {table.active_order ? (
                                                    <div className="mt-2.5 space-y-1">
                                                        <div className="ds-num-sm text-foreground">
                                                            {formatCents(table.active_order.total_cents)}
                                                        </div>
                                                        {elapsed && (
                                                            <div className="inline-flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
                                                                <Clock className="h-3 w-3" />
                                                                <span>{elapsed}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <StatusPill
                                                        tone={style.tone}
                                                        pulse={style.pulse}
                                                        label={table.state_label}
                                                        className="mt-2.5"
                                                    />
                                                )}

                                                {(table.active_order?.ready_tickets_count ?? 0) > 0 && (
                                                    <span className="absolute -top-2.5 -right-2 rounded-full bg-emerald-600 px-2.5 py-0.5 text-[10px] font-bold text-white shadow-sm ring-2 ring-white">
                                                        Food Ready
                                                    </span>
                                                )}
                                            </motion.button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                ) : null}

                {/* Active Open Floor Tabs Strip */}
                {activeOrders.length > 0 && (
                    <div className="rounded-2xl border border-border bg-card p-5 shadow-bistro-card">
                        <h2 className="ds-section-title mb-3.5">
                            Open Floor Tabs ({activeOrders.length})
                        </h2>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {activeOrders.map((order) => (
                                <div
                                    key={order.id}
                                    className="flex items-center justify-between gap-3 rounded-xl border border-border/80 bg-[var(--surface-inset)] px-4 py-3 text-sm"
                                >
                                    <div className="min-w-0">
                                        <div className="truncate font-semibold text-foreground">
                                            {order.order_number} ·{' '}
                                            {order.table_code ? `Table ${order.table_code}` : 'Takeaway'}
                                        </div>
                                        <div className="ds-caption truncate">
                                            {order.server_name ?? 'Staff'} ·{' '}
                                            <span className="font-mono font-semibold text-foreground">
                                                {formatCents(order.total_cents)}
                                            </span>
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

            {/* Table Inspection Modal */}
            <MotionModal
                open={selectedTable !== null}
                onClose={() => setSelectedTableId(null)}
                title={
                    selectedTable ? (
                        <span className="flex items-center gap-2.5">
                            <span>Table {selectedTable.code}</span>
                            <StatusPill
                                tone={STATE_STYLES[selectedTable.state].tone}
                                label={selectedTable.state_label}
                            />
                        </span>
                    ) : undefined
                }
                description={selectedTable ? `Capacity: ${selectedTable.capacity} guests` : undefined}
                maxWidth="md"
            >
                {selectedTable && (
                    <div className="p-5 sm:p-6">
                        {selectedTable.active_order ? (
                            <div className="space-y-4">
                                <div className="rounded-2xl border border-border bg-[var(--surface-inset)] p-4 space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Active Tab</span>
                                        <span className="font-mono font-bold text-foreground">
                                            {selectedTable.active_order.order_number}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Running Total</span>
                                        <span className="ds-num-sm text-foreground">
                                            {formatCents(selectedTable.active_order.total_cents)}
                                        </span>
                                    </div>
                                </div>

                                <div className="grid gap-2.5 sm:grid-cols-2">
                                    <Button
                                        type="button"
                                        size="lg"
                                        onClick={() =>
                                            router.visit(`/pos?order_id=${selectedTable.active_order!.id}`)
                                        }
                                    >
                                        Continue in POS
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="lg"
                                        onClick={() => {
                                            setTransferOrderId(selectedTable.active_order!.id);
                                        }}
                                    >
                                        <ArrowRightLeft className="h-4 w-4" />
                                        <span>Transfer Table</span>
                                    </Button>
                                </div>

                                <Button
                                    type="button"
                                    variant="ghost"
                                    className="w-full"
                                    onClick={() => handleServiceAlert(selectedTable.id)}
                                >
                                    <Bell className="h-4 w-4 text-primary" />
                                    <span>Send Server Check-In Alert</span>
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {(selectedTable.state === 'available' ||
                                    selectedTable.state === 'reserved') && (
                                    <div className="space-y-4 rounded-2xl border border-border bg-[var(--surface-inset)] p-4">
                                        <div className="flex items-center justify-between text-sm font-medium">
                                            <span className="ds-label">Party Size</span>
                                            <div className="flex items-center gap-2.5">
                                                <button
                                                    type="button"
                                                    onClick={() => setGuestCount((g) => Math.max(1, g - 1))}
                                                    className="flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-card font-bold hover:bg-secondary cursor-pointer"
                                                >
                                                    -
                                                </button>
                                                <span className="w-8 text-center ds-num-sm">{guestCount}</span>
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setGuestCount((g) =>
                                                            Math.min(selectedTable.capacity, g + 1),
                                                        )
                                                    }
                                                    className="flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-card font-bold hover:bg-secondary cursor-pointer"
                                                >
                                                    +
                                                </button>
                                            </div>
                                        </div>
                                        <Button
                                            type="button"
                                            size="lg"
                                            className="w-full"
                                            onClick={() => handleOpenOrderOnTable(selectedTable)}
                                        >
                                            <Plus className="h-4 w-4" />
                                            <span>Seat Party &amp; Open Order</span>
                                        </Button>
                                    </div>
                                )}

                                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                                    {selectedTable.state !== 'available' && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => handleUpdateState(selectedTable.id, 'available')}
                                        >
                                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                            <span>Mark Available</span>
                                        </Button>
                                    )}
                                    {selectedTable.state === 'available' && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => handleUpdateState(selectedTable.id, 'reserved')}
                                        >
                                            <Sparkles className="h-4 w-4 text-amber-600" />
                                            <span>Hold Reserved</span>
                                        </Button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </MotionModal>

            <TableTransferDialog
                open={transferOrderId !== null}
                zones={zones}
                currentTableId={selectedTable?.id ?? null}
                onClose={() => setTransferOrderId(null)}
                onConfirm={(targetTableId, markDirty) => {
                    if (!transferOrderId) return;
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
