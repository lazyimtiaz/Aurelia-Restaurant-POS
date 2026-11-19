import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] select-none cursor-pointer',
    {
        variants: {
            variant: {
                default:
                    'bg-primary text-primary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_1px_2px_rgba(24,21,18,0.12)] hover:bg-[#c2410c]',
                amber:
                    'bg-amber-500 text-stone-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_1px_2px_rgba(24,21,18,0.1)] hover:bg-amber-400',
                emerald:
                    'bg-emerald-600 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_1px_2px_rgba(24,21,18,0.12)] hover:bg-emerald-700',
                destructive:
                    'bg-destructive text-destructive-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_1px_2px_rgba(24,21,18,0.12)] hover:bg-rose-700',
                outline:
                    'border border-border bg-card text-foreground shadow-[0_1px_2px_rgba(24,21,18,0.04)] hover:bg-secondary/70 hover:border-[#dcd4c7]',
                secondary:
                    'bg-secondary text-secondary-foreground hover:bg-[#eae4db]',
                ghost: 'text-foreground hover:bg-secondary/80',
            },
            size: {
                default: 'min-h-10 px-4 py-2',
                sm: 'min-h-8 rounded-lg px-3 py-1.5 text-xs',
                lg: 'min-h-11 rounded-xl px-5 py-2.5 text-sm',
                xl: 'min-h-12 rounded-xl px-6 py-3 text-base',
                icon: 'h-10 w-10 p-0 rounded-xl',
            },
        },
        defaultVariants: {
            variant: 'default',
            size: 'default',
        },
    },
);

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
        VariantProps<typeof buttonVariants> {
    asChild?: boolean;
    loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, size, asChild = false, loading = false, disabled, children, ...props }, ref) => {
        const Comp = asChild ? Slot : 'button';

        if (asChild) {
            return (
                <Comp
                    className={cn(buttonVariants({ variant, size, className }))}
                    ref={ref}
                    {...props}
                >
                    {children}
                </Comp>
            );
        }

        return (
            <Comp
                className={cn(buttonVariants({ variant, size, className }))}
                ref={ref}
                disabled={disabled || loading}
                aria-busy={loading || undefined}
                {...props}
            >
                {loading && <Loader2 className="h-4 w-4 animate-spin shrink-0" />}
                {children}
            </Comp>
        );
    },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
