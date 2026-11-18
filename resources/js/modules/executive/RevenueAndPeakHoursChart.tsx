import { motion } from 'motion/react';
import { BarChart3, Award } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCents } from '@/lib/money';
import type { HourlySalesPointData, TopProductRowData } from '@/types/executive';

interface RevenueAndPeakHoursChartProps {
    hourlySales: HourlySalesPointData[];
    topProducts: TopProductRowData[];
}

export function RevenueAndPeakHoursChart({ hourlySales, topProducts }: RevenueAndPeakHoursChartProps) {
    const maxHourlyRevenue = Math.max(100, ...hourlySales.map((point) => point.revenueCents));
    const peakHour = hourlySales.reduce(
        (best, curr) => (curr.revenueCents > best.revenueCents ? curr : best),
        hourlySales[0] ?? { hour: 0, label: '00:00', revenueCents: 0, ordersCount: 0 },
    );

    const chartWidth = 720;
    const chartHeight = 180;
    const barGap = 4;
    const barWidth = (chartWidth - barGap * 23) / 24;

    return (
        <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
                <CardHeader>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <BarChart3 className="h-4 w-4 text-primary" />
                                24-Hour Peak Dining Throughput
                            </CardTitle>
                            <CardDescription>
                                Hourly net revenue curve aggregated across paid orders without cross-branch drift.
                            </CardDescription>
                        </div>
                        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-800">
                            Peak Hour: <span className="font-mono font-bold">{peakHour.label}</span> (
                            {formatCents(peakHour.revenueCents)})
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="w-full overflow-x-auto">
                        <svg
                            viewBox={`0 0 ${chartWidth} ${chartHeight + 28}`}
                            className="h-56 w-full min-w-[540px]"
                            role="img"
                            aria-label="24-hour revenue bar chart"
                        >
                            {hourlySales.map((point, index) => {
                                const ratio = point.revenueCents / maxHourlyRevenue;
                                const height = Math.max(point.revenueCents > 0 ? 8 : 3, Math.round(ratio * chartHeight));
                                const x = index * (barWidth + barGap);
                                const y = chartHeight - height;
                                const isPeak = point.hour === peakHour.hour && point.revenueCents > 0;

                                return (
                                    <g key={point.hour}>
                                        <title>
                                            {`${point.label}: ${formatCents(point.revenueCents)} (${point.ordersCount} orders)`}
                                        </title>
                                        <motion.rect
                                            x={x}
                                            y={y}
                                            width={barWidth}
                                            height={height}
                                            rx={4}
                                            initial={{ scaleY: 0 }}
                                            animate={{ scaleY: 1 }}
                                            transition={{ duration: 0.35, delay: index * 0.012 }}
                                            style={{ transformOrigin: `${x + barWidth / 2}px ${chartHeight}px` }}
                                            className={
                                                isPeak
                                                    ? 'fill-amber-500'
                                                    : point.revenueCents > 0
                                                      ? 'fill-emerald-500/80 hover:fill-amber-400 transition-colors'
                                                      : 'fill-muted'
                                            }
                                        />
                                        {index % 3 === 0 && (
                                            <text
                                                x={x + barWidth / 2}
                                                y={chartHeight + 18}
                                                textAnchor="middle"
                                                className="fill-muted-foreground text-[10px] font-mono"
                                            >
                                                {point.hour.toString().padStart(2, '0')}h
                                            </text>
                                        )}
                                    </g>
                                );
                            })}
                        </svg>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Award className="h-4 w-4 text-amber-500" />
                        Top Revenue Dishes
                    </CardTitle>
                    <CardDescription>Ranked by gross item revenue sold</CardDescription>
                </CardHeader>
                <CardContent>
                    {topProducts.length === 0 ? (
                        <p className="py-8 text-center text-sm text-muted-foreground">
                            No paid order items recorded in the selected scope yet.
                        </p>
                    ) : (
                        <div className="space-y-3">
                            {topProducts.slice(0, 6).map((product, index) => (
                                <div
                                    key={product.menuItemVariantId}
                                    className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-muted/30 px-3 py-2 text-sm"
                                >
                                    <div className="min-w-0">
                                        <div className="truncate font-medium">
                                            {index + 1}. {product.itemName}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            {product.variantName} · {product.quantitySold} sold
                                        </div>
                                    </div>
                                    <span className="shrink-0 font-mono font-semibold text-foreground">
                                        {formatCents(product.revenueCents)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
