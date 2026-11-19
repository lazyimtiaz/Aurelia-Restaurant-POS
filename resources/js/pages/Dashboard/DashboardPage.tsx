import { Head, Link, router, usePage } from '@inertiajs/react';
import { motion } from 'motion/react';
import {
    AlertCircle,
    ArrowRight,
    DollarSign,
    ShoppingBag,
    ShoppingCart,
    TrendingUp,
    Utensils,
} from 'lucide-react';
import { PosAppLayout } from '@/layouts/PosAppLayout';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useBranchEcho } from '@/hooks/useBranchEcho';
import { formatBps, formatCents } from '@/lib/money';
import type { ActiveOrderData } from '@/types/pos';
import type { PosSharedProps } from '@/types/pos-app';
import type { ExecutiveDashboardMetricsData } from '@/types/executive';

interface SalesCategoryRow {
    categoryId: number;
    categoryName: string;
    revenueCents: number;
    shareBps: number;
}

interface OutOfStockRow {
    variant_id: number;
    sku: string;
    item_name: string;
    variant_name: string;
    image_path: string | null;
    reason: string;
}

interface DashboardOverviewData {
    metrics: ExecutiveDashboardMetricsData;
    dineInOrdersCount: number;
    takeawayOrdersCount: number;
    salesByCategory: SalesCategoryRow[];
    tableStatusCounts: {
        available: number;
        occupied: number;
        reserved: number;
        dirty: number;
        total: number;
    };
    liveOrders: ActiveOrderData[];
    outOfStockItems: OutOfStockRow[];
}

interface DashboardPageProps {
    overview: DashboardOverviewData;
}

const CATEGORY_COLORS = ['#ea580c', '#16a34a', '#f59e0b', '#0ea5e9', '#8b5cf6'];

