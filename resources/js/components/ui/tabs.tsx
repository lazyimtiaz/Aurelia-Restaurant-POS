import * as React from 'react';
import { cn } from '@/lib/utils';

interface TabsContextValue {
    value: string;
    onValueChange: (nextValue: string) => void;
}

const TabsContext = React.createContext<TabsContextValue | null>(null);

interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
    value: string;
    onValueChange: (value: string) => void;
}

export function Tabs({ value, onValueChange, className, children, ...props }: TabsProps) {
    return (
        <TabsContext.Provider value={{ value, onValueChange }}>
            <div className={cn('space-y-4', className)} {...props}>
                {children}
            </div>
        </TabsContext.Provider>
    );
}

export function TabsList({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            role="tablist"
            className={cn(
                'inline-flex flex-wrap items-center gap-1 rounded-xl border border-border bg-muted/60 p-1 text-muted-foreground',
                className,
            )}
            {...props}
        />
    );
}

interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    value: string;
}

export function TabsTrigger({ value, className, children, ...props }: TabsTriggerProps) {
    const context = React.useContext(TabsContext);
    const active = context?.value === value;

    return (
        <button
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => context?.onValueChange(value)}
            className={cn(
                'inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all cursor-pointer',
                active
                    ? 'bg-card text-foreground shadow-sm border border-border'
                    : 'text-muted-foreground hover:text-foreground',
                className,
            )}
            {...props}
        >
            {children}
        </button>
    );
}

interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
    value: string;
}

export function TabsContent({ value, className, children, ...props }: TabsContentProps) {
    const context = React.useContext(TabsContext);
    if (context?.value !== value) {
        return null;
    }

    return (
        <div role="tabpanel" className={cn('focus-visible:outline-none', className)} {...props}>
            {children}
        </div>
    );
}
