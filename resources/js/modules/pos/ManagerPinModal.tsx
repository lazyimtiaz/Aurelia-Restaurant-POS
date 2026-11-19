import { useEffect, useState } from 'react';
import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { IconBadge, MotionModal, PinKeypad } from '@/design-system';
import { cn } from '@/lib/utils';

const VOID_REASONS = [
    { value: 'customer_changed_mind', label: 'Customer Changed Mind' },
    { value: 'kitchen_error', label: 'Kitchen Prep Error' },
    { value: 'order_mistake', label: 'Server Entry Mistake' },
] as const;

interface ManagerPinModalProps {
    open: boolean;
    title: string;
    description: string;
    requireVoidReason?: boolean;
    errorMessage?: string | null;
    submitting?: boolean;
    onClose: () => void;
    onSubmit: (payload: { pin: string; reason?: string }) => void;
}

export function ManagerPinModal({
    open,
    title,
    description,
    requireVoidReason = false,
    errorMessage,
    submitting = false,
    onClose,
    onSubmit,
}: ManagerPinModalProps) {
    const [pin, setPin] = useState('');
    const [reason, setReason] = useState<string>(VOID_REASONS[0].value);
    const [localError, setLocalError] = useState<string | null>(null);

    useEffect(() => {
        if (open) {
            setPin('');
            setReason(VOID_REASONS[0].value);
            setLocalError(null);
        }
    }, [open]);

    const handleCompleteSubmit = (fullPin: string) => {
        if (fullPin.length !== 4) {
            return;
        }
        if (requireVoidReason && !reason) {
            setLocalError('Please select a void reason before authorizing.');
            return;
        }
        setLocalError(null);
        onSubmit({
            pin: fullPin,
            reason: requireVoidReason ? reason : undefined,
        });
    };

    return (
        <MotionModal
            open={open}
            onClose={onClose}
            title={title}
            description={description}
            icon={
                <IconBadge tone="rose" size="md" shape="squircle">
                    <Lock className="h-4.5 w-4.5" />
                </IconBadge>
            }
            maxWidth="sm"
            preventBackdropClose={submitting}
        >
            <div className="space-y-4 p-5 sm:p-6">
                {requireVoidReason && (
                    <div className="space-y-2">
                        <span className="ds-label block">Void Reason</span>
                        <div className="grid gap-1.5" role="radiogroup" aria-label="Void Reason">
                            {VOID_REASONS.map((opt) => {
                                const selected = reason === opt.value;
                                return (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        role="radio"
                                        aria-checked={selected}
                                        onClick={() => {
                                            setReason(opt.value);
                                            if (localError) setLocalError(null);
                                        }}
                                        className={cn(
                                            'flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-left text-xs font-semibold transition cursor-pointer',
                                            selected
                                                ? 'border-rose-500/40 bg-rose-500/10 text-rose-800 ring-1 ring-rose-500/20'
                                                : 'border-border bg-[var(--surface-inset)] text-foreground hover:bg-secondary/70',
                                        )}
                                    >
                                        <span>{opt.label}</span>
                                        <span
                                            className={cn(
                                                'h-3.5 w-3.5 rounded-full border-2',
                                                selected ? 'border-rose-600 bg-rose-600' : 'border-stone-300',
                                            )}
                                        />
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                <PinKeypad
                    value={pin}
                    onChange={setPin}
                    errorMessage={localError || errorMessage}
                    disabled={submitting}
                    enableKeyboard={open}
                    showSubmitButton
                    submitLabel={submitting ? 'Authorizing...' : 'Authorize Action'}
                    submitTone="rose"
                    onSubmit={handleCompleteSubmit}
                />

                <div className="flex justify-end pt-1">
                    <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={submitting}>
                        Cancel
                    </Button>
                </div>
            </div>
        </MotionModal>
    );
}
