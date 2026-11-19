import { motion } from 'motion/react';
import { Building2, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusPill } from '@/design-system';
import { formatBps, formatCents } from '@/lib/money';
import { cn } from '@/lib/utils';
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
        <div className="space-y-6">
            <Card>
                <CardHeader className="border-b border-border/60 bg-[var(--surface-inset)]/60">
                    <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-primary" />
                        <span>Cross-Branch Revenue &amp; Food Cost Comparison</span>
                    </CardTitle>
                    <CardDescription>
                        Tap any branch card below to scope P&amp;L metrics and audit records to that location.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 p-5 sm:p-6">
                    {branches.map((branch) => {
                        const barWidthPct = Math.max(
                            4,
                            Math.round((branch.revenueCents / maxRevenue) * 100),
                        );
                        return (
                            <div key={branch.branchId} className="space-y-1.5">
                                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                                    <span className="font-semibold text-foreground">
                                        {branch.branchCode} · {branch.branchName}
                                    </span>
                                    <span className="font-mono text-muted-foreground tabular-nums">
                                        {formatCents(branch.revenueCents)} · COGS {formatBps(branch.cogsPercentBps)}
                                    </span>
                                </div>
                                <div className="h-3 w-full overflow-hidden rounded-full bg-[var(--surface-inset)] ring-1 ring-border/70">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${barWidthPct}%` }}
                                        transition={{ duration: 0.45, ease: 'easeOut' }}
                                        className="h-full rounded-full bg-gradient-to-r from-[#EA580C] to-[#F59E0B]"
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
                                variant="interactive"
                                onClick={() => onSelectBranch(isSelected ? null : branch.branchId)}
                                className={cn(
                                    'cursor-pointer',
                                    isSelected && 'border-primary ring-2 ring-primary/25',
                                )}
                            >
                                <CardHeader className="pb-3">
                                    <div className="flex items-center justify-between gap-2">
                                        <CardTitle className="flex items-center gap-2 truncate">
                                            <Building2 className="h-4 w-4 shrink-0 text-primary" />
                                            <span className="truncate">{branch.branchName}</span>
                                        </CardTitle>
                                        <StatusPill
                                            tone={isSelected ? 'brand' : 'neutral'}
                                            dot={false}
                                            label={branch.branchCode}
                                        />
                                    </div>
                                    <CardDescription>{branch.ordersCount} paid orders</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-2.5 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Net Revenue</span>
                                        <span className="ds-num-sm">{formatCents(branch.revenueCents)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Avg Order Value</span>
                                        <span className="font-mono tabular-nums">
                                            {formatCents(branch.averageOrderValueCents)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Theoretical COGS</span>
                                        <span
                                            className={cn(
                                                'font-mono font-semibold tabular-nums',
                                                highCogs ? 'text-rose-600' : 'text-emerald-600',
                                            )}
                                        >
                                            {formatCents(branch.cogsCents)} ({formatBps(branch.cogsPercentBps)})
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Void Leakage</span>
                                        <span className="font-mono text-amber-700 tabular-nums">
                                            {formatCents(branch.voidsCents)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between border-t border-border pt-2.5">
                                        <span className="text-muted-foreground">Net Cash Variance</span>
                                        <span
                                            className={cn(
                                                'font-mono font-semibold tabular-nums',
                                                hasNegativeVariance ? 'text-rose-600' : 'text-foreground',
                                            )}
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
