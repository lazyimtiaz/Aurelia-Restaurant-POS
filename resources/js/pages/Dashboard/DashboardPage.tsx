import { useMemo, useState } from 'react';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { motion } from 'motion/react';
import {
    AlertCircle,
    ArrowRight,
    DollarSign,
    Flame,
    ShoppingBag,
    ShoppingCart,
    TrendingUp,
    Utensils,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard, StatusPill } from '@/design-system';
import { useBranchEcho } from '@/hooks/useBranchEcho';
import { formatBps, formatCents } from '@/lib/money';
import { PosAppLayout } from '@/layouts/PosAppLayout';
import type { ExecutiveDashboardMetricsData } from '@/types/executive';
import type { ActiveOrderData } from '@/types/pos';
import type { PosSharedProps } from '@/types/pos-app';

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

const CATEGORY_COLORS = ['#EA580C', '#16A34A', '#F59E0B', '#0284C7', '#8B5CF6'];

function buildSmoothCurvePath(
    points: { x: number; y: number }[],
    minY: number,
    maxY: number,
): string {
    const n = points.length;
    if (n === 0) return '';
    if (n === 1) return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;

    // Fritsch-Carlson monotone cubic interpolation prevents overshoot below zero baseline
    const dx: number[] = [];
    const dy: number[] = [];
    const slopes: number[] = [];
    for (let i = 0; i < n - 1; i++) {
        const dxi = points[i + 1].x - points[i].x || 1;
        const dyi = points[i + 1].y - points[i].y;
        dx.push(dxi);
        dy.push(dyi);
        slopes.push(dyi / dxi);
    }

    const tangents: number[] = new Array(n).fill(0);
    tangents[0] = slopes[0];
    tangents[n - 1] = slopes[n - 2];

    for (let i = 1; i < n - 1; i++) {
        if (slopes[i - 1] * slopes[i] <= 0) {
            tangents[i] = 0;
        } else {
            tangents[i] = (slopes[i - 1] + slopes[i]) / 2;
        }
    }

    for (let i = 0; i < n - 1; i++) {
        if (Math.abs(slopes[i]) < 1e-6) {
            tangents[i] = 0;
            tangents[i + 1] = 0;
        } else {
            const a = tangents[i] / slopes[i];
            const b = tangents[i + 1] / slopes[i];
            const s = Math.hypot(a, b);
            if (s > 3) {
                const factor = 3 / s;
                tangents[i] = factor * a * slopes[i];
                tangents[i + 1] = factor * b * slopes[i];
            }
        }
    }

    const clampY = (y: number) => Math.min(maxY, Math.max(minY, y));
    let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
    for (let i = 0; i < n - 1; i++) {
        const step = dx[i] / 3;
        const cp1x = points[i].x + step;
        const cp1y = clampY(points[i].y + tangents[i] * step);
        const cp2x = points[i + 1].x - step;
        const cp2y = clampY(points[i + 1].y - tangents[i + 1] * step);
        d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${points[i + 1].x.toFixed(1)} ${points[i + 1].y.toFixed(1)}`;
    }
    return d;
}

export default function DashboardPage({ overview }: DashboardPageProps) {
    const { auth } = usePage<PosSharedProps>().props;
    const branchId = auth?.activeBranch.id ?? 0;
    const staffName = auth?.staff?.name.split(' ')[0] ?? 'Team';

    useBranchEcho(branchId, ['pos', 'floor', 'manager'], () => {
        router.reload({ only: ['overview'] });
    });

    const {
        metrics,
        dineInOrdersCount,
        takeawayOrdersCount,
        salesByCategory,
        tableStatusCounts,
        liveOrders,
        outOfStockItems,
    } = overview;

    const chartPoints = useMemo(
        () => metrics.hourlySales.filter((p) => p.hour >= 8 && p.hour <= 23),
        [metrics.hourlySales],
    );
    const maxHourlyRev = Math.max(1000, ...chartPoints.map((p) => p.revenueCents));
    const peakIdx = useMemo(() => {
        let bestIdx = 0;
        chartPoints.forEach((pt, idx) => {
            if (pt.revenueCents > (chartPoints[bestIdx]?.revenueCents ?? 0)) {
                bestIdx = idx;
            }
        });
        return bestIdx;
    }, [chartPoints]);

    const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
    const activeIdx = hoveredIdx ?? peakIdx;

    const svgW = 580;
    const svgH = 186;
    const padX = 18;
    const topPad = 24;
    const bottomPad = 26;

    const coords = useMemo(
        () =>
            chartPoints.map((pt, idx) => {
                const x = (idx / Math.max(1, chartPoints.length - 1)) * (svgW - padX * 2) + padX;
                const y =
                    svgH - bottomPad - (pt.revenueCents / maxHourlyRev) * (svgH - topPad - bottomPad);
                return { x, y, pt };
            }),
        [chartPoints, maxHourlyRev],
    );

    const smoothLine = useMemo(
        () => buildSmoothCurvePath(coords, topPad, svgH - bottomPad),
        [coords],
    );
    const smoothArea =
        coords.length > 0
            ? `${smoothLine} L ${coords[coords.length - 1].x.toFixed(1)} ${svgH - bottomPad} L ${coords[0].x.toFixed(1)} ${svgH - bottomPad} Z`
            : '';

    const activePoint = coords[activeIdx];
    const peakPoint = chartPoints[peakIdx] ?? {
        hour: 12,
        label: '12:00',
        revenueCents: 0,
        ordersCount: 0,
    };

    const sparkValues = chartPoints.slice(-8).map((p) => p.revenueCents);
    const orderSparkValues = chartPoints.slice(-8).map((p) => p.ordersCount);

    const totalTables = Math.max(1, tableStatusCounts.total);
    const tableSegments = [
        { label: 'Occupied', count: tableStatusCounts.occupied, color: '#EA580C' },
        { label: 'Reserved', count: tableStatusCounts.reserved, color: '#F59E0B' },
        { label: 'Available', count: tableStatusCounts.available, color: '#16A34A' },
        { label: 'Cleaning', count: tableStatusCounts.dirty, color: '#A8A29E' },
    ];

    const donutCircumference = 2 * Math.PI * 46;
    let tableOffset = 0;
    let catOffset = 0;

    return (
        <PosAppLayout
            title={`Welcome back, ${staffName}`}
            subtitle={`Live snapshot of ${auth?.activeBranch.name ?? 'your restaurant'} operations today.`}
        >
            <Head title="Dashboard — Aurelia POS" />

            <div className="space-y-6">
                {/* KPI Cards Row */}
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <StatCard
                        label="Today Revenue"
                        value={formatCents(metrics.totalRevenueCents)}
                        icon={<DollarSign className="h-4.5 w-4.5" />}
                        tone="orange"
                        subtitle={`Avg check ${formatCents(metrics.averageOrderValueCents)}`}
                        sparkline={sparkValues}
                    />
                    <StatCard
                        label="Paid Orders"
                        value={metrics.totalOrdersCount}
                        icon={<ShoppingCart className="h-4.5 w-4.5" />}
                        tone="emerald"
                        subtitle={`Food cost ${formatBps(metrics.cogsPercentBps)}`}
                        sparkline={orderSparkValues}
                    />
                    <StatCard
                        label="Dine-In Tabs"
                        value={dineInOrdersCount}
                        icon={<Utensils className="h-4.5 w-4.5" />}
                        tone="rose"
                        subtitle={`${tableStatusCounts.occupied} of ${tableStatusCounts.total} tables seated`}
                    />
                    <StatCard
                        label="Takeaway Queue"
                        value={takeawayOrdersCount}
                        icon={<ShoppingBag className="h-4.5 w-4.5" />}
                        tone="amber"
                        subtitle={`Voids today ${formatCents(metrics.totalVoidsCents)}`}
                    />
                </div>

                {/* Primary Analytical Charts */}
                <div className="grid gap-5 lg:grid-cols-3">
                    <Card className="lg:col-span-2 overflow-hidden">
                        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 bg-[var(--surface-inset)]/60">
                            <div className="min-w-0">
                                <CardTitle className="flex items-center gap-2">
                                    <TrendingUp className="h-4 w-4 text-primary" />
                                    <span>Daily Sales Throughput</span>
                                </CardTitle>
                                <CardDescription>
                                    Hourly revenue distribution (08:00 – 23:00) · Hover points to inspect
                                </CardDescription>
                            </div>
                            <StatusPill
                                tone="warning"
                                dot={false}
                                label={`Peak ${peakPoint.label} · ${formatCents(peakPoint.revenueCents)}`}
                                className="font-mono self-start sm:self-center"
                            />
                        </CardHeader>

                        <CardContent className="p-4 sm:p-6">
                            <svg
                                viewBox={`0 0 ${svgW} ${svgH}`}
                                className="h-52 w-full overflow-visible select-none"
                                role="img"
                                aria-label="Daily Sales Area Chart"
                                onMouseLeave={() => setHoveredIdx(null)}
                            >
                                <defs>
                                    <linearGradient id="bistroSalesFill" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#EA580C" stopOpacity="0.28" />
                                        <stop offset="100%" stopColor="#EA580C" stopOpacity="0.01" />
                                    </linearGradient>
                                </defs>

                                {/* Dashed Y-grid lines */}
                                {[0.25, 0.5, 0.75, 1].map((ratio) => {
                                    const gy = svgH - bottomPad - ratio * (svgH - topPad - bottomPad);
                                    return (
                                        <line
                                            key={ratio}
                                            x1={padX}
                                            x2={svgW - padX}
                                            y1={gy}
                                            y2={gy}
                                            stroke="#EAE4DB"
                                            strokeDasharray="4 4"
                                            strokeWidth="1"
                                        />
                                    );
                                })}

                                {/* Area Fill */}
                                {smoothArea && <path d={smoothArea} fill="url(#bistroSalesFill)" />}

                                {/* Smooth Curve */}
                                {smoothLine && (
                                    <motion.path
                                        initial={{ pathLength: 0, opacity: 0.6 }}
                                        animate={{ pathLength: 1, opacity: 1 }}
                                        transition={{ duration: 0.65, ease: 'easeOut' }}
                                        d={smoothLine}
                                        fill="none"
                                        stroke="#EA580C"
                                        strokeWidth="2.8"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                )}

                                {/* Vertical Active Indicator */}
                                {activePoint && (
                                    <line
                                        x1={activePoint.x}
                                        x2={activePoint.x}
                                        y1={topPad - 4}
                                        y2={svgH - bottomPad}
                                        stroke="#EA580C"
                                        strokeOpacity="0.28"
                                        strokeDasharray="3 3"
                                        strokeWidth="1.2"
                                    />
                                )}

                                {/* Interactive Data Nodes */}
                                {coords.map(({ x, y, pt }, idx) => {
                                    const isActive = idx === activeIdx;
                                    return (
                                        <g
                                            key={pt.hour}
                                            onMouseEnter={() => setHoveredIdx(idx)}
                                            className="cursor-pointer"
                                        >
                                            <rect
                                                x={x - 16}
                                                y={0}
                                                width={32}
                                                height={svgH - bottomPad}
                                                fill="transparent"
                                            />
                                            {(pt.revenueCents > 0 || isActive) && (
                                                <circle
                                                    cx={x}
                                                    cy={y}
                                                    r={isActive ? 5.5 : 3.5}
                                                    fill={isActive ? '#EA580C' : '#FFFFFF'}
                                                    stroke="#EA580C"
                                                    strokeWidth={isActive ? 2.5 : 2}
                                                />
                                            )}
                                            {idx % 3 === 0 && (
                                                <text
                                                    x={x}
                                                    y={svgH - 6}
                                                    textAnchor="middle"
                                                    className="fill-muted-foreground text-[10px] font-mono"
                                                >
                                                    {pt.label}
                                                </text>
                                            )}
                                        </g>
                                    );
                                })}

                                {/* Floating Tooltip Pill */}
                                {activePoint && (
                                    <g
                                        transform={`translate(${Math.min(svgW - 122, Math.max(12, activePoint.x - 55))}, ${Math.max(2, activePoint.y - 34)})`}
                                    >
                                        <rect
                                            width="112"
                                            height="24"
                                            rx="12"
                                            fill="#181512"
                                        />
                                        <text
                                            x="56"
                                            y="15.5"
                                            textAnchor="middle"
                                            className="fill-white text-[10px] font-mono font-semibold"
                                        >
                                            {activePoint.pt.label} · {formatCents(activePoint.pt.revenueCents)}
                                        </text>
                                    </g>
                                )}
                            </svg>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="border-b border-border/60 bg-[var(--surface-inset)]/60">
                            <CardTitle>Sales by Category</CardTitle>
                            <CardDescription>Share of paid culinary revenue</CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-col items-center gap-5 p-5 sm:p-6">
                            <div className="relative flex h-36 w-36 items-center justify-center">
                                <svg viewBox="0 0 120 120" className="h-36 w-36 -rotate-90">
                                    <circle
                                        cx="60"
                                        cy="60"
                                        r="46"
                                        fill="none"
                                        stroke="#F3EFE8"
                                        strokeWidth="14"
                                    />
                                    {salesByCategory.map((cat, idx) => {
                                        const dash = (cat.shareBps / 10000) * donutCircumference;
                                        const offset = -catOffset;
                                        catOffset += dash;
                                        return (
                                            <motion.circle
                                                key={cat.categoryId}
                                                initial={{ strokeDashoffset: donutCircumference }}
                                                animate={{ strokeDashoffset: offset }}
                                                transition={{ duration: 0.6, delay: idx * 0.06 }}
                                                cx="60"
                                                cy="60"
                                                r="46"
                                                fill="none"
                                                stroke={CATEGORY_COLORS[idx % CATEGORY_COLORS.length]}
                                                strokeWidth="14"
                                                strokeDasharray={`${dash} ${donutCircumference}`}
                                            />
                                        );
                                    })}
                                </svg>
                                <div className="absolute text-center">
                                    <div className="ds-num-sm font-bold text-foreground">
                                        {formatCents(metrics.totalRevenueCents)}
                                    </div>
                                    <div className="ds-overline mt-0.5">Revenue</div>
                                </div>
                            </div>

                            <div className="w-full space-y-2.5 text-xs">
                                {salesByCategory.length === 0 ? (
                                    <p className="py-3 text-center text-muted-foreground">
                                        No paid category sales recorded yet.
                                    </p>
                                ) : (
                                    salesByCategory.map((cat, idx) => (
                                        <div
                                            key={cat.categoryId}
                                            className="flex items-center justify-between gap-2 rounded-xl bg-[var(--surface-inset)] px-3 py-2"
                                        >
                                            <div className="flex min-w-0 items-center gap-2">
                                                <span
                                                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                                                    style={{
                                                        backgroundColor:
                                                            CATEGORY_COLORS[idx % CATEGORY_COLORS.length],
                                                    }}
                                                />
                                                <span className="truncate font-medium text-foreground">
                                                    {cat.categoryName}
                                                </span>
                                            </div>
                                            <span className="shrink-0 font-mono font-semibold text-muted-foreground tabular-nums">
                                                {formatCents(cat.revenueCents)} · {formatBps(cat.shareBps)}
                                            </span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Live Floor Operations & Table Mix */}
                <div className="grid gap-5 lg:grid-cols-3">
                    <Card className="lg:col-span-2">
                        <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-border/60 bg-[var(--surface-inset)]/60">
                            <div className="min-w-0">
                                <CardTitle>Live Orders</CardTitle>
                                <CardDescription>Active dining room tabs &amp; takeaway queues</CardDescription>
                            </div>
                            <Link
                                href="/orders"
                                className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-primary hover:underline"
                            >
                                <span>View all</span>
                                <ArrowRight className="h-3.5 w-3.5" />
                            </Link>
                        </CardHeader>
                        <CardContent className="p-4 sm:p-5">
                            {liveOrders.length === 0 ? (
                                <p className="py-8 text-center text-sm text-muted-foreground">
                                    No open orders at the moment. Open a tab from POS Register or Floor Plan.
                                </p>
                            ) : (
                                <div className="space-y-2">
                                    {liveOrders.map((order) => {
                                        const itemCount = order.items
                                            .filter((i) => i.prep_state !== 'voided')
                                            .reduce((sum, i) => sum + i.quantity, 0);

                                        return (
                                            <Link
                                                key={order.id}
                                                href={`/pos?order_id=${order.id}`}
                                                className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 rounded-xl border border-border/80 bg-[var(--surface-inset)]/60 px-3.5 py-3 transition hover:border-primary/30 hover:bg-card"
                                            >
                                                <div className="min-w-0 flex-1">
                                                    <div className="truncate text-sm font-semibold text-foreground">
                                                        {order.order_number} ·{' '}
                                                        {order.table_code
                                                            ? `Table ${order.table_code}`
                                                            : order.customer_name || 'Takeaway'}
                                                    </div>
                                                    <div className="ds-caption truncate">
                                                        {itemCount} items · {order.server_name ?? 'Staff'}
                                                    </div>
                                                </div>
                                                <div className="flex shrink-0 items-center gap-2.5">
                                                    <StatusPill
                                                        tone={
                                                            order.state === 'partially_paid'
                                                                ? 'warning'
                                                                : 'brand'
                                                        }
                                                        pulse={order.state === 'open'}
                                                        label={order.state.replace('_', ' ')}
                                                    />
                                                    <span className="ds-num-sm text-foreground">
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

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-border/60 bg-[var(--surface-inset)]/60">
                            <div className="min-w-0">
                                <CardTitle>Table Status</CardTitle>
                                <CardDescription>Live dining room mix</CardDescription>
                            </div>
                            <Link
                                href="/tables"
                                className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-primary hover:underline"
                            >
                                <span>Floor plan</span>
                                <ArrowRight className="h-3.5 w-3.5" />
                            </Link>
                        </CardHeader>
                        <CardContent className="flex flex-col items-center gap-5 p-5 sm:p-6">
                            <div className="relative flex h-32 w-32 items-center justify-center">
                                <svg viewBox="0 0 120 120" className="h-32 w-32 -rotate-90">
                                    <circle
                                        cx="60"
                                        cy="60"
                                        r="46"
                                        fill="none"
                                        stroke="#F3EFE8"
                                        strokeWidth="14"
                                    />
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
                                <div className="absolute text-center">
                                    <div className="ds-num-md">{tableStatusCounts.total}</div>
                                    <div className="ds-overline mt-0.5">Tables</div>
                                </div>
                            </div>

                            <div className="grid w-full grid-cols-2 gap-2.5 text-xs">
                                {tableSegments.map((seg) => (
                                    <div
                                        key={seg.label}
                                        className="flex items-center justify-between rounded-xl border border-border/70 bg-[var(--surface-inset)] px-3 py-2"
                                    >
                                        <span className="flex min-w-0 items-center gap-1.5 truncate">
                                            <span
                                                className="h-2 w-2 shrink-0 rounded-full"
                                                style={{ backgroundColor: seg.color }}
                                            />
                                            <span className="truncate">{seg.label}</span>
                                        </span>
                                        <span className="font-mono font-bold tabular-nums">{seg.count}</span>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Trending & Out of Stock */}
                <div className="grid gap-5 lg:grid-cols-2">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-border/60 bg-[var(--surface-inset)]/60">
                            <div>
                                <CardTitle className="flex items-center gap-2">
                                    <Flame className="h-4 w-4 text-primary" />
                                    <span>Trending Dishes</span>
                                </CardTitle>
                                <CardDescription>Top revenue items today</CardDescription>
                            </div>
                            <Link
                                href="/reports"
                                className="shrink-0 text-xs font-semibold text-primary hover:underline"
                            >
                                Full report →
                            </Link>
                        </CardHeader>
                        <CardContent className="space-y-2.5 p-4 sm:p-5">
                            {metrics.topProducts.length === 0 ? (
                                <p className="py-6 text-center text-sm text-muted-foreground">
                                    No dish sales recorded yet today.
                                </p>
                            ) : (
                                metrics.topProducts.slice(0, 4).map((product, index) => (
                                    <div
                                        key={product.menuItemVariantId}
                                        className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-[var(--surface-inset)]/70 px-3.5 py-3 text-sm"
                                    >
                                        <div className="flex min-w-0 items-center gap-3">
                                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent font-mono text-xs font-bold text-primary">
                                                #{index + 1}
                                            </span>
                                            <div className="min-w-0">
                                                <div className="truncate font-semibold text-foreground">
                                                    {product.itemName}
                                                </div>
                                                <div className="ds-caption truncate">
                                                    {product.variantName} · {product.quantitySold} sold
                                                </div>
                                            </div>
                                        </div>
                                        <span className="ds-num-sm shrink-0 text-foreground">
                                            {formatCents(product.revenueCents)}
                                        </span>
                                    </div>
                                ))
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-border/60 bg-[var(--surface-inset)]/60">
                            <div>
                                <CardTitle>Out of Stock (86’d)</CardTitle>
                                <CardDescription>Items temporarily held at this branch</CardDescription>
                            </div>
                            <Link
                                href="/menu"
                                className="shrink-0 text-xs font-semibold text-primary hover:underline"
                            >
                                Manage menu →
                            </Link>
                        </CardHeader>
                        <CardContent className="space-y-2.5 p-4 sm:p-5">
                            {outOfStockItems.length === 0 ? (
                                <p className="py-6 text-center text-sm text-muted-foreground">
                                    All menu items are currently available.
                                </p>
                            ) : (
                                outOfStockItems.map((item) => (
                                    <div
                                        key={item.variant_id}
                                        className="flex items-center justify-between gap-3 rounded-xl border border-rose-500/20 bg-rose-500/8 px-3.5 py-3 text-sm"
                                    >
                                        <div className="flex min-w-0 items-center gap-3">
                                            {item.image_path ? (
                                                <img
                                                    src={item.image_path}
                                                    alt={item.item_name}
                                                    className="h-10 w-10 shrink-0 rounded-lg object-cover ring-1 ring-rose-500/20"
                                                />
                                            ) : (
                                                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-rose-500/15 text-rose-600">
                                                    <AlertCircle className="h-4.5 w-4.5" />
                                                </span>
                                            )}
                                            <div className="min-w-0">
                                                <div className="truncate font-semibold text-rose-950">
                                                    {item.item_name} ({item.variant_name})
                                                </div>
                                                <div className="truncate text-xs text-rose-700">
                                                    {item.reason}
                                                </div>
                                            </div>
                                        </div>
                                        <StatusPill tone="danger" dot={false} label="86’d" className="shrink-0" />
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
