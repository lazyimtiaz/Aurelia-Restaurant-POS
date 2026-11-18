import { Head, usePage } from '@inertiajs/react';
import { SplitSquareHorizontal } from 'lucide-react';
import { AppShellLayout } from '@/layouts/AppShellLayout';
import { Badge } from '@/components/ui/badge';
import { KdsPanel } from '@/modules/kds/KdsPanel';
import { PosPanel } from '@/modules/pos/PosPanel';
import type { MenuCategoryData, SharedPageProps } from '@/types/evaluator';
import type { ActiveOrderData, FloorZoneData, KdsTicketData } from '@/types/pos';

interface SplitScreenDemoWorkspaceProps {
    catalog: MenuCategoryData[];
    zones: FloorZoneData[];
    activeOrders: ActiveOrderData[];
    tickets: KdsTicketData[];
    stations: { value: string; label: string }[];
}

export default function SplitScreenDemoWorkspace({
    catalog,
    zones,
    activeOrders,
    tickets,
    stations,
}: SplitScreenDemoWorkspaceProps) {
    const { evaluator } = usePage<SharedPageProps>().props;

    return (
        <AppShellLayout>
            <Head title="Split-Screen POS ↔ KDS Live Demo" />

            <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
                    <div className="flex items-center gap-2.5">
                        <SplitSquareHorizontal className="h-5 w-5 text-amber-600" />
                        <div>
                            <h1 className="text-base font-bold">
                                Live Split-Screen Evaluator Workspace — {evaluator.activeBranch.name}
                            </h1>
                            <p className="text-xs text-muted-foreground">
                                Fire an order round on the left POS Terminal and watch the kitchen ticket sync onto the right KDS Display in real time via Laravel Reverb.
                            </p>
                        </div>
                    </div>
                    <Badge variant="warning">Real-Time WebSocket Sync</Badge>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                    <section className="space-y-2">
                        <div className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                            Left Terminal · Cashier / Server POS
                        </div>
                        <PosPanel catalog={catalog} zones={zones} activeOrders={activeOrders} compact />
                    </section>

                    <section className="space-y-2">
                        <div className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                            Right Display · Kitchen Display &amp; Expo
                        </div>
                        <KdsPanel tickets={tickets} stations={stations} compact />
                    </section>
                </div>
            </div>
        </AppShellLayout>
    );
}
