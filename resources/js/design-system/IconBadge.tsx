import * as React from 'react';
import { cn } from '@/lib/utils';

export type IconBadgeTone = 'orange' | 'emerald' | 'amber' | 'rose' | 'sky' | 'slate';

interface IconBadgeProps {
    tone?: IconBadgeTone;
    size?: 'sm' | 'md' | 'lg';
    shape?: 'circle' | 'squircle';
    className?: string;
    children: React.ReactNode;
}

const toneClasses: Record<IconBadgeTone, string> = {
    orange: 'bg-orange-500/12 text-[#EA580C] ring-1 ring-orange-500/20',
    emerald: 'bg-emerald-500/12 text-emerald-600 ring-1 ring-emerald-500/20',
    amber: 'bg-amber-500/15 text-amber-700 ring-1 ring-amber-500/25',
    rose: 'bg-rose-500/12 text-rose-600 ring-1 ring-rose-500/20',
    sky: 'bg-sky-500/12 text-sky-600 ring-1 ring-sky-500/20',
    slate: 'bg-stone-500/10 text-stone-700 ring-1 ring-stone-500/15',
};

const sizeClasses: Record<NonNullable<IconBadgeProps['size']>, string> = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-11 w-11',
};

export function IconBadge({
    tone = 'orange',
    size = 'md',
    shape = 'circle',
    className,
    children,
}: IconBadgeProps) {
    return (
        <span
            className={cn(
                'inline-flex shrink-0 items-center justify-center transition-transform duration-150',
                shape === 'circle' ? 'rounded-full' : 'rounded-xl',
                sizeClasses[size],
                toneClasses[tone],
                className,
            )}
        >
            {children}
        </span>
    );
}
