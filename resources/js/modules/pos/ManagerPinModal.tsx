import { useEffect, useState } from 'react';
import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { IconBadge, MotionModal, PinKeypad } from '@/design-system';

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
    const [reason, setReason] = useState('');
    const [localError, setLocalError] = useState<string | null>(null);

    useEffect(() => {
        if (open) {
            setPin('');
            setReason('');
            setLocalError(null);
        }
    }, [open]);

    const handleCompleteSubmit = (fullPin: string) => {
        if (fullPin.length !== 4) {
            return;
        }
        if (requireVoidReason && reason.trim().length < 2) {
            setLocalError('Please enter a short void reason before authorizing.');
            return;
        }
        setLocalError(null);
        onSubmit({
            pin: fullPin,
            reason: requireVoidReason ? reason.trim() : undefined,
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
                    <div className="space-y-1.5">
                        <label htmlFor="void-reason-input" className="ds-label block">
                            Void Reason
                        </label>
                        <input
                            id="void-reason-input"
                            type="text"
                            value={reason}
                            onChange={(e) => {
                                setReason(e.target.value);
                                if (localError) setLocalError(null);
                            }}
                            placeholder="e.g. Guest changed order, duplicate entry"
                            className="h-10 w-full rounded-xl border border-input bg-[var(--surface-inset)] px-3.5 text-sm text-foreground transition focus:border-primary focus:bg-card focus:ring-2 focus:ring-primary/20 focus:outline-none"
                        />
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
