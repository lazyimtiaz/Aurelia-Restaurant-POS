import { Head, router, usePage } from '@inertiajs/react';
import { AlertTriangle, Boxes, DollarSign } from 'lucide-react';
import { StatCard } from '@/design-system';
import { useBranchEcho } from '@/hooks/useBranchEcho';
import { PosAppLayout } from '@/layouts/PosAppLayout';
import { formatCents } from '@/lib/money';
import { InventoryStockDrawer } from '@/modules/executive/InventoryStockDrawer';
import type { BranchInventoryLedgerData } from '@/types/executive';
import type { PosSharedProps } from '@/types/pos-app';

interface InventoryPageProps {
    inventory: BranchInventoryLedgerData;
}

export default function InventoryPage({ inventory }: InventoryPageProps) {
    const { auth } = usePage<PosSharedProps>().props;
    const branch = auth?.activeBranch;
    const branchId = branch?.id ?? 0;

    useBranchEcho(branchId, ['manager'], () => {
        router.reload({ only: ['inventory'] });
    });

    const lowStockCount = inventory.stocks.filter((s) => s.is_low_stock).length;
    const totalValuationCents = inventory.stocks.reduce((sum, s) => sum + s.stock_value_cents, 0);

    return (
        <PosAppLayout
            title={`Inventory & Recipes — ${branch?.name ?? ''}`}
            subtitle="Receive supplier deliveries, record wastage, and monitor automated threshold 86 status."
        >
            <Head title="Inventory — Aurelia POS" />

            <div className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-3">
                    <StatCard
                        label="Tracked Ingredients"
                        value={inventory.stocks.length}
                        icon={<Boxes className="h-4.5 w-4.5" />}
                        tone="orange"
                        subtitle="Active recipe bill-of-materials"
                    />

                    <StatCard
                        label="Low / Depleted Alerts"
                        value={lowStockCount}
                        icon={<AlertTriangle className="h-4.5 w-4.5" />}
                        tone={lowStockCount > 0 ? 'rose' : 'emerald'}
                        subtitle={
                            lowStockCount > 0
                                ? 'Auto-86 triggered on linked items'
                                : 'All ingredients above threshold'
                        }
                    />

                    <StatCard
                        label="Branch Stock Valuation"
                        value={formatCents(totalValuationCents)}
                        icon={<DollarSign className="h-4.5 w-4.5" />}
                        tone="emerald"
                        subtitle="Calculated from weighted unit cost"
                    />
                </div>

                <InventoryStockDrawer
                    inventory={inventory}
                    inventoryBranchId={branchId}
                    branchLabel={branch ? `${branch.name} (${branch.code})` : 'Branch'}
                />
            </div>
        </PosAppLayout>
    );
}
