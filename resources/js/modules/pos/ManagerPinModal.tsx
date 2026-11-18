import { useState } from 'react';
import { KeyRound, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

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

const VOID_REASONS = [
    { value: 'customer_changed_mind', label: 'Customer Changed Mind' },
    { value: 'kitchen_error', label: 'Kitchen Prep Error' },
    { value: 'order_mistake', label: 'Server Entry Mistake' },
];

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
    const [reason, setReason] = useState(VOID_REASONS[0].value);

    if (!open) {
        return null;
    }

    const handleDigit = (digit: string) => {
        if (pin.length < 4) {
            setPin((prev) => prev + digit);
        }
    };

    const handleConfirm = () => {
        if (pin.length !== 4) {
            return;
        }
        onSubmit({ pin, reason: requireVoidReason ? reason : undefined });
        setPin('');
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
            <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-2xl">
                <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <div className="rounded-lg bg-amber-500/15 p-2 text-amber-600">
                            <KeyRound className="h-5 w-5" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold">{title}</h3>
                            <p className="text-xs text-muted-foreground">{description}</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-md p-1 text-muted-foreground hover:bg-muted cursor-pointer"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="mt-4 space-y-3">
                    {requireVoidReason && (
                        <label className="block space-y-1 text-xs">
                            <span className="font-medium text-muted-foreground">Void Reason</span>
                            <select
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                            >
                                {VOID_REASONS.map((r) => (
                                    <option key={r.value} value={r.value}>
                                        {r.label}
                                    </option>
                                ))}
                            </select>
                        </label>
                    )}

                    <div className="flex justify-center gap-3 py-2">
                        {[0, 1, 2, 3].map((slot) => (
                            <div
                                key={slot}
                                className="flex h-11 w-11 items-center justify-center rounded-xl border-2 border-border bg-background font-mono text-xl font-bold"
                            >
                                {pin[slot] ? '•' : ''}
                            </div>
                        ))}
                    </div>

                    <p className="text-center text-[11px] text-muted-foreground">
                        Demo Branch Manager PIN: <span className="font-mono font-semibold text-foreground">1234</span>
                    </p>

                    {errorMessage && (
                        <p className="rounded-md bg-rose-500/10 px-3 py-1.5 text-center text-xs font-medium text-rose-600">
                            {errorMessage}
                        </p>
                    )}

                    <div className="grid grid-cols-3 gap-2">
                        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                            <Button
                                key={digit}
                                type="button"
                                variant="outline"
                                className="h-11 font-mono text-base font-semibold"
                                onClick={() => handleDigit(digit)}
                            >
                                {digit}
                            </Button>
                        ))}
                        <Button
                            type="button"
                            variant="ghost"
                            className="h-11 text-xs"
                            onClick={() => setPin('')}
                        >
                            Clear
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            className="h-11 font-mono text-base font-semibold"
                            onClick={() => handleDigit('0')}
                        >
                            0
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            className="h-11 text-xs"
                            onClick={() => setPin((prev) => prev.slice(0, -1))}
                        >
                            Del
                        </Button>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            disabled={pin.length !== 4 || submitting}
                            onClick={handleConfirm}
                        >
                            Authorize Override
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
