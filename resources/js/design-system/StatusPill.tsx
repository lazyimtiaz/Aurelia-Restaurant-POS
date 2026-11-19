import * as React from 'react';
import { cn } from '@/lib/utils';

export type StatusPillTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'brand';

interface StatusPillProps {
    tone?: StatusPillTone;
    label: string;
    pulse?: boolean;
    dot?: boolean;
    icon?: React.ReactNode;
    size?: 'sm' | 'md';
    className?: string;
}

const toneClasses: Record<StatusPillTone, string> = {
    neutral: 'border-border bg-secondary text-secondary-foreground',
    success: 'border-emerald-500/25 bg-emerald-500/12 text-emerald-700',
    warning: 'border-amber-500/30 bg-amber-500/12 text-amber-800',
    danger: 'border-rose-500/25 bg-rose-500/12 text-rose-700',
    info: 'border-sky-500/25 bg-sky-500/12 text-sky-700',
    brand: 'border-primary/25 bg-primary/10 text-primary',
};

const dotClasses: Record<StatusPillTone, string> = {
    neutral: 'bg-stone-400',
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    danger: 'bg-rose-500',
    info: 'bg-sky-500',
    brand: 'bg-primary',
};

export function StatusPill({
    tone = 'neutral',
    label,
    pulse = false,
    dot = true,
    icon,
    size = 'sm',
    className,
}: StatusPillProps) {
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1.5 rounded-full border font-semibold whitespace-nowrap select-none',
                size === 'sm' ? 'px-2.5 py-0.5 text-[11px]' : 'px-3 py-1 text-xs',
                toneClasses[tone],
                className,
            )}
        >
            {icon ? (
                <span className="shrink-0">{icon}</span>
            ) : (
                dot && (
                    <span className="relative flex h-2 w-2 shrink-0 items-center justify-center">
                        {pulse && (
                            <span
                                className={cn(
                                    'absolute inline-flex h-full w-full animate-ping rounded-full opacity-75',
                                    dotClasses[tone],
                                )}
                            />
                        )}
                        <span className={cn('relative inline-flex h-1.5 w-1.5 rounded-full', dotClasses[tone])} />
                    </span>
                )
            )}
            <span>{label}</span>
        </span>
    );
}
