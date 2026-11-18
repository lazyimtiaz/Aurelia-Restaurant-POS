import { motion } from 'motion/react';
import { Building2, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatBps, formatCents } from '@/lib/money';
import type { BranchComparisonRowData } from '@/types/executive';

interface BranchComparisonCardsProps {
    branches: BranchComparisonRowData[];
    selectedBranchId: number | null;
    onSelectBranch: (branchId: number | null) => void;
}

export function BranchComparisonCards({
    branches,
    selectedBranchId,
    onSelectBranch,
}: BranchComparisonCardsProps) {
    const maxRevenue = Math.max(1, ...branches.map((b) => b.revenueCents));

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-primary" />
                        Cross-Branch Revenue &amp; Food Cost Comparison
                    </CardTitle>
                    <CardDescription>
                        Click any branch card to scope P&amp;L KPIs, hourly throughput, and inventory ledger to that location.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    {branches.map((branch) => {
                        const barWidthPct = Math.max(4, Math.round((branch.revenueCents / maxRevenue) * 100));
                        return (
                            <div key={branch.branchId} className="space-y-1">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="font-semibold">
                                        {branch.branchCode} · {branch.branchName}
                                    </span>
                                    <span className="font-mono text-muted-foreground">
                                        {formatCents(branch.revenueCents)} · COGS {formatBps(branch.cogsPercentBps)}
                                    </span>
                                </div>
                                <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${barWidthPct}%` }}
                                        transition={{ duration: 0.4 }}
                                        className="h-full rounded-full bg-amber-500"
                                    />
                                </div>
                            </div>
                        );
                    })}
                </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-3">
                {branches.map((branch, idx) => {
                    const isSelected = selectedBranchId === branch.branchId;
                    const highCogs = branch.cogsPercentBps > 3500;
                    const hasNegativeVariance = branch.cashVarianceCents < 0;

                    return (
                        <motion.div
                            key={branch.branchId}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.05 }}
                        >
                            <Card
                                onClick={() => onSelectBranch(isSelected ? null : branch.branchId)}
                                className={`cursor-pointer transition-all hover:border-amber-500/60 ${
                                    isSelected ? 'ring-2 ring-amber-500 border-amber-500' : ''
                                }`}
                            >
                                <CardHeader className="pb-2">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="flex items-center gap-2 text-base">
                                            <Building2 className="h-4 w-4 text-amber-600" />
                                            {branch.branchName}
                                        </CardTitle>
                                        <Badge variant={isSelected ? 'warning' : 'outline'}>{branch.branchCode}</Badge>
                                    </div>
                                    <CardDescription>{branch.ordersCount} paid orders</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Net Revenue</span>
                                        <span className="font-mono font-bold">{formatCents(branch.revenueCents)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Avg Order Value</span>
                                        <span className="font-mono">{formatCents(branch.averageOrderValueCents)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Theoretical COGS</span>
                                        <span className={`font-mono font-semibold ${highCogs ? 'text-rose-600' : 'text-emerald-600'}`}>
                                            {formatCents(branch.cogsCents)} ({formatBps(branch.cogsPercentBps)})
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Void Leakage</span>
                                        <span className="font-mono text-amber-700">{formatCents(branch.voidsCents)}</span>
                                    </div>
                                    <div className="flex justify-between border-t border-border pt-2">
                                        <span className="text-muted-foreground">Net Cash Variance</span>
                                        <span
                                            className={`font-mono font-semibold ${
                                                hasNegativeVariance ? 'text-rose-600' : 'text-foreground'
                                            }`}
                                        >
                                            {formatCents(branch.cashVarianceCents)}
                                        </span>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    );
                })}
            </div>
        </div>
    );
}
