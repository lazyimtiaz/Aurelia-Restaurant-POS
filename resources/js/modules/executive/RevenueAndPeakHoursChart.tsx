import { motion } from 'motion/react';
import { Award, BarChart3 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusPill } from '@/design-system';
import { formatCents } from '@/lib/money';
import type { HourlySalesPointData, TopProductRowData } from '@/types/executive';

interface RevenueAndPeakHoursChartProps {
    hourlySales: HourlySalesPointData[];
    topProducts: TopProductRowData[];
}

export function RevenueAndPeakHoursChart({
    hourlySales,
    topProducts,
}: RevenueAndPeakHoursChartProps) {
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
        <div className="grid gap-5 lg:grid-cols-3">
            <Card className="lg:col-span-2">
                <CardHeader className="border-b border-border/60 bg-[var(--surface-inset)]/60">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                            <CardTitle className="flex items-center gap-2">
                                <BarChart3 className="h-4 w-4 text-primary" />
                                <span>24-Hour Peak Dining Throughput</span>
                            </CardTitle>
                            <CardDescription>
                                Hourly net revenue distribution across settled dining checks.
                            </CardDescription>
                        </div>
                        <StatusPill
                            tone="warning"
                            dot={false}
                            label={`Peak ${peakHour.label} · ${formatCents(peakHour.revenueCents)}`}
                            className="font-mono"
                        />
                    </div>
                </CardHeader>
                <CardContent className="p-4 sm:p-6">
                    <div className="w-full overflow-x-auto no-scrollbar">
                        <svg
                            viewBox={`0 0 ${chartWidth} ${chartHeight + 28}`}
                            className="h-56 w-full min-w-[500px]"
                            role="img"
                            aria-label="24-hour revenue bar chart"
                        >
                            {[0.25, 0.5, 0.75, 1].map((ratio) => {
                                const y = chartHeight - ratio * chartHeight;
                                return (
                                    <line
                                        key={ratio}
                                        x1={0}
                                        x2={chartWidth}
                                        y1={y}
                                        y2={y}
                                        stroke="#EAE4DB"
                                        strokeDasharray="4 4"
                                        strokeWidth="1"
                                    />
                                );
                            })}

                            {hourlySales.map((point, index) => {
                                const ratio = point.revenueCents / maxHourlyRevenue;
                                const height = Math.max(
                                    point.revenueCents > 0 ? 8 : 3,
                                    Math.round(ratio * chartHeight),
                                );
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
                                            rx={5}
                                            initial={{ scaleY: 0 }}
                                            animate={{ scaleY: 1 }}
                                            transition={{ duration: 0.35, delay: index * 0.012 }}
                                            style={{ transformOrigin: `${x + barWidth / 2}px ${chartHeight}px` }}
                                            className={
                                                isPeak
                                                    ? 'fill-[#EA580C]'
                                                    : point.revenueCents > 0
                                                      ? 'fill-emerald-600/80 hover:fill-[#EA580C] transition-colors'
                                                      : 'fill-[#EAE4DB]'
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
                <CardHeader className="border-b border-border/60 bg-[var(--surface-inset)]/60">
                    <CardTitle className="flex items-center gap-2">
                        <Award className="h-4 w-4 text-primary" />
                        <span>Top Revenue Dishes</span>
                    </CardTitle>
                    <CardDescription>Ranked by gross item revenue sold</CardDescription>
                </CardHeader>
                <CardContent className="p-4 sm:p-5">
                    {topProducts.length === 0 ? (
                        <p className="py-8 text-center text-sm text-muted-foreground">
                            No paid order items recorded in the selected scope yet.
                        </p>
                    ) : (
                        <div className="space-y-2.5">
                            {topProducts.slice(0, 6).map((product, index) => (
                                <div
                                    key={product.menuItemVariantId}
                                    className="flex items-center justify-between gap-3 rounded-xl border border-border/80 bg-[var(--surface-inset)] px-3.5 py-2.5 text-sm"
                                >
                                    <div className="min-w-0">
                                        <div className="truncate font-semibold text-foreground">
                                            {index + 1}. {product.itemName}
                                        </div>
                                        <div className="ds-caption">
                                            {product.variantName} · {product.quantitySold} sold
                                        </div>
                                    </div>
                                    <span className="ds-num-sm shrink-0 text-foreground">
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