export default function DashboardPage({ overview }: DashboardPageProps) {
    const { auth } = usePage<PosSharedProps>().props;
    const branchId = auth?.activeBranch.id ?? 0;
    const staffName = auth?.staff?.name.split(' ')[0] ?? 'Team';

    useBranchEcho(branchId, ['pos', 'floor', 'manager'], () => {
        router.reload({ only: ['overview'] });
    });

    const { metrics, dineInOrdersCount, takeawayOrdersCount, salesByCategory, tableStatusCounts, liveOrders, outOfStockItems } =
        overview;

    const chartPoints = metrics.hourlySales.filter((p) => p.hour >= 8 && p.hour <= 23);
    const maxHourlyRev = Math.max(1000, ...chartPoints.map((p) => p.revenueCents));
    const peakPoint = chartPoints.reduce(
        (best, cur) => (cur.revenueCents > best.revenueCents ? cur : best),
        chartPoints[0] ?? { hour: 12, label: '12:00', revenueCents: 0, ordersCount: 0 },
    );

    const svgW = 560;
    const svgH = 160;
    const coords = chartPoints.map((pt, idx) => {
        const x = (idx / Math.max(1, chartPoints.length - 1)) * (svgW - 24) + 12;
        const y = svgH - 18 - (pt.revenueCents / maxHourlyRev) * (svgH - 42);
        return { x, y, pt };
    });

    const linePath = coords
        .map((c, idx) => `${idx === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
        .join(' ');
    const areaPath =
        coords.length > 0
            ? `${linePath} L ${coords[coords.length - 1].x.toFixed(1)} ${svgH - 18} L ${coords[0].x.toFixed(1)} ${svgH - 18} Z`
            : '';

    const totalTables = Math.max(1, tableStatusCounts.total);
    const tableSegments = [
        { label: 'Occupied', count: tableStatusCounts.occupied, color: '#ea580c' },
        { label: 'Reserved', count: tableStatusCounts.reserved, color: '#f59e0b' },
        { label: 'Available', count: tableStatusCounts.available, color: '#16a34a' },
        { label: 'Cleaning', count: tableStatusCounts.dirty, color: '#a8a29e' },
    ];

    const donutCircumference = 2 * Math.PI * 46;
    let tableOffset = 0;
    let catOffset = 0;

    return (
        <PosAppLayout
            title={`Welcome back, ${staffName}`}
            subtitle={`Here is what is happening at ${auth?.activeBranch.name ?? 'your restaurant'} today.`}
        >
            <Head title="Dashboard — Aurelia POS" />

            <div className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                        <Card className="rounded-2xl">
                            <CardContent className="flex items-center gap-4 p-5">
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-600">
                                    <DollarSign className="h-5 w-5" />
                                </div>
                                <div className="min-w-0">
                                    <div className="text-xs font-medium text-muted-foreground">Revenue</div>
                                    <div className="font-mono text-2xl font-bold tracking-tight">
                                        {formatCents(metrics.totalRevenueCents)}
                                    </div>
                                    <div className="text-[11px] text-muted-foreground">
                                        AOV {formatCents(metrics.averageOrderValueCents)}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>

                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }}>
                        <Card className="rounded-2xl">
                            <CardContent className="flex items-center gap-4 p-5">
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                                    <ShoppingCart className="h-5 w-5" />
                                </div>
                                <div className="min-w-0">
                                    <div className="text-xs font-medium text-muted-foreground">Paid Orders</div>
                                    <div className="font-mono text-2xl font-bold tracking-tight">
                                        {metrics.totalOrdersCount}
                                    </div>
                                    <div className="text-[11px] text-muted-foreground">
                                        COGS {formatBps(metrics.cogsPercentBps)}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>

                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
                        <Card className="rounded-2xl">
                            <CardContent className="flex items-center gap-4 p-5">
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600">
                                    <Utensils className="h-5 w-5" />
                                </div>
                                <div className="min-w-0">
                                    <div className="text-xs font-medium text-muted-foreground">Dine-In Tabs</div>
                                    <div className="font-mono text-2xl font-bold tracking-tight">
                                        {dineInOrdersCount}
                                    </div>
                                    <div className="text-[11px] text-muted-foreground">
                                        {tableStatusCounts.occupied} of {tableStatusCounts.total} tables seated
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>

                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
                        <Card className="rounded-2xl">
                            <CardContent className="flex items-center gap-4 p-5">
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                                    <ShoppingBag className="h-5 w-5" />
                                </div>
                                <div className="min-w-0">
                                    <div className="text-xs font-medium text-muted-foreground">Takeaway Orders</div>
                                    <div className="font-mono text-2xl font-bold tracking-tight">
                                        {takeawayOrdersCount}
                                    </div>
                                    <div className="text-[11px] text-muted-foreground">
                                        Voids {formatCents(metrics.totalVoidsCents)}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                </div>

                <div className="grid gap-6 lg:grid-cols-3">
                    <Card className="rounded-2xl lg:col-span-2">
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <TrendingUp className="h-4 w-4 text-primary" />
                                    Daily Sales Throughput
                                </CardTitle>
                                <CardDescription>Hourly revenue distribution (08:00 – 23:00)</CardDescription>
                            </div>
                            <Badge variant="warning" className="font-mono">
                                Peak {peakPoint.label} · {formatCents(peakPoint.revenueCents)}
                            </Badge>
                        </CardHeader>
                        <CardContent>
                            <svg viewBox={`0 0 ${svgW} ${svgH}`} className="h-48 w-full" role="img" aria-label="Daily Sales Area Chart">
                                <defs>
                                    <linearGradient id="dailySalesGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#ea580c" stopOpacity="0.28" />
                                        <stop offset="100%" stopColor="#ea580c" stopOpacity="0.02" />
                                    </linearGradient>
                                </defs>
                                {areaPath && <path d={areaPath} fill="url(#dailySalesGrad)" />}
                                {linePath && (
                                    <path
                                        d={linePath}
                                        fill="none"
                                        stroke="#ea580c"
                                        strokeWidth="2.5"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                )}
                                {coords.map(({ x, y, pt }, idx) => (
                                    <g key={pt.hour}>
                                        {pt.revenueCents > 0 && (
                                            <circle cx={x} cy={y} r={4} fill="#ea580c" stroke="#ffffff" strokeWidth="2" />
                                        )}
                                        {idx % 3 === 0 && (
                                            <text
                                                x={x}
                                                y={svgH - 2}
                                                textAnchor="middle"
                                                className="fill-muted-foreground text-[10px] font-mono"
                                            >
                                                {pt.label}
                                            </text>
                                        )}
                                    </g>
                                ))}
                            </svg>
                        </CardContent>
                    </Card>

                    <Card className="rounded-2xl">
                        <CardHeader>
                            <CardTitle className="text-base">Sales by Category</CardTitle>
                            <CardDescription>Share of paid dish revenue</CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-col items-center gap-4">
                            <div className="relative flex h-36 w-36 items-center justify-center">
                                <svg viewBox="0 0 120 120" className="h-36 w-36 -rotate-90">
                                    <circle cx="60" cy="60" r="46" fill="none" stroke="#f5f2ec" strokeWidth="14" />
                                    {salesByCategory.map((cat, idx) => {
                                        const dash = (cat.shareBps / 10000) * donutCircumference;
                                        const offset = -catOffset;
                                        catOffset += dash;
                                        return (
                                            <circle
                                                key={cat.categoryId}
                                                cx="60"
                                                cy="60"
                                                r="46"
                                                fill="none"
                                                stroke={CATEGORY_COLORS[idx % CATEGORY_COLORS.length]}
                                                strokeWidth="14"
                                                strokeDasharray={`${dash} ${donutCircumference}`}
                                                strokeDashoffset={offset}
                                            />
                                        );
                                    })}
                                </svg>
                                <div className="absolute text-center">
                                    <div className="font-mono text-sm font-bold">
                                        {formatCents(metrics.totalRevenueCents)}
                                    </div>
                                    <div className="text-[10px] text-muted-foreground uppercase">Revenue</div>
                                </div>
                            </div>

                            <div className="w-full space-y-2 text-xs">
                                {salesByCategory.length === 0 ? (
                                    <p className="text-center text-muted-foreground">No paid category sales yet.</p>
                                ) : (
                                    salesByCategory.map((cat, idx) => (
                                        <div key={cat.categoryId} className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span
                                                    className="h-2.5 w-2.5 rounded-full"
                                                    style={{ backgroundColor: CATEGORY_COLORS[idx % CATEGORY_COLORS.length] }}
                                                />
                                                <span className="font-medium">{cat.categoryName}</span>
                                            </div>
                                            <span className="font-mono text-muted-foreground">
                                                {formatCents(cat.revenueCents)} · {formatBps(cat.shareBps)}
                                            </span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid gap-6 lg:grid-cols-3">
                    <Card className="rounded-2xl lg:col-span-2">
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle className="text-base">Live Orders</CardTitle>
                                <CardDescription>Active dining room tabs &amp; takeaway queues</CardDescription>
                            </div>
                            <Link
                                href="/orders"
                                className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                            >
                                View all orders <ArrowRight className="h-3.5 w-3.5" />
                            </Link>
                        </CardHeader>
                        <CardContent>
                            {liveOrders.length === 0 ? (
                                <p className="py-6 text-center text-sm text-muted-foreground">
                                    No open orders at the moment.
                                </p>
                            ) : (
                                <div className="divide-y divide-border">
                                    {liveOrders.map((order) => {
                                        const itemCount = order.items
                                            .filter((i) => i.prep_state !== 'voided')
                                            .reduce((sum, i) => sum + i.quantity, 0);

                                        return (
                                            <Link
                                                key={order.id}
                                                href={`/pos?order_id=${order.id}`}
                                                className="flex items-center justify-between gap-3 py-3 transition hover:bg-muted/40 rounded-lg px-2"
                                            >
                                                <div className="min-w-0">
                                                    <div className="font-semibold text-sm">
                                                        {order.order_number} ·{' '}
                                                        {order.table_code ? `Table ${order.table_code}` : order.customer_name || 'Takeaway'}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {itemCount} items · {order.server_name ?? 'Staff'}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <Badge variant={order.state === 'partially_paid' ? 'warning' : 'outline'}>
                                                        {order.state}
                                                    </Badge>
                                                    <span className="font-mono text-sm font-bold">
                                                        {formatCents(order.total_cents)}
                                                    </span>
                                                </div>
                                            </Link>
                                        );
                                    })}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="rounded-2xl">
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle className="text-base">Table Status</CardTitle>
                                <CardDescription>Live dining room mix</CardDescription>
                            </div>
                            <Link
                                href="/tables"
                                className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                            >
                                Floor plan <ArrowRight className="h-3.5 w-3.5" />
                            </Link>
                        </CardHeader>
                        <CardContent className="flex flex-col items-center gap-4">
                            <div className="relative flex h-32 w-32 items-center justify-center">
                                <svg viewBox="0 0 120 120" className="h-32 w-32 -rotate-90">
                                    <circle cx="60" cy="60" r="46" fill="none" stroke="#f5f2ec" strokeWidth="14" />
                                    {tableSegments.map((seg) => {
                                        const dash = (seg.count / totalTables) * donutCircumference;
                                        const offset = -tableOffset;
                                        tableOffset += dash;
                                        return (
                                            <circle
                                                key={seg.label}
                                                cx="60"
                                                cy="60"
                                                r="46"
                                                fill="none"
                                                stroke={seg.color}
                                                strokeWidth="14"
                                                strokeDasharray={`${dash} ${donutCircumference}`}
                                                strokeDashoffset={offset}
                                            />
                                        );
                                    })}
                                </svg>
                                <div className="text-center absolute">
                                    <div className="font-mono text-lg font-bold">{tableStatusCounts.total}</div>
                                    <div className="text-[10px] text-muted-foreground">Tables</div>
                                </div>
                            </div>

                            <div className="grid w-full grid-cols-2 gap-2 text-xs">
                                {tableSegments.map((seg) => (
                                    <div key={seg.label} className="flex items-center justify-between rounded-lg bg-muted/50 px-2.5 py-1.5">
                                        <span className="flex items-center gap-1.5">
                                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: seg.color }} />
                                            {seg.label}
                                        </span>
                                        <span className="font-mono font-semibold">{seg.count}</span>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                    <Card className="rounded-2xl">
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle className="text-base">Trending Dishes</CardTitle>
                                <CardDescription>Top revenue items today</CardDescription>
                            </div>
                            <Link href="/reports" className="text-xs font-semibold text-primary hover:underline">
                                Full report →
                            </Link>
                        </CardHeader>
                        <CardContent className="space-y-2.5">
                            {metrics.topProducts.length === 0 ? (
                                <p className="py-4 text-center text-sm text-muted-foreground">No dish sales recorded yet.</p>
                            ) : (
                                metrics.topProducts.slice(0, 4).map((product) => (
                                    <div
                                        key={product.menuItemVariantId}
                                        className="flex items-center justify-between rounded-xl border border-border/70 bg-muted/30 px-3.5 py-2.5 text-sm"
                                    >
                                        <div>
                                            <div className="font-semibold">{product.itemName}</div>
                                            <div className="text-xs text-muted-foreground">
                                                {product.variantName} · {product.quantitySold} sold
                                            </div>
                                        </div>
                                        <span className="font-mono font-bold">{formatCents(product.revenueCents)}</span>
                                    </div>
                                ))
                            )}
                        </CardContent>
                    </Card>

                    <Card className="rounded-2xl">
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle className="text-base">Out of Stock (86’d)</CardTitle>
                                <CardDescription>Items unavailable at this branch</CardDescription>
                            </div>
                            <Link href="/menu" className="text-xs font-semibold text-primary hover:underline">
                                Manage menu →
                            </Link>
                        </CardHeader>
                        <CardContent className="space-y-2.5">
                            {outOfStockItems.length === 0 ? (
                                <p className="py-4 text-center text-sm text-muted-foreground">
                                    All menu items are currently available.
                                </p>
                            ) : (
                                outOfStockItems.map((item) => (
                                    <div
                                        key={item.variant_id}
                                        className="flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50/70 px-3.5 py-2.5 text-sm"
                                    >
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                                            <div className="min-w-0">
                                                <div className="truncate font-semibold text-rose-900">
                                                    {item.item_name} ({item.variant_name})
                                                </div>
                                                <div className="truncate text-xs text-rose-700">{item.reason}</div>
                                            </div>
                                        </div>
                                        <Badge variant="destructive" className="shrink-0">86’d</Badge>
                                    </div>
                                ))
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </PosAppLayout>
    );
}
