import { motion } from 'motion/react';
import { CheckCheck, ChefHat, Flame, Utensils } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SlaTimerBadge } from '@/modules/kds/SlaTimerBadge';
import type { KdsTicketData, KdsTicketItemData } from '@/types/pos';

interface TicketCardProps {
    ticket: KdsTicketData;
    onBumpItem: (itemId: number, nextState: 'in_prep' | 'ready') => void;
    onServeTicket: (ticketId: number) => void;
}

export function TicketCard({ ticket, onBumpItem, onServeTicket }: TicketCardProps) {
    const isReadyForExpo = ticket.state === 'ready';

    const renderItemAction = (item: KdsTicketItemData) => {
        if (item.prep_state === 'voided') {
            return <Badge variant="destructive">Voided</Badge>;
        }
        if (item.prep_state === 'queued') {
            return (
                <Button
                    size="sm"
                    variant="secondary"
                    className="h-8 text-xs"
                    onClick={() => onBumpItem(item.id, 'in_prep')}
                >
                    <Flame className="h-3.5 w-3.5 text-amber-500" />
                    Start Prep
                </Button>
            );
        }
        if (item.prep_state === 'in_prep') {
            return (
                <Button
                    size="sm"
                    className="h-8 bg-emerald-600 text-white hover:bg-emerald-500 text-xs"
                    onClick={() => onBumpItem(item.id, 'ready')}
                >
                    <CheckCheck className="h-3.5 w-3.5" />
                    Mark Ready
                </Button>
            );
        }
        return <Badge variant="success">{item.prep_state === 'ready' ? 'Ready' : 'Served'}</Badge>;
    };

    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94 }}
            className={`flex flex-col justify-between rounded-2xl border bg-zinc-900 text-zinc-100 shadow-lg ${
                isReadyForExpo ? 'border-emerald-500/70 ring-1 ring-emerald-500/30' : 'border-zinc-700/80'
            }`}
        >
            <div>
                <div className="flex items-center justify-between gap-2 border-b border-zinc-800 px-4 py-3">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-bold text-amber-400">
                                {ticket.order_number || `#${ticket.order_id}`}
                            </span>
                            <Badge variant="outline" className="border-zinc-700 text-zinc-200">
                                Round {ticket.round_number}
                            </Badge>
                        </div>
                        <p className="mt-0.5 text-xs text-zinc-400">
                            {ticket.table_code ? `Table ${ticket.table_code}` : `Takeaway · ${ticket.customer_name || 'Guest'}`}
                        </p>
                    </div>

                    <SlaTimerBadge firedAt={ticket.fired_at} />
                </div>

                <div className="divide-y divide-zinc-800/80 px-4 py-2">
                    {ticket.items.map((item) => {
                        const voided = item.prep_state === 'voided';

                        return (
                            <div key={item.id} className="flex items-start justify-between gap-3 py-2.5">
                                <div className={voided ? 'opacity-50' : ''}>
                                    <div className={`text-sm font-semibold ${voided ? 'line-through text-rose-400' : ''}`}>
                                        {item.quantity}× {item.item_name}{' '}
                                        <span className="text-xs font-normal text-zinc-400">({item.variant_name})</span>
                                    </div>
                                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-400">
                                        <span className="inline-flex items-center gap-1 text-sky-400">
                                            <ChefHat className="h-3 w-3" />
                                            {item.prep_station_label}
                                        </span>
                                        {item.seat_number && <span>· Seat {item.seat_number}</span>}
                                    </div>
                                    {item.modifiers.length > 0 && (
                                        <div className="mt-0.5 text-xs text-amber-300">
                                            {item.modifiers.map((m) => m.name).join(', ')}
                                        </div>
                                    )}
                                    {item.special_instructions && (
                                        <div className="mt-1 rounded bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-200">
                                            ALLERGY/NOTE: {item.special_instructions}
                                        </div>
                                    )}
                                </div>

                                <div className="shrink-0">{renderItemAction(item)}</div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="border-t border-zinc-800 p-3">
                <Button
                    type="button"
                    className="w-full"
                    variant={isReadyForExpo ? 'default' : 'secondary'}
                    disabled={!isReadyForExpo}
                    onClick={() => onServeTicket(ticket.id)}
                >
                    <Utensils className="h-4 w-4" />
                    {isReadyForExpo ? 'Expo Bump · Serve Tray' : 'Waiting on Stations...'}
                </Button>
            </div>
        </motion.div>
    );
}
