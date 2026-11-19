import * as React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ModalMaxWidth = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl';

const maxWidthClasses: Record<ModalMaxWidth, string> = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '4xl': 'max-w-4xl',
};

interface MotionModalProps {
    open: boolean;
    onClose: () => void;
    title?: React.ReactNode;
    description?: React.ReactNode;
    icon?: React.ReactNode;
    maxWidth?: ModalMaxWidth;
    preventBackdropClose?: boolean;
    hideCloseButton?: boolean;
    hideHeader?: boolean;
    className?: string;
    bodyClassName?: string;
    children: React.ReactNode;
}

export function MotionModal({
    open,
    onClose,
    title,
    description,
    icon,
    maxWidth = 'md',
    preventBackdropClose = false,
    hideCloseButton = false,
    hideHeader = false,
    className,
    bodyClassName,
    children,
}: MotionModalProps) {
    React.useEffect(() => {
        if (!open) return;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && !preventBackdropClose) {
                onClose();
            }
        };
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        window.addEventListener('keydown', onKeyDown);

        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener('keydown', onKeyDown);
        };
    }, [open, onClose, preventBackdropClose]);

    return (
        <AnimatePresence>
            {open && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
                    <motion.div
                        aria-hidden="true"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.18 }}
                        onClick={() => {
                            if (!preventBackdropClose) onClose();
                        }}
                        className="fixed inset-0 bg-[var(--surface-overlay)] backdrop-blur-[3px]"
                    />
                    <motion.div
                        role="dialog"
                        aria-modal="true"
                        initial={{ opacity: 0, scale: 0.96, y: 18 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.97, y: 12 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                        className={cn(
                            'relative z-10 flex w-full flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl border border-border bg-card text-card-foreground shadow-bistro-elevated max-h-[92dvh]',
                            maxWidthClasses[maxWidth],
                            className,
                        )}
                    >
                        {!hideHeader && (title || description || !hideCloseButton) && (
                            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border bg-[var(--surface-inset)] px-5 py-4 sm:px-6 sm:py-5">
                                <div className="flex min-w-0 items-center gap-3">
                                    {icon && <div className="shrink-0">{icon}</div>}
                                    <div className="min-w-0">
                                        {title && <h2 className="ds-section-title truncate">{title}</h2>}
                                        {description && (
                                            <p className="ds-caption mt-0.5">{description}</p>
                                        )}
                                    </div>
                                </div>
                                {!hideCloseButton && (
                                    <button
                                        type="button"
                                        onClick={onClose}
                                        aria-label="Close dialog"
                                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground cursor-pointer"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                )}
                            </div>
                        )}
                        <div className={cn('min-h-0 flex-1 overflow-y-auto', bodyClassName)}>
                            {children}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}

interface MotionDrawerProps {
    open: boolean;
    onClose: () => void;
    side?: 'right' | 'left' | 'bottom';
    title?: React.ReactNode;
    description?: React.ReactNode;
    headerRight?: React.ReactNode;
    className?: string;
    children: React.ReactNode;
}

export function MotionDrawer({
    open,
    onClose,
    side = 'right',
    title,
    description,
    headerRight,
    className,
    children,
}: MotionDrawerProps) {
    React.useEffect(() => {
        if (!open) return;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        window.addEventListener('keydown', onKeyDown);

        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener('keydown', onKeyDown);
        };
    }, [open, onClose]);

    const positionClasses =
        side === 'left'
            ? 'inset-y-0 left-0 h-full w-full max-w-xs sm:max-w-sm border-r'
            : side === 'bottom'
              ? 'inset-x-0 bottom-0 w-full max-h-[88dvh] rounded-t-3xl border-t'
              : 'inset-y-0 right-0 h-full w-full max-w-md border-l';

    const initialAnim =
        side === 'left'
            ? { x: '-100%' }
            : side === 'bottom'
              ? { y: '100%' }
              : { x: '100%' };

    return (
        <AnimatePresence>
            {open && (
                <div className="fixed inset-0 z-50">
                    <motion.div
                        aria-hidden="true"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.18 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-[var(--surface-overlay)] backdrop-blur-[3px]"
                    />
                    <motion.aside
                        role="dialog"
                        aria-modal="true"
                        initial={initialAnim}
                        animate={{ x: 0, y: 0 }}
                        exit={initialAnim}
                        transition={{ type: 'spring', stiffness: 360, damping: 34 }}
                        className={cn(
                            'fixed z-10 flex flex-col border-border bg-card text-card-foreground shadow-bistro-elevated',
                            positionClasses,
                            className,
                        )}
                    >
                        {(title || description || headerRight) && (
                            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border bg-[var(--surface-inset)] px-5 py-4">
                                <div className="min-w-0">
                                    {title && <h2 className="ds-section-title truncate">{title}</h2>}
                                    {description && (
                                        <p className="ds-caption mt-0.5 truncate">{description}</p>
                                    )}
                                </div>
                                <div className="flex shrink-0 items-center gap-2">
                                    {headerRight}
                                    <button
                                        type="button"
                                        onClick={onClose}
                                        aria-label="Close drawer"
                                        className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground cursor-pointer"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        )}
                        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
                    </motion.aside>
                </div>
            )}
        </AnimatePresence>
    );
}
