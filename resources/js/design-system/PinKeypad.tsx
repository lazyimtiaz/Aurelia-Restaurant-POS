import * as React from 'react';
import { motion } from 'motion/react';
import { Delete, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PinKeypadProps {
    value: string;
    onChange: (next: string) => void;
    maxLength?: number;
    errorMessage?: string | null;
    errorKey?: string | number;
    disabled?: boolean;
    enableKeyboard?: boolean;
    showSubmitButton?: boolean;
    submitLabel?: string;
    submitTone?: 'brand' | 'amber' | 'rose';
    onSubmit?: (pin: string) => void;
    className?: string;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'] as const;

export function PinKeypad({
    value,
    onChange,
    maxLength = 4,
    errorMessage,
    errorKey,
    disabled = false,
    enableKeyboard = true,
    showSubmitButton = false,
    submitLabel = 'Confirm PIN',
    submitTone = 'brand',
    onSubmit,
    className,
}: PinKeypadProps) {
    const [shakeTick, setShakeTick] = React.useState(0);

    React.useEffect(() => {
        if (errorMessage || errorKey) {
            setShakeTick((prev) => prev + 1);
        }
    }, [errorMessage, errorKey]);

    const handleDigit = React.useCallback(
        (digit: string) => {
            if (disabled || value.length >= maxLength) return;
            const next = `${value}${digit}`;
            onChange(next);
            if (next.length === maxLength && !showSubmitButton) {
                onSubmit?.(next);
            }
        },
        [disabled, value, maxLength, onChange, showSubmitButton, onSubmit],
    );

    const handleKeyPress = React.useCallback(
        (key: (typeof KEYS)[number]) => {
            if (disabled) return;
            if (key === 'C') {
                onChange('');
                return;
            }
            if (key === '⌫') {
                onChange(value.slice(0, -1));
                return;
            }
            handleDigit(key);
        },
        [disabled, value, onChange, handleDigit],
    );

    React.useEffect(() => {
        if (!enableKeyboard) return;
        const onKeyDown = (event: KeyboardEvent) => {
            if (disabled) return;
            const activeTag = (document.activeElement as HTMLElement | null)?.tagName;
            if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT') {
                return;
            }
            if (event.key >= '0' && event.key <= '9') {
                event.preventDefault();
                handleDigit(event.key);
            } else if (event.key === 'Backspace') {
                event.preventDefault();
                onChange(value.slice(0, -1));
            } else if (event.key === 'Escape') {
                onChange('');
            } else if (event.key === 'Enter' && value.length === maxLength) {
                onSubmit?.(value);
            }
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [enableKeyboard, disabled, value, maxLength, onChange, onSubmit, handleDigit]);

    const submitClasses =
        submitTone === 'amber'
            ? 'bg-amber-500 text-stone-950 hover:bg-amber-400'
            : submitTone === 'rose'
              ? 'bg-rose-600 text-white hover:bg-rose-700'
              : 'bg-primary text-primary-foreground hover:bg-[#c2410c]';

    return (
        <div className={cn('space-y-4', className)}>
            {/* PIN Dots */}
            <motion.div
                key={shakeTick}
                animate={errorMessage ? { x: [0, -8, 8, -5, 5, 0] } : { x: 0 }}
                transition={{ duration: 0.34, ease: 'easeInOut' }}
                className="flex items-center justify-center gap-3.5 py-2"
            >
                {Array.from({ length: maxLength }).map((_, idx) => {
                    const filled = idx < value.length;
                    return (
                        <motion.span
                            key={idx}
                            animate={filled ? { scale: [1, 1.24, 1] } : { scale: 1 }}
                            transition={{ duration: 0.18 }}
                            className={cn(
                                'flex h-4 w-4 items-center justify-center rounded-full border-2 transition-colors',
                                filled
                                    ? errorMessage
                                        ? 'border-rose-500 bg-rose-500 shadow-[0_0_0_4px_rgba(244,63,94,0.12)]'
                                        : 'border-primary bg-primary shadow-[0_0_0_4px_rgba(234,88,12,0.14)]'
                                    : 'border-border bg-[var(--surface-inset)]',
                            )}
                        />
                    );
                })}
            </motion.div>

            {/* Error Pill */}
            {errorMessage && (
                <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-center gap-2 rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-center text-xs font-medium text-rose-700"
                >
                    <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                    <span>{errorMessage}</span>
                </motion.div>
            )}

            {/* Tactile Keypad */}
            <div className="grid grid-cols-3 gap-2.5">
                {KEYS.map((key) => (
                    <motion.button
                        key={key}
                        type="button"
                        disabled={disabled}
                        whileTap={{ scale: 0.93 }}
                        transition={{ type: 'spring', stiffness: 520, damping: 30 }}
                        onClick={() => handleKeyPress(key)}
                        className={cn(
                            'flex h-13 sm:h-14 items-center justify-center rounded-2xl border border-border font-mono text-lg font-bold transition-colors select-none cursor-pointer disabled:opacity-50',
                            key === 'C' || key === '⌫'
                                ? 'bg-[var(--surface-inset)] text-sm font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground'
                                : 'bg-card text-foreground shadow-[0_1px_2px_rgba(24,21,18,0.05)] hover:border-primary/35 hover:bg-accent/60',
                        )}
                    >
                        {key === '⌫' ? <Delete className="h-4.5 w-4.5" /> : key}
                    </motion.button>
                ))}
            </div>

            {showSubmitButton && (
                <button
                    type="button"
                    disabled={disabled || value.length !== maxLength}
                    onClick={() => onSubmit?.(value)}
                    className={cn(
                        'flex min-h-11 w-full items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold shadow-sm transition-all active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45 cursor-pointer',
                        submitClasses,
                    )}
                >
                    {submitLabel}
                </button>
            )}
        </div>
    );
}
