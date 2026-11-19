import { useEffect, useState } from 'react';
import { router } from '@inertiajs/react';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { IconBadge, MotionModal } from '@/design-system';
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
    const [submitting, setSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    useEffect(() => {
        if (payment) {
            setAmountDollars((payment.refundable_remaining_cents / 100).toFixed(2));
            setManagerPin('');
            setErrorMsg(null);
        }
    }, [payment?.id, payment?.refundable_remaining_cents]);

    const amountCents = payment
        ? amountDollars
            ? Math.round(Number(amountDollars) * 100)
            : payment.refundable_remaining_cents
        : 0;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!payment) return;
        setErrorMsg(null);
        setSubmitting(true);

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
                onError: (errors) =>
                    setErrorMsg(errors.manager_pin || errors.refund || 'Refund failed.'),
                onFinish: () => setSubmitting(false),
            },
        );
    };

    return (
        <MotionModal
            open={payment !== null}
            onClose={onClose}
            title="Issue Manager Refund"
            description={
                payment
                    ? `Max refundable: ${formatCents(payment.refundable_remaining_cents)} (${payment.tender_method.toUpperCase()})`
                    : undefined
            }
            icon={
                <IconBadge tone="rose" shape="squircle">
                    <RotateCcw className="h-4.5 w-4.5" />
                </IconBadge>
            }
            maxWidth="md"
        >
            {payment && (
                <form onSubmit={handleSubmit} className="space-y-4 p-5 sm:p-6">
                    {errorMsg && (
                        <div className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-3.5 py-2.5 text-xs font-medium text-rose-700">
                            {errorMsg}
                        </div>
                    )}

                    <label className="block space-y-1.5">
                        <span className="ds-label block">Refund Amount ($)</span>
                        <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={amountDollars}
                            onChange={(e) => setAmountDollars(e.target.value)}
                            className="h-11 w-full rounded-xl border border-input bg-[var(--surface-inset)] px-3.5 font-mono text-sm font-semibold focus:border-primary focus:bg-card focus:outline-none"
                        />
                    </label>

                    <label className="block space-y-1.5">
                        <span className="ds-label block">Reason</span>
                        <input
                            type="text"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            className="h-11 w-full rounded-xl border border-input bg-[var(--surface-inset)] px-3.5 text-sm focus:border-primary focus:bg-card focus:outline-none"
                        />
                    </label>

                    <div className="grid grid-cols-1 gap-2 rounded-xl border border-border bg-[var(--surface-inset)] p-3 text-xs font-medium sm:grid-cols-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="radio"
                                checked={wastage}
                                onChange={() => setWastage(true)}
                                className="accent-[#EA580C]"
                            />
                            <span>Log as Kitchen Wastage</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="radio"
                                checked={!wastage}
                                onChange={() => setWastage(false)}
                                className="accent-[#EA580C]"
                            />
                            <span>Restock (Unopened)</span>
                        </label>
                    </div>

                    <label className="block space-y-1.5">
                        <span className="ds-label block">Manager 4-Digit PIN</span>
                        <input
                            type="password"
                            inputMode="numeric"
                            maxLength={4}
                            required
                            value={managerPin}
                            onChange={(e) => setManagerPin(e.target.value)}
                            placeholder="••••"
                            className="h-11 w-full rounded-xl border border-input bg-[var(--surface-inset)] px-3.5 font-mono text-base tracking-[0.35em] focus:border-primary focus:bg-card focus:outline-none"
                        />
                    </label>

                    <div className="flex justify-end gap-2.5 pt-2">
                        <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
                            Cancel
                        </Button>
                        <Button type="submit" variant="destructive" loading={submitting}>
                            Confirm Refund
                        </Button>
                    </div>
                </form>
            )}
        </MotionModal>
    );
}
