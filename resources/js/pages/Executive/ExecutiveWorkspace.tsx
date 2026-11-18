import { useState } from 'react';
import { Head, router, usePage } from '@inertiajs/react';
import { motion } from 'motion/react';
import {
    Activity,
    AlertOctagon,
    Boxes,
    Building2,
    DollarSign,
    Receipt,
    ShieldCheck,
    TrendingUp,
} from 'lucide-react';
import { AppShellLayout } from '@/layouts/AppShellLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useBranchEcho } from '@/hooks/useBranchEcho';
import { formatBps, formatCents } from '@/lib/money';
import { AuditTrailTable } from '@/modules/executive/AuditTrailTable';
import { BranchComparisonCards } from '@/modules/executive/BranchComparisonCards';
import { InventoryStockDrawer } from '@/modules/executive/InventoryStockDrawer';
import { RevenueAndPeakHoursChart } from '@/modules/executive/RevenueAndPeakHoursChart';
import type { SharedPageProps } from '@/types/evaluator';
import type {
    AuditLogRowData,
    BranchInventoryLedgerData,
    ExecutiveDashboardMetricsData,
    ExecutiveFiltersData,
} from '@/types/executive';

interface ExecutiveWorkspaceProps {
    metrics: ExecutiveDashboardMetricsData;
    inventory: BranchInventoryLedgerData;
    auditLogs: AuditLogRowData[];
    auditEventTypes: string[];
    filters: ExecutiveFiltersData;
}

