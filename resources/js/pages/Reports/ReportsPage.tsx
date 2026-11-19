import { useState } from 'react';
import { Head, router, usePage } from '@inertiajs/react';
import { Activity, AlertOctagon, Building2, DollarSign, Receipt, ShieldCheck, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StatCard } from '@/design-system';
import { PosAppLayout } from '@/layouts/PosAppLayout';
import { formatBps, formatCents } from '@/lib/money';
import { AuditTrailTable } from '@/modules/executive/AuditTrailTable';
import { BranchComparisonCards } from '@/modules/executive/BranchComparisonCards';
import { RevenueAndPeakHoursChart } from '@/modules/executive/RevenueAndPeakHoursChart';
import type { AuditLogRowData, ExecutiveDashboardMetricsData } from '@/types/executive';
import type { PosSharedProps } from '@/types/pos-app';

interface ReportsPageProps {
    metrics: ExecutiveDashboardMetricsData;
    auditLogs: AuditLogRowData[];
    auditEventTypes: string[];
    filters: {
        branchId: number | null;
        dateFrom: string | null;
        dateTo: string | null;
    };
}

export default function ReportsPage({
    metrics,
    auditLogs,
    auditEventTypes,
    filters,
}: ReportsPageProps) {
    const { auth } = usePage<PosSharedProps>().props;
    const canSwitch = auth?.staff?.can_switch_branch ?? false;

    const [activeTab, setActiveTab] = useState('overview');
    const [dateFrom, setDateFrom] = useState(filters.dateFrom ?? '');
    const [dateTo, setDateTo] = useState(filters.dateTo ?? '');

    const applyScope = (
        nextBranchId: number | null,
        nextFrom: string = dateFrom,
        nextTo: string = dateTo,
    ) => {
        router.get(
            '/reports',
            {
                branch_id: nextBranchId === null ? 'all' : nextBranchId,
                date_from: nextFrom || undefined,
                date_to: nextTo || undefined,
            },
            { preserveState: true, preserveScroll: true },
        );
    };

    return (
        <PosAppLayout
            title="Financial Reports & Audit Trail"
            subtitle="P&L metrics, theoretical recipe COGS, cash variance, and immutable governance logs."
        >
            <Head title="Reports — Aurelia POS" />

            <div className="space-y-6">
                <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-3.5 shadow-bistro-card lg:flex-row lg:items-center lg:justify-between">
                    <div className="ds-caption font-semibold text-foreground">
                        {filters.branchId === null
                            ? 'Scope: All Branches (Consolidated)'
                            : `Scope: ${auth?.activeBranch.name ?? 'Active Branch'}`}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs">
                        {canSwitch && (
                            <select
                                aria-label="Report Branch Filter"
                                value={filters.branchId === null ? 'all' : String(filters.branchId)}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    applyScope(val === 'all' ? null : Number(val));
                                }}
                                className="h-9 rounded-xl border border-input bg-[var(--surface-inset)] px-3 text-xs font-medium text-foreground focus:border-primary focus:outline-none"
                            >
                                <option value="all">All Branches (Consolidated)</option>
                                {(auth?.branches ?? []).map((b) => (
                                    <option key={b.id} value={b.id}>
                                        {b.code} — {b.name}
                                    </option>
                                ))}
                            </select>
                        )}

                        <input
                            type="date"
                            aria-label="Date From"
                            value={dateFrom}
                            onChange={(e) => {
                                setDateFrom(e.target.value);
                                applyScope(filters.branchId, e.target.value, dateTo);
                            }}
                            className="h-9 rounded-xl border border-input bg-[var(--surface-inset)] px-2.5 text-xs focus:border-primary focus:outline-none"
                        />

                        <input
                            type="date"
                            aria-label="Date To"
                            value={dateTo}
                            onChange={(e) => {
                                setDateTo(e.target.value);
                                applyScope(filters.branchId, dateFrom, e.target.value);
                            }}
                            className="h-9 rounded-xl border border-input bg-[var(--surface-inset)] px-2.5 text-xs focus:border-primary focus:outline-none"
                        />

                        {(dateFrom || dateTo || (canSwitch && filters.branchId !== null)) && (
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                    setDateFrom('');
                                    setDateTo('');
                                    applyScope(canSwitch ? null : auth?.activeBranch.id ?? null, '', '');
                                }}
                            >
                                Reset
                            </Button>
                        )}
                    </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <StatCard
                        label="Net Revenue"
                        value={formatCents(metrics.totalRevenueCents)}
                        icon={<DollarSign className="h-4.5 w-4.5" />}
                        tone="emerald"
                        subtitle={`${metrics.totalOrdersCount} paid orders`}
                    />
                    <StatCard
                        label="Average Order Value"
                        value={formatCents(metrics.averageOrderValueCents)}
                        icon={<Receipt className="h-4.5 w-4.5" />}
                        tone="sky"
                        subtitle="Across settled checks"
                    />
                    <StatCard
                        label="Food Cost (COGS)"
                        value={formatBps(metrics.cogsPercentBps)}
                        icon={<TrendingUp className="h-4.5 w-4.5" />}
                        tone="orange"
                        subtitle={`${formatCents(metrics.totalCogsCents)} · Wastage ${formatCents(metrics.totalWastageCents)}`}
                    />
                    <StatCard
                        label="Voids & Variance"
                        value={formatCents(metrics.totalVoidsCents)}
                        icon={<AlertOctagon className="h-4.5 w-4.5" />}
                        tone="rose"
                        subtitle={`Cash Variance ${formatCents(metrics.netCashVarianceCents)}`}
                    />
                </div>

                <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList>
                        <TabsTrigger value="overview">
                            <Activity className="h-4 w-4" />
                            <span>P&amp;L &amp; Peak Hours</span>
                        </TabsTrigger>
                        {canSwitch && (
                            <TabsTrigger value="branches">
                                <Building2 className="h-4 w-4" />
                                <span>Branch Comparison</span>
                            </TabsTrigger>
                        )}
                        <TabsTrigger value="audit">
                            <ShieldCheck className="h-4 w-4" />
                            <span>Audit Trail</span>
                            <Badge variant="outline" className="ml-1 text-[10px]">
                                {auditLogs.length}
                            </Badge>
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="overview">
                        <RevenueAndPeakHoursChart
                            hourlySales={metrics.hourlySales}
                            topProducts={metrics.topProducts}
                        />
                    </TabsContent>

                    {canSwitch && (
                        <TabsContent value="branches">
                            <BranchComparisonCards
                                branches={metrics.branchComparisons}
                                selectedBranchId={filters.branchId}
                                onSelectBranch={(nextId) => applyScope(nextId)}
                            />
                        </TabsContent>
                    )}

                    <TabsContent value="audit">
                        <AuditTrailTable
                            initialLogs={auditLogs}
                            eventTypes={auditEventTypes}
                            branchId={filters.branchId}
                        />
                    </TabsContent>
                </Tabs>
            </div>
        </PosAppLayout>
    );
}
