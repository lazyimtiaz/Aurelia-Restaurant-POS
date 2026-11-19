import { useState } from 'react';
import { router, usePage } from '@inertiajs/react';
import { AnimatePresence } from 'motion/react';
import { BellRing, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBranchEcho } from '@/hooks/useBranchEcho';
import { TicketCard } from '@/modules/kds/TicketCard';
import { useKdsAudioAlert } from '@/modules/kds/useKdsAudioAlert';
import type { PosSharedProps } from '@/types/pos-app';
import type { KdsTicketData } from '@/types/pos';

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
    const [stationFilter, setStationFilter] = useState<string | null>(initialStation);
    const { muted, setMuted, playChime } = useKdsAudioAlert();

    useBranchEcho(branchId, ['kds'], (eventName) => {
        if (eventName === 'OrderRoundFired') {
            playChime('ticket');
        }
        router.reload({ only: ['tickets'] });
    });

    const filteredTickets = tickets
        .map((ticket) => {
            if (!stationFilter) {
                return ticket;
            }
            const items = ticket.items.filter((i) => i.prep_station === stationFilter);
            return items.length > 0 ? { ...ticket, items } : null;
        })
        .filter((t): t is KdsTicketData => t !== null);

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
        <div className="space-y-4 rounded-2xl bg-zinc-950 p-4 text-zinc-100 border border-zinc-800">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-1.5">
                    <Button
                        size="sm"
                        variant={stationFilter === null ? 'default' : 'outline'}
                        className={stationFilter !== null ? 'border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800' : ''}
                        onClick={() => setStationFilter(null)}
                    >
                        All Stations / Expo ({tickets.length})
                    </Button>
                    {stations.map((st) => (
                        <Button
                            key={st.value}
                            size="sm"
                            variant={stationFilter === st.value ? 'default' : 'outline'}
                            className={stationFilter !== st.value ? 'border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800' : ''}
                            onClick={() => setStationFilter(st.value)}
                        >
                            {st.label}
                        </Button>
                    ))}
                </div>

                <Button
                    size="sm"
                    variant="outline"
                    className="border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
                    onClick={() => setMuted((prev) => !prev)}
                >
                    {muted ? <VolumeX className="h-3.5 w-3.5 text-rose-400" /> : <Volume2 className="h-3.5 w-3.5 text-emerald-400" />}
                    {muted ? 'Muted' : 'Chime On'}
                </Button>
            </div>

            {filteredTickets.length === 0 ? (
                <div className="flex min-h-[280px] flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800 text-center text-zinc-500">
                    <BellRing className="mb-2 h-8 w-8 opacity-40" />
                    <p className="text-sm font-medium text-zinc-300">Kitchen Queue Clear</p>
                    <p className="mt-1 text-xs">Fire a round from POS to watch live tickets arrive here.</p>
                </div>
            ) : (
                <div className={`grid gap-3 ${compact ? 'grid-cols-1 xl:grid-cols-2' : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'}`}>
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