export default function ExecutiveWorkspace({
    metrics,
    inventory,
    auditLogs,
    auditEventTypes,
    filters,
}: ExecutiveWorkspaceProps) {
    const { evaluator, flash } = usePage<SharedPageProps>().props;
    const [activeTab, setActiveTab] = useState('overview');
    const [dateFrom, setDateFrom] = useState(filters.dateFrom ?? '');
    const [dateTo, setDateTo] = useState(filters.dateTo ?? '');

    useBranchEcho(filters.inventoryBranchId, ['manager'], () => {
        router.reload({
            only: ['metrics', 'inventory', 'auditLogs', 'auditEventTypes'],
        });
    });

    const applyScope = (
        nextBranchId: number | null,
        nextDateFrom: string = dateFrom,
        nextDateTo: string = dateTo,
    ) => {
        router.get(
            '/executive',
            {
                branch_id: nextBranchId === null ? 'all' : nextBranchId,
                date_from: nextDateFrom || undefined,
                date_to: nextDateTo || undefined,
            },
            { preserveState: true, preserveScroll: true },
        );
    };

    const inventoryBranch =
        evaluator.branches.find((b) => b.id === filters.inventoryBranchId) ?? evaluator.activeBranch;
    const lowStockCount = inventory.stocks.filter((s) => s.is_low_stock).length;

    return (
        <AppShellLayout>
            <Head title="Executive Analytics, Inventory & Audit" />

            <div className="space-y-6">
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-amber-700 uppercase">
                            <Activity className="h-3.5 w-3.5" />
                            Enterprise Reporting · Recipe COGS · Governance Audit
                        </div>
                        <h1 className="mt-1 text-2xl font-bold tracking-tight">
                            Executive Command &amp; Inventory Ledger
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            {filters.branchId === null
                                ? 'Consolidated multi-branch P&L metrics across Aurelia Dining Group.'
                                : `Scoped to ${inventoryBranch.name} (${inventoryBranch.code}).`}
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs">
                        <select
                            aria-label="Executive Branch Filter"
                            value={filters.branchId === null ? 'all' : String(filters.branchId)}
                            onChange={(e) => {
                                const val = e.target.value;
                                applyScope(val === 'all' ? null : Number(val));
                            }}
                            className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium focus:border-primary focus:outline-none"
                        >
                            <option value="all">All Branches (Consolidated)</option>
                            {evaluator.branches.map((branch) => (
                                <option key={branch.id} value={branch.id}>
                                    {branch.code} — {branch.name}
                                </option>
                            ))}
                        </select>

                        <input
                            type="date"
                            aria-label="Date From"
                            value={dateFrom}
                            onChange={(e) => {
                                setDateFrom(e.target.value);
                                applyScope(filters.branchId, e.target.value, dateTo);
                            }}
                            className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs focus:border-primary focus:outline-none"
                        />

                        <input
                            type="date"
                            aria-label="Date To"
                            value={dateTo}
                            onChange={(e) => {
                                setDateTo(e.target.value);
                                applyScope(filters.branchId, dateFrom, e.target.value);
                            }}
                            className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs focus:border-primary focus:outline-none"
                        />

                        {(filters.branchId !== null || dateFrom || dateTo) && (
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                    setDateFrom('');
                                    setDateTo('');
                                    applyScope(null, '', '');
                                }}
                            >
                                Reset
                            </Button>
                        )}
                    </div>
                </div>

                {flash?.success && (
                    <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 text-sm font-medium text-emerald-800">
                        {flash.success}
                    </div>
                )}

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                        <Card>
                            <CardHeader className="pb-1">
                                <CardTitle className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase">
                                    <span>Net Revenue</span>
                                    <DollarSign className="h-4 w-4 text-emerald-600" />
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="font-mono text-2xl font-bold">
                                    {formatCents(metrics.totalRevenueCents)}
                                </div>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    {metrics.totalOrdersCount} paid orders captured
                                </p>
                            </CardContent>
                        </Card>
                    </motion.div>

                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }}>
                        <Card>
                            <CardHeader className="pb-1">
                                <CardTitle className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase">
                                    <span>Average Order Value</span>
                                    <Receipt className="h-4 w-4 text-sky-600" />
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="font-mono text-2xl font-bold">
                                    {formatCents(metrics.averageOrderValueCents)}
                                </div>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    Integer-cent precision AOV
                                </p>
                            </CardContent>
                        </Card>
                    </motion.div>

                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
                        <Card>
                            <CardHeader className="pb-1">
                                <CardTitle className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase">
                                    <span>Theoretical Food Cost</span>
                                    <TrendingUp className="h-4 w-4 text-amber-600" />
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="font-mono text-2xl font-bold">
                                    {formatBps(metrics.cogsPercentBps)}
                                </div>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    COGS: {formatCents(metrics.totalCogsCents)} · Wastage:{' '}
                                    {formatCents(metrics.totalWastageCents)}
                                </p>
                            </CardContent>
                        </Card>
                    </motion.div>

                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
                        <Card>
                            <CardHeader className="pb-1">
                                <CardTitle className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase">
                                    <span>Voids &amp; Cash Variance</span>
                                    <AlertOctagon className="h-4 w-4 text-rose-600" />
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="font-mono text-2xl font-bold">
                                    {formatCents(metrics.totalVoidsCents)}
                                </div>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    Cash Drawer Variance:{' '}
                                    <span
                                        className={`font-mono font-semibold ${
                                            metrics.netCashVarianceCents < 0 ? 'text-rose-600' : 'text-foreground'
                                        }`}
                                    >
                                        {formatCents(metrics.netCashVarianceCents)}
                                    </span>
                                </p>
                            </CardContent>
                        </Card>
                    </motion.div>
                </div>

                <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList>
                        <TabsTrigger value="overview">
                            <Activity className="h-4 w-4" />
                            Overview &amp; P&amp;L
                        </TabsTrigger>
                        <TabsTrigger value="branches">
                            <Building2 className="h-4 w-4" />
                            Branch Comparison
                        </TabsTrigger>
                        <TabsTrigger value="inventory">
                            <Boxes className="h-4 w-4" />
                            Inventory &amp; Recipes
                            {lowStockCount > 0 && (
                                <Badge variant="destructive" className="ml-1 text-[10px]">
                                    {lowStockCount} Low
                                </Badge>
                            )}
                        </TabsTrigger>
                        <TabsTrigger value="audit">
                            <ShieldCheck className="h-4 w-4" />
                            Audit Trail
                            <Badge variant="outline" className="ml-1 text-[10px]">
                                {auditLogs.length}
                            </Badge>
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="overview" className="space-y-4">
                        <RevenueAndPeakHoursChart
                            hourlySales={metrics.hourlySales}
                            topProducts={metrics.topProducts}
                        />
                    </TabsContent>

                    <TabsContent value="branches">
                        <BranchComparisonCards
                            branches={metrics.branchComparisons}
                            selectedBranchId={filters.branchId}
                            onSelectBranch={(nextId) => applyScope(nextId)}
                        />
                    </TabsContent>

                    <TabsContent value="inventory">
                        <InventoryStockDrawer
                            inventory={inventory}
                            inventoryBranchId={filters.inventoryBranchId}
                            branchLabel={`${inventoryBranch.name} (${inventoryBranch.code})`}
                        />
                    </TabsContent>

                    <TabsContent value="audit">
                        <AuditTrailTable
                            initialLogs={auditLogs}
                            eventTypes={auditEventTypes}
                            branchId={filters.branchId}
                        />
                    </TabsContent>
                </Tabs>
            </div>
        </AppShellLayout>
    );
}
