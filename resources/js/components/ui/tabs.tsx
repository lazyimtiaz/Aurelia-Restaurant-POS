import * as React from 'react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';

interface TabsContextValue {
    value: string;
    onValueChange: (value: string) => void;
    layoutId: string;
}

const TabsContext = React.createContext<TabsContextValue | null>(null);

interface TabsProps {
    defaultValue?: string;
    value?: string;
    onValueChange?: (value: string) => void;
    className?: string;
    children: React.ReactNode;
}

function Tabs({ defaultValue = '', value, onValueChange, className, children }: TabsProps) {
    const [internalValue, setInternalValue] = React.useState(defaultValue);
    const uid = React.useId();
    const activeValue = value !== undefined ? value : internalValue;

    const handleChange = React.useCallback(
        (next: string) => {
            if (value === undefined) {
                setInternalValue(next);
            }
            onValueChange?.(next);
        },
        [value, onValueChange],
    );

    return (
        <TabsContext.Provider value={{ value: activeValue, onValueChange: handleChange, layoutId: `tabs-${uid}` }}>
            <div className={cn('w-full', className)}>{children}</div>
        </TabsContext.Provider>
    );
}

interface TabsListProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
}

function TabsList({ className, children, ...props }: TabsListProps) {
    return (
        <div
            role="tablist"
            className={cn(
                'inline-flex max-w-full items-center gap-1 overflow-x-auto no-scrollbar rounded-xl border border-border bg-[var(--surface-inset)] p-1',
                className,
            )}
            {...props}
        >
            {children}
        </div>
    );
}

interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    value: string;
}

function TabsTrigger({ value, className, children, onClick, ...props }: TabsTriggerProps) {
    const context = React.useContext(TabsContext);
    if (!context) {
        throw new Error('TabsTrigger must be used within Tabs');
    }
    const isActive = context.value === value;

    return (
        <button
            type="button"
            role="tab"
            aria-selected={isActive}
            data-state={isActive ? 'active' : 'inactive'}
            onClick={(e) => {
                context.onValueChange(value);
                onClick?.(e);
            }}
            className={cn(
                'relative inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-1.5 text-xs sm:text-[13px] font-semibold transition-colors cursor-pointer select-none',
                isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                className,
            )}
            {...props}
        >
            {isActive && (
                <motion.span
                    layoutId={context.layoutId}
                    transition={{ type: 'spring', stiffness: 450, damping: 34 }}
                    className="absolute inset-0 rounded-lg bg-card shadow-[0_1px_3px_rgba(24,21,18,0.08)] border border-border/80"
                />
            )}
            <span className="relative z-10 inline-flex items-center gap-1.5">{children}</span>
        </button>
    );
}

interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
    value: string;
}

function TabsContent({ value, className, children, ...props }: TabsContentProps) {
    const context = React.useContext(TabsContext);
    if (!context || context.value !== value) {
        return null;
    }

    return (
        <div role="tabpanel" className={cn('mt-4', className)} {...props}>
            {children}
        </div>
    );
}

export interface AnimatedTabItem<T extends string = string> {
    id: T;
    label: string;
    count?: number;
    icon?: React.ReactNode;
}

interface AnimatedTabsProps<T extends string = string> {
    items: AnimatedTabItem<T>[];
    value: T;
    onChange: (id: T) => void;
    layoutId?: string;
    wrap?: boolean;
    className?: string;
    variant?: 'light' | 'dark';
}

function AnimatedTabs<T extends string = string>({
    items,
    value,
    onChange,
    layoutId,
    wrap = false,
    className,
    variant = 'light',
}: AnimatedTabsProps<T>) {
    const uid = React.useId();
    const sharedLayoutId = layoutId ?? `animated-tabs-${uid}`;

    return (
        <div
            role="tablist"
            className={cn(
                'inline-flex max-w-full items-center gap-1 rounded-xl border p-1',
                wrap ? 'flex-wrap' : 'overflow-x-auto no-scrollbar',
                variant === 'dark'
                    ? 'border-slate-800 bg-[#161922]'
                    : 'border-border bg-[var(--surface-inset)]',
                className,
            )}
        >
            {items.map((item) => {
                const isActive = value === item.id;
                return (
                    <button
                        key={item.id}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        onClick={() => onChange(item.id)}
                        className={cn(
                            'relative inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-2 text-xs sm:text-[13px] font-semibold transition-colors cursor-pointer select-none',
                            isActive
                                ? variant === 'dark'
                                    ? 'text-white'
                                    : 'text-foreground'
                                : variant === 'dark'
                                  ? 'text-slate-400 hover:text-slate-200'
                                  : 'text-muted-foreground hover:text-foreground',
                        )}
                    >
                        {isActive && (
                            <motion.span
                                layoutId={sharedLayoutId}
                                transition={{ type: 'spring', stiffness: 450, damping: 34 }}
                                className={cn(
                                    'absolute inset-0 rounded-lg border',
                                    variant === 'dark'
                                        ? 'border-orange-500/30 bg-slate-800 shadow-sm'
                                        : 'border-border bg-card shadow-[0_1px_3px_rgba(24,21,18,0.08)]',
                                )}
                            />
                        )}
                        <span className="relative z-10 inline-flex items-center gap-1.5">
                            {item.icon}
                            <span>{item.label}</span>
                            {typeof item.count === 'number' && (
                                <span
                                    className={cn(
                                        'rounded-full px-1.5 py-0.5 font-mono text-[10px] font-bold tabular-nums',
                                        isActive
                                            ? variant === 'dark'
                                                ? 'bg-orange-500/20 text-orange-300'
                                                : 'bg-primary/12 text-primary'
                                            : variant === 'dark'
                                              ? 'bg-slate-800 text-slate-400'
                                              : 'bg-secondary text-muted-foreground',
                                    )}
                                >
                                    {item.count}
                                </span>
                            )}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}

export { Tabs, TabsList, TabsTrigger, TabsContent, AnimatedTabs };
