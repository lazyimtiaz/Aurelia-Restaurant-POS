import { useEffect, useState } from 'react';
import { router } from '@inertiajs/react';
import { RotateCcw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCents } from '@/lib/money';
import type { PaymentTransactionData } from '@/types/billing';

interface RefundModalProps {
    payment: PaymentTransactionData | null;
    onClose: () => void;
}

export function RefundModal({ payment, onClose }: RefundModalProps) {
    const [amountDollars, setAmountDollars] = useState<string>('');
    const [managerPin, setManagerPin] = useState('');
    const [reason, setReason] = useState('Customer requested refund');
    const [wastage, setWastage] = useState(true);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    useEffect(() => {
        if (payment) {
            setAmountDollars((payment.refundable_remaining_cents / 100).toFixed(2));
            setManagerPin('');
            setErrorMsg(null);
        }
    }, [payment?.id, payment?.refundable_remaining_cents]);

    if (!payment) {
        return null;
    }

    const amountCents = amountDollars
        ? Math.round(Number(amountDollars) * 100)
        : payment.refundable_remaining_cents;

    const handleSubmit = () => {
        setErrorMsg(null);
        router.post(
            `/billing/payments/${payment.id}/refund`,
            {
                refund_amount_cents: amountCents,
                manager_pin: managerPin,
                reason,
                wastage,
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setManagerPin('');
                    onClose();
                },
                onError: (errors) => setErrorMsg(errors.manager_pin || errors.refund || 'Refund failed.'),
            },
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
            <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <RotateCcw className="h-5 w-5 text-rose-600" />
                        <div>
                            <h3 className="text-base font-bold">Issue Manager-PIN Refund</h3>
                            <p className="text-xs text-muted-foreground">
                                Max refundable: {formatCents(payment.refundable_remaining_cents)} ({payment.tender_method})
                            </p>
                        </div>
                    </div>
                    <button type="button" onClick={onClose} className="rounded p-1 hover:bg-muted cursor-pointer">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {errorMsg && (
                    <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-2.5 text-xs text-rose-700">
                        {errorMsg}
                    </div>
                )}

                <div className="space-y-3 text-xs">
                    <label className="block space-y-1">
                        <span className="font-medium text-muted-foreground">Refund Amount ($)</span>
                        <input
                            type="number"
                            step="0.01"
                            value={amountDollars}
                            onChange={(e) => setAmountDollars(e.target.value)}
                            className="w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm"
                        />
                    </label>

                    <label className="block space-y-1">
                        <span className="font-medium text-muted-foreground">Reason</span>
                        <input
                            type="text"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                        />
                    </label>

                    <div className="flex gap-4 pt-1">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                            <input type="radio" checked={wastage} onChange={() => setWastage(true)} />
                            <span>Log as Kitchen Wastage</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                            <input type="radio" checked={!wastage} onChange={() => setWastage(false)} />
                            <span>Restock (Unopened)</span>
                        </label>
                    </div>

                    <label className="block space-y-1">
                        <span className="font-medium text-muted-foreground">Manager 4-Digit PIN (Demo: 1234)</span>
                        <input
                            type="password"
                            maxLength={4}
                            value={managerPin}
                            onChange={(e) => setManagerPin(e.target.value)}
                            placeholder="••••"
                            className="w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm tracking-widest"
                        />
                    </label>
                </div>

                <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button type="button" variant="destructive" onClick={handleSubmit}>
                        Confirm Refund
                    </Button>
                </div>
            </div>
        </div>
    );
}
