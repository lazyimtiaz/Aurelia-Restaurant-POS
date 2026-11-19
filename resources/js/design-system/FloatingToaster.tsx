import * as React from 'react';
import { usePage } from '@inertiajs/react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PosSharedProps } from '@/types/pos-app';

type ToastTone = 'success' | 'error' | 'info';

interface ToastItem {
    id: string;
    tone: ToastTone;
    message: string;
}

export function dispatchToast(tone: ToastTone, message: string) {
    window.dispatchEvent(new CustomEvent('aurelia:toast', { detail: { tone, message } }));
}

export function FloatingToaster({ variant = 'light' }: { variant?: 'light' | 'dark' }) {
    const { flash } = usePage<PosSharedProps>().props;
    const [toasts, setToasts] = React.useState<ToastItem[]>([]);
    const lastFlashKeyRef = React.useRef<string>('');

    const pushToast = React.useCallback((tone: ToastTone, message: string) => {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        setToasts((prev) => [...prev.slice(-2), { id, tone, message }]);
        window.setTimeout(() => {
            setToasts((prev) => prev.filter((item) => item.id !== id));
        }, 4500);
    }, []);

    React.useEffect(() => {
        const flashKey = JSON.stringify([flash?.success ?? null, flash?.error ?? null]);
        if (flashKey === lastFlashKeyRef.current) {
            return;
        }
        lastFlashKeyRef.current = flashKey;

        if (flash?.success) pushToast('success', flash.success);
        if (flash?.error) pushToast('error', flash.error);
    }, [flash?.success, flash?.error, pushToast]);

    React.useEffect(() => {
        const handler = (event: Event) => {
            const customEvent = event as CustomEvent<{ tone: ToastTone; message: string }>;
            if (customEvent.detail?.message) {
                pushToast(customEvent.detail.tone ?? 'info', customEvent.detail.message);
            }
        };
        window.addEventListener('aurelia:toast', handler);
        return () => window.removeEventListener('aurelia:toast', handler);
    }, [pushToast]);

    return (
        <div
            aria-live="polite"
            className="pointer-events-none fixed top-4 left-4 right-4 sm:left-auto sm:right-6 z-50 flex flex-col items-center sm:items-end gap-2"
        >
            <AnimatePresence mode="popLayout">
                {toasts.map((toast) => {
                    const icon =
                        toast.tone === 'success' ? (
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                        ) : toast.tone === 'error' ? (
                            <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
                        ) : (
                            <Info className="h-4 w-4 shrink-0 text-amber-500" />
                        );

                    return (
                        <motion.div
                            key={toast.id}
                            layout
                            initial={{ opacity: 0, y: -12, scale: 0.96 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -8, scale: 0.96 }}
                            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                            className={cn(
                                'pointer-events-auto flex w-full max-w-md items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm font-medium shadow-bistro-floating backdrop-blur-md',
                                variant === 'dark'
                                    ? 'border-slate-700 bg-[#161922]/95 text-slate-100'
                                    : toast.tone === 'error'
                                      ? 'border-rose-200 bg-white/95 text-rose-800'
                                      : toast.tone === 'success'
                                        ? 'border-emerald-200 bg-white/95 text-emerald-900'
                                        : 'border-border bg-white/95 text-foreground',
                            )}
                        >
                            <div className="flex min-w-0 items-center gap-2.5">
                                {icon}
                                <span className="truncate">{toast.message}</span>
                            </div>
                            <button
                                type="button"
                                onClick={() =>
                                    setToasts((prev) => prev.filter((item) => item.id !== toast.id))
                                }
                                aria-label="Dismiss notification"
                                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary/70 hover:text-foreground cursor-pointer"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        </motion.div>
                    );
                })}
            </AnimatePresence>
        </div>
    );
}
