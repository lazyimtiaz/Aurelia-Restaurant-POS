import { useState } from 'react';
import { router, usePage } from '@inertiajs/react';
import { AnimatePresence } from 'motion/react';
import { BellRing, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AnimatedTabs } from '@/design-system';
import { useBranchEcho } from '@/hooks/useBranchEcho';
import { TicketCard } from '@/modules/kds/TicketCard';
import { useKdsAudioAlert } from '@/modules/kds/useKdsAudioAlert';
import type { KdsTicketData } from '@/types/pos';
import type { PosSharedProps } from '@/types/pos-app';

interface KdsPanelProps {
    tickets: KdsTicketData[];
    stations: { value: string; label: string }[];
    initialStation?: string | null;
    compact?: boolean;
}

export function KdsPanel({
    tickets,
    stations,
    initialStation = null,
    compact = false,
}: KdsPanelProps) {
    const { auth } = usePage<PosSharedProps>().props;
    const branchId = auth?.activeBranch.id ?? 0;
    const [stationFilter, setStationFilter] = useState<string>(initialStation ?? 'all');
    const { muted, setMuted, playChime } = useKdsAudioAlert();

    useBranchEcho(branchId, ['kds'], (eventName) => {
        if (eventName === 'OrderRoundFired') {
            playChime('ticket');
        }
        router.reload({ only: ['tickets'] });
    });

    const filteredTickets = tickets
        .map((ticket) => {
            if (stationFilter === 'all') return ticket;
            const items = ticket.items.filter((i) => i.prep_station === stationFilter);
            return items.length > 0 ? { ...ticket, items } : null;
        })
        .filter((t): t is KdsTicketData => t !== null);

    const stationTabs = [
        { id: 'all', label: 'All Stations / Expo', count: tickets.length },
        ...stations.map((st) => ({
            id: st.value,
            label: st.label,
            count: tickets.filter((t) => t.items.some((i) => i.prep_station === st.value)).length,
        })),
    ];

    const handleBumpItem = (itemId: number, targetState: 'in_prep' | 'ready') => {
        router.post(
            `/kitchen/items/${itemId}/bump`,
            { target_state: targetState },
            { preserveScroll: true },
        );
    };

    const handleServeTicket = (ticketId: number) => {
        router.post(`/kitchen/tickets/${ticketId}/serve`, {}, { preserveScroll: true });
    };

    return (
        <div className="space-y-5 rounded-3xl border border-[#282E3A] bg-[#161922] p-4 sm:p-5 text-slate-100 shadow-[0_12px_36px_rgba(0,0,0,0.45)]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <AnimatedTabs
                    layoutId="kds-station-tabs"
                    variant="dark"
                    wrap
                    value={stationFilter}
                    onChange={setStationFilter}
                    items={stationTabs}
                />

                <Button
                    size="sm"
                    variant="outline"
                    className="self-start sm:self-center border-slate-700 bg-[#1D212B] text-slate-200 hover:bg-slate-800 hover:text-white"
                    onClick={() => setMuted((prev) => !prev)}
                >
                    {muted ? (
                        <VolumeX className="h-3.5 w-3.5 text-rose-400" />
                    ) : (
                        <Volume2 className="h-3.5 w-3.5 text-emerald-400" />
                    )}
                    <span>{muted ? 'Muted' : 'Chime On'}</span>
                </Button>
            </div>

            {filteredTickets.length === 0 ? (
                <div className="flex min-h-[290px] flex-col items-center justify-center rounded-2xl border border-dashed border-[#282E3A] bg-[#0D0F14]/60 px-6 text-center">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#1D212B] text-orange-400 ring-1 ring-slate-700">
                        <BellRing className="h-5 w-5" />
                    </div>
                    <p className="text-sm font-semibold text-slate-200">Kitchen Queue Clear</p>
                    <p className="mt-1 max-w-sm text-xs text-slate-400">
                        Fire a round from POS Register to stream live course tickets onto station screens.
                    </p>
                </div>
            ) : (
                <div
                    className={`grid gap-4 ${
                        compact ? 'grid-cols-1 xl:grid-cols-2' : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
                    }`}
                >
                    <AnimatePresence>
                        {filteredTickets.map((ticket) => (
                            <TicketCard
                                key={ticket.id}
                                ticket={ticket}
                                onBumpItem={handleBumpItem}
                                onServeTicket={handleServeTicket}
                            />
                        ))}
                    </AnimatePresence>
                </div>
            )}
        </div>
    );
}
