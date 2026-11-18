import { useEffect, useState } from 'react';
import { router, usePage } from '@inertiajs/react';
import { AlertTriangle, Banknote, CheckCircle2, CreditCard, QrCode, Receipt, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCents } from '@/lib/money';
import type { BillSplitData, TenderMethodValue } from '@/types/billing';
import type { SharedPageProps } from '@/types/evaluator';
import type { ActiveOrderData } from '@/types/pos';

interface PaymentSettlementModalProps {
    open: boolean;
    order: ActiveOrderData | null;
    onClose: () => void;
    onOpenReceipt: (billSplitId: number) => void;
}

export function PaymentSettlementModal({
    open,
    order,
    onClose,
    onOpenReceipt,
}: PaymentSettlementModalProps) {
    const { evaluator } = usePage<SharedPageProps>().props;
    const splits: BillSplitData[] = order?.bill_splits ?? [];
    const firstPending = splits.find((s) => s.state !== 'paid') ?? splits[0];

    const [selectedSplitId, setSelectedSplitId] = useState<number>(firstPending?.id ?? 0);
    const [tenderMethod, setTenderMethod] = useState<TenderMethodValue>('card');
    const [tipPercent, setTipPercent] = useState<number>(0);
    const [cashTenderedDollars, setCashTenderedDollars] = useState<string>('');
    const [paymentError, setPaymentError] = useState<string | null>(null);
    const [idempotencyKey, setIdempotencyKey] = useState<string>(() => crypto.randomUUID());

    useEffect(() => {
        if (firstPending && !splits.some((s) => s.id === selectedSplitId && s.state !== 'paid')) {
            setSelectedSplitId(firstPending.id);
        }
    }, [order?.id, splits.length]);

    if (!open || !order) {
        return null;
    }

    const activeSplit = splits.find((s) => s.id === selectedSplitId) ?? firstPending;
    const tipCents = activeSplit ? Math.floor((activeSplit.total_cents * tipPercent) / 100) : 0;
    const totalDueCents = (activeSplit?.total_cents ?? 0) + tipCents;
    const parsedCashCents = cashTenderedDollars.trim()
        ? Math.round(Number(cashTenderedDollars) * 100)
        : totalDueCents;

    const handlePay = () => {
        if (!activeSplit) {
            return;
        }
        setPaymentError(null);

        router.post(
            `/billing/splits/${activeSplit.id}/pay`,
            {
                tender_method: tenderMethod,
                amount_tendered_cents: tenderMethod === 'cash' ? parsedCashCents : totalDueCents,
                tip_cents: tipCents,
                idempotency_key: idempotencyKey,
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setIdempotencyKey(crypto.randomUUID());
                    setCashTenderedDollars('');
                },
                onError: (errors) => {
                    setIdempotencyKey(crypto.randomUUID());
                    setPaymentError(errors.payment || 'Payment could not be completed.');
                },
            },
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
            <div className="w-full max-w-xl rounded-2xl border border-border bg-card p-5 shadow-2xl space-y-4">
                <div className="flex items-start justify-between">
                    <div>
                        <h3 className="text-lg font-bold">Payment Settlement — {order.order_number}</h3>
                        <p className="text-xs text-muted-foreground">
                            Order State: <span className="font-semibold uppercase">{order.state}</span>
                            {evaluator.simulations.simulateCardDecline && ' · Simulator: Card Decline ON'}
                        </p>
                    </div>
                    <button type="button" onClick={onClose} className="rounded p-1 hover:bg-muted cursor-pointer">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {order.state === 'partially_paid' && (
                    <div className="flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs font-medium text-amber-800">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        Partial settlement active: settled checks remain committed while unpaid checks can be retried or switched to Cash/QR.
                    </div>
                )}

                <div className="grid gap-2 sm:grid-cols-2">
                    {splits.map((split) => {
                        const isSelected = activeSplit?.id === split.id;

                        return (
                            <div
                                key={split.id}
                                onClick={() => setSelectedSplitId(split.id)}
                                className={`rounded-xl border p-3 text-sm transition cursor-pointer ${
                                    isSelected
                                        ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                                        : 'border-border bg-background/60'
                                }`}
                            >
                                <div className="flex items-center justify-between">
                                    <span className="font-semibold">{split.label}</span>
                                    <Badge
                                        variant={
                                            split.state === 'paid'
                                                ? 'success'
                                                : split.state === 'failed'
                                                  ? 'destructive'
                                                  : 'secondary'
                                        }
                                    >
                                        {split.state}
                                    </Badge>
                                </div>
                                <div className="mt-1.5 flex items-center justify-between">
                                    <span className="font-mono font-bold">{formatCents(split.total_cents)}</span>
                                    {split.state === 'paid' && (
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-7 px-2 text-xs"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onOpenReceipt(split.id);
                                            }}
                                        >
                                            <Receipt className="h-3.5 w-3.5" />
                                            Receipt
                                        </Button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {paymentError && (
                    <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-xs font-medium text-rose-700">
                        {paymentError}
                    </div>
                )}

                {activeSplit && activeSplit.state !== 'paid' ? (
                    <div className="space-y-4 rounded-xl border border-border bg-background/60 p-4">
                        <div className="grid grid-cols-3 gap-2">
                            {[
                                { value: 'card' as const, label: 'Card', Icon: CreditCard },
                                { value: 'cash' as const, label: 'Cash', Icon: Banknote },
                                { value: 'qr' as const, label: 'QR / Wallet', Icon: QrCode },
                            ].map(({ value, label, Icon }) => (
                                <Button
                                    key={value}
                                    type="button"
                                    variant={tenderMethod === value ? 'default' : 'outline'}
                                    onClick={() => setTenderMethod(value)}
                                >
                                    <Icon className="h-4 w-4" />
                                    {label}
                                </Button>
                            ))}
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                            <span className="font-medium text-muted-foreground">Tip</span>
                            <div className="flex gap-1.5">
                                {[0, 10, 15, 20].map((pct) => (
                                    <Button
                                        key={pct}
                                        size="sm"
                                        variant={tipPercent === pct ? 'default' : 'outline'}
                                        onClick={() => setTipPercent(pct)}
                                    >
                                        {pct === 0 ? 'No Tip' : `${pct}%`}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        {tenderMethod === 'cash' && (
                            <label className="block space-y-1 text-xs">
                                <span className="font-medium text-muted-foreground">
                                    Cash Tendered ($) — leave blank for exact {formatCents(totalDueCents)}
                                </span>
                                <input
                                    type="number"
                                    step="0.01"
                                    placeholder={(totalDueCents / 100).toFixed(2)}
                                    value={cashTenderedDollars}
                                    onChange={(e) => setCashTenderedDollars(e.target.value)}
                                    className="w-full rounded-lg border border-input bg-background px-3 py-1.5 font-mono text-sm"
                                />
                            </label>
                        )}

                        <div className="flex items-center justify-between border-t border-border pt-3">
                            <div>
                                <div className="text-xs text-muted-foreground">Charge Due ({activeSplit.label})</div>
                                <div className="font-mono text-xl font-bold">{formatCents(totalDueCents)}</div>
                            </div>
                            <Button type="button" size="lg" onClick={handlePay}>
                                Capture {formatCents(totalDueCents)}
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-800">
                        <span className="flex items-center gap-2 font-semibold">
                            <CheckCircle2 className="h-5 w-5" />
                            Check settled cleanly.
                        </span>
                        {activeSplit && (
                            <Button size="sm" variant="outline" onClick={() => onOpenReceipt(activeSplit.id)}>
                                <Receipt className="h-4 w-4" /> View Receipt
                            </Button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
