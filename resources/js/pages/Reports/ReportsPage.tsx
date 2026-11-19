import { useState } from 'react';
import { Head, router, usePage } from '@inertiajs/react';
import { Activity, AlertOctagon, Building2, DollarSign, Receipt, ShieldCheck, TrendingUp } from 'lucide-react';
import { PosAppLayout } from '@/layouts/PosAppLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
            subtitle="P&L metrics, theoretical recipe COGS, cash variance, and security logs."
        >
            <Head title="Reports — Aurelia POS" />

            <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-3.5">
                    <div className="text-xs font-semibold text-muted-foreground">
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
                                className="rounded-xl border border-input bg-background px-3 py-1.5 text-xs font-medium"
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
                            className="rounded-xl border border-input bg-background px-2.5 py-1.5 text-xs"
                        />

                        <input
                            type="date"
                            aria-label="Date To"
                            value={dateTo}
                            onChange={(e) => {
                                setDateTo(e.target.value);
                                applyScope(filters.branchId, dateFrom, e.target.value);
                            }}
                            className="rounded-xl border border-input bg-background px-2.5 py-1.5 text-xs"
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

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Card className="rounded-2xl">
                        <CardHeader className="pb-1">
                            <CardTitle className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase">
                                <span>Net Revenue</span>
                                <DollarSign className="h-4 w-4 text-emerald-600" />
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="font-mono text-2xl font-bold">{formatCents(metrics.totalRevenueCents)}</div>
                            <p className="mt-1 text-xs text-muted-foreground">{metrics.totalOrdersCount} paid orders</p>
                        </CardContent>
                    </Card>

                    <Card className="rounded-2xl">
                        <CardHeader className="pb-1">
                            <CardTitle className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase">
                                <span>Average Order Value</span>
                                <Receipt className="h-4 w-4 text-sky-600" />
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="font-mono text-2xl font-bold">{formatCents(metrics.averageOrderValueCents)}</div>
                        </CardContent>
                    </Card>

                    <Card className="rounded-2xl">
                        <CardHeader className="pb-1">
                            <CardTitle className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase">
                                <span>Food Cost (COGS)</span>
                                <TrendingUp className="h-4 w-4 text-primary" />
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="font-mono text-2xl font-bold">{formatBps(metrics.cogsPercentBps)}</div>
                            <p className="mt-1 text-xs text-muted-foreground">
                                {formatCents(metrics.totalCogsCents)} · Wastage {formatCents(metrics.totalWastageCents)}
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="rounded-2xl">
                        <CardHeader className="pb-1">
                            <CardTitle className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase">
                                <span>Voids &amp; Variance</span>
                                <AlertOctagon className="h-4 w-4 text-rose-600" />
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="font-mono text-2xl font-bold">{formatCents(metrics.totalVoidsCents)}</div>
                            <p className="mt-1 text-xs text-muted-foreground">
                                Cash Variance: {formatCents(metrics.netCashVarianceCents)}
                            </p>
                        </CardContent>
                    </Card>
                </div>

                <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList>
                        <TabsTrigger value="overview">
                            <Activity className="h-4 w-4" />
                            P&amp;L &amp; Peak Hours
                        </TabsTrigger>
                        {canSwitch && (
                            <TabsTrigger value="branches">
                                <Building2 className="h-4 w-4" />
                                Branch Comparison
                            </TabsTrigger>
                        )}
                        <TabsTrigger value="audit">
                            <ShieldCheck className="h-4 w-4" />
                            Audit Trail
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
