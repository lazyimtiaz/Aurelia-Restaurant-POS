import { Head, router, usePage } from '@inertiajs/react';
import { AlertTriangle, Boxes, DollarSign } from 'lucide-react';
import { PosAppLayout } from '@/layouts/PosAppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useBranchEcho } from '@/hooks/useBranchEcho';
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

            <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-3">
                    <Card className="rounded-2xl">
                        <CardHeader className="pb-1">
                            <CardTitle className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase">
                                <span>Tracked Ingredients</span>
                                <Boxes className="h-4 w-4 text-primary" />
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="font-mono text-2xl font-bold">{inventory.stocks.length}</div>
                        </CardContent>
                    </Card>

                    <Card className="rounded-2xl">
                        <CardHeader className="pb-1">
                            <CardTitle className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase">
                                <span>Low / Depleted Alerts</span>
                                <AlertTriangle className="h-4 w-4 text-rose-600" />
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className={`font-mono text-2xl font-bold ${lowStockCount > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                {lowStockCount}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="rounded-2xl">
                        <CardHeader className="pb-1">
                            <CardTitle className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase">
                                <span>Branch Stock Valuation</span>
                                <DollarSign className="h-4 w-4 text-emerald-600" />
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="font-mono text-2xl font-bold">{formatCents(totalValuationCents)}</div>
                        </CardContent>
                    </Card>
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
