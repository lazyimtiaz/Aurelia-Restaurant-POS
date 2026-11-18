import { useState } from 'react';
import { Head, router, usePage } from '@inertiajs/react';
import { motion } from 'motion/react';
import { ArrowRightLeft, Bell, CheckCircle2, Sparkles, Users } from 'lucide-react';
import { AppShellLayout } from '@/layouts/AppShellLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useBranchEcho } from '@/hooks/useBranchEcho';
import { formatCents } from '@/lib/money';
import { TableTransferDialog } from '@/modules/pos/TableTransferDialog';
import type { SharedPageProps } from '@/types/evaluator';
import type { DiningTableData, FloorZoneData, TableStateValue } from '@/types/pos';

interface FloorWorkspaceProps {
    zones: FloorZoneData[];
}

const STATE_STYLES: Record<TableStateValue, string> = {
    available: 'border-emerald-500/35 bg-emerald-500/5',
    reserved: 'border-sky-500/35 bg-sky-500/5',
    occupied: 'border-amber-500/45 bg-amber-500/10',
    billing: 'border-purple-500/45 bg-purple-500/10',
    dirty: 'border-rose-500/35 bg-rose-500/5',
};

export default function FloorWorkspace({ zones }: FloorWorkspaceProps) {
    const { evaluator } = usePage<SharedPageProps>().props;
    const [activeZoneId, setActiveZoneId] = useState<number | 'all'>('all');
    const [transferTarget, setTransferTarget] = useState<DiningTableData | null>(null);
    const [serviceAlert, setServiceAlert] = useState<string | null>(null);

    useBranchEcho(evaluator.activeBranch.id, ['floor'], (eventName, payload) => {
        if (eventName === 'ServiceRequested') {
            setServiceAlert(`Table ${String(payload.tableCode ?? '')}: ${String(payload.requestType ?? 'Service requested')}`);
        }
        router.reload({ only: ['zones'] });
    });

    const filteredZones = zones.filter((z) => activeZoneId === 'all' || z.id === activeZoneId);

    const handleOpenTab = (tableId: number) => {
        router.post('/pos/orders', { service_type: 'dine_in', table_id: tableId, guest_count: 2 }, {
            onSuccess: () => router.visit('/pos'),
        });
    };

    const handleMarkClean = (tableId: number) => {
        router.post(`/floor/tables/${tableId}/state`, { state: 'available' }, { preserveScroll: true });
    };

    const handleRequestService = (tableId: number) => {
        router.post(`/floor/tables/${tableId}/service-request`, { request_type: 'Water & Bread Service' }, { preserveScroll: true });
    };

    return (
        <AppShellLayout>
            <Head title="Floor Map & Tables" />

            <div className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">
                            Floor Plan — {evaluator.activeBranch.name}
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            Real-time occupancy, guest counts, atomic table transfers, and ready-tray alerts.
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                        <Button
                            size="sm"
                            variant={activeZoneId === 'all' ? 'default' : 'outline'}
                            onClick={() => setActiveZoneId('all')}
                        >
                            All Zones
                        </Button>
                        {zones.map((zone) => (
                            <Button
                                key={zone.id}
                                size="sm"
                                variant={activeZoneId === zone.id ? 'default' : 'outline'}
                                onClick={() => setActiveZoneId(zone.id)}
                            >
                                {zone.name}
                            </Button>
                        ))}
                    </div>
                </div>

                {serviceAlert && (
                    <div className="flex items-center justify-between rounded-xl border border-amber-500/40 bg-amber-500/15 px-4 py-2.5 text-sm font-medium text-amber-800">
                        <span className="flex items-center gap-2">
                            <Bell className="h-4 w-4" />
                            {serviceAlert}
                        </span>
                        <button
                            type="button"
                            onClick={() => setServiceAlert(null)}
                            className="text-xs underline cursor-pointer"
                        >
                            Dismiss
                        </button>
                    </div>
                )}

                <div className="space-y-6">
                    {filteredZones.map((zone) => (
                        <section key={zone.id} className="space-y-3">
                            <h2 className="border-b border-border pb-1.5 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                                {zone.name}
                            </h2>

                            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
                                {zone.tables.map((table) => (
                                    <motion.div
                                        key={table.id}
                                        layout
                                        className={`flex flex-col justify-between rounded-2xl border p-4 shadow-xs ${STATE_STYLES[table.state]}`}
                                    >
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="font-mono text-lg font-bold">{table.code}</span>
                                                <Badge variant={table.state === 'available' ? 'success' : table.state === 'dirty' ? 'destructive' : 'warning'}>
                                                    {table.state_label}
                                                </Badge>
                                            </div>

                                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                <Users className="h-3.5 w-3.5" />
                                                <span>
                                                    {table.current_guest_count > 0
                                                        ? `${table.current_guest_count} / ${table.capacity} seated`
                                                        : `${table.capacity} seats`}
                                                </span>
                                            </div>

                                            {table.active_order && (
                                                <div className="rounded-lg bg-card/80 p-2 text-xs space-y-1 border border-border/60">
                                                    <div className="flex justify-between font-mono font-semibold">
                                                        <span>{table.active_order.order_number}</span>
                                                        <span>{formatCents(table.active_order.total_cents)}</span>
                                                    </div>
                                                    {table.active_order.ready_tickets_count > 0 && (
                                                        <Badge variant="success" className="w-full justify-center">
                                                            <Sparkles className="h-3 w-3" />
                                                            {table.active_order.ready_tickets_count} Tray Ready!
                                                        </Badge>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        <div className="mt-4 flex flex-col gap-1.5">
                                            {(table.state === 'available' || table.state === 'reserved') && (
                                                <Button size="sm" onClick={() => handleOpenTab(table.id)}>
                                                    Seat &amp; Open Tab
                                                </Button>
                                            )}

                                            {table.active_order && (
                                                <>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => router.visit(`/pos?order_id=${table.active_order?.id}`)}
                                                    >
                                                        Open in POS
                                                    </Button>
                                                    <div className="grid grid-cols-2 gap-1.5">
                                                        <Button
                                                            size="sm"
                                                            variant="secondary"
                                                            onClick={() => setTransferTarget(table)}
                                                        >
                                                            <ArrowRightLeft className="h-3 w-3" />
                                                            Move
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => handleRequestService(table.id)}
                                                        >
                                                            <Bell className="h-3 w-3" />
                                                            Alert
                                                        </Button>
                                                    </div>
                                                </>
                                            )}

                                            {table.state === 'dirty' && (
                                                <Button size="sm" variant="secondary" onClick={() => handleMarkClean(table.id)}>
                                                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                                    Mark Clean
                                                </Button>
                                            )}
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </section>
                    ))}
                </div>
            </div>

            <TableTransferDialog
                open={transferTarget !== null}
                zones={zones}
                currentTableId={transferTarget?.id ?? null}
                onClose={() => setTransferTarget(null)}
                onConfirm={(targetTableId, markSourceDirty) => {
                    if (!transferTarget?.active_order) {
                        return;
                    }
                    router.post(
                        `/floor/orders/${transferTarget.active_order.id}/transfer`,
                        { target_table_id: targetTableId, mark_source_dirty: markSourceDirty },
                        {
                            preserveScroll: true,
                            onSuccess: () => setTransferTarget(null),
                        },
                    );
                }}
            />
        </AppShellLayout>
    );
}
