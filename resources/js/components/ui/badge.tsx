import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
    'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide whitespace-nowrap transition-colors',
    {
        variants: {
            variant: {
                default: 'border-primary/20 bg-primary/10 text-primary',
                secondary: 'border-border bg-secondary text-secondary-foreground',
                outline: 'border-border bg-card text-foreground',
                success: 'border-emerald-500/25 bg-emerald-500/12 text-emerald-700',
                warning: 'border-amber-500/30 bg-amber-500/12 text-amber-800',
                destructive: 'border-rose-500/25 bg-rose-500/12 text-rose-700',
                info: 'border-sky-500/25 bg-sky-500/12 text-sky-700',
            },
        },
        defaultVariants: {
            variant: 'default',
        },
    },
);

export interface BadgeProps
    extends React.HTMLAttributes<HTMLSpanElement>,
        VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
    return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
