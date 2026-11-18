import { Head } from '@inertiajs/react';
import { AppShellLayout } from '@/layouts/AppShellLayout';
import { PosPanel } from '@/modules/pos/PosPanel';
import type { MenuCategoryData } from '@/types/evaluator';
import type { ActiveOrderData, FloorZoneData } from '@/types/pos';

interface PosWorkspaceProps {
    catalog: MenuCategoryData[];
    zones: FloorZoneData[];
    activeOrders: ActiveOrderData[];
    recentPaidOrders?: ActiveOrderData[];
    initialOrderId?: number | null;
}

export default function PosWorkspace({
    catalog,
    zones,
    activeOrders,
    recentPaidOrders = [],
    initialOrderId = null,
}: PosWorkspaceProps) {
    return (
        <AppShellLayout>
            <Head title="Cashier POS Terminal" />

            <div className="space-y-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Cashier &amp; Server POS Terminal</h1>
                    <p className="text-sm text-muted-foreground">
                        Multi-round kitchen ticket firing, split billing, partial-payment recovery, and thermal receipts.
                    </p>
                </div>

                <PosPanel
                    catalog={catalog}
                    zones={zones}
                    activeOrders={activeOrders}
                    recentPaidOrders={recentPaidOrders}
                    initialOrderId={initialOrderId}
                />
            </div>
        </AppShellLayout>
    );
}
