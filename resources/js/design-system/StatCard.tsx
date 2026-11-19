import * as React from 'react';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { IconBadge, type IconBadgeTone } from '@/design-system/IconBadge';
import { cn } from '@/lib/utils';

interface StatCardProps {
    label: string;
    value: string | number;
    icon: React.ReactNode;
    tone?: IconBadgeTone;
    subtitle?: string;
    delta?: {
        value: string;
        direction: 'up' | 'down' | 'flat';
    };
    sparkline?: number[];
    className?: string;
}

const sparkStrokeColors: Record<IconBadgeTone, string> = {
    orange: '#EA580C',
    emerald: '#16A34A',
    amber: '#D97706',
    rose: '#E11D48',
    sky: '#0284C7',
    slate: '#57534E',
};

function buildSparklinePath(values: number[], width: number, height: number): string {
    if (values.length < 2) {
        return '';
    }
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    const stepX = width / (values.length - 1);

    return values
        .map((val, idx) => {
            const x = Number((idx * stepX).toFixed(2));
            const y = Number((height - ((val - min) / span) * (height - 4) - 2).toFixed(2));
            return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
        })
        .join(' ');
}

export function StatCard({
    label,
    value,
    icon,
    tone = 'orange',
    subtitle,
    delta,
    sparkline,
    className,
}: StatCardProps) {
    const sparkPath = React.useMemo(
        () => (sparkline && sparkline.length >= 2 ? buildSparklinePath(sparkline, 64, 26) : ''),
        [sparkline],
    );

    return (
        <Card variant="interactive" className={cn('min-w-0 overflow-hidden', className)}>
            <CardContent className="p-5 sm:p-6">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                        <IconBadge tone={tone} size="md">
                            {icon}
                        </IconBadge>
                        <div className="min-w-0">
                            <p className="ds-overline truncate">{label}</p>
                        </div>
                    </div>
                    {delta && (
                        <span
                            className={cn(
                                'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums',
                                delta.direction === 'up' && 'bg-emerald-500/12 text-emerald-700',
                                delta.direction === 'down' && 'bg-rose-500/12 text-rose-700',
                                delta.direction === 'flat' && 'bg-secondary text-muted-foreground',
                            )}
                        >
                            {delta.direction === 'up' && <TrendingUp className="h-3 w-3" />}
                            {delta.direction === 'down' && <TrendingDown className="h-3 w-3" />}
                            <span>{delta.value}</span>
                        </span>
                    )}
                </div>

                <div className="mt-4 flex items-end justify-between gap-3">
                    <div className="min-w-0">
                        <div className="ds-num-lg truncate text-foreground">{value}</div>
                        {subtitle && <p className="ds-caption mt-1 truncate">{subtitle}</p>}
                    </div>
                    {sparkPath && (
                        <svg
                            viewBox="0 0 64 26"
                            aria-hidden="true"
                            className="h-7 w-16 shrink-0 overflow-visible"
                        >
                            <path
                                d={sparkPath}
                                fill="none"
                                stroke={sparkStrokeColors[tone]}
                                strokeWidth="2.2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
