import { useEffect, useState } from 'react';
import { router } from '@inertiajs/react';
import {
    AlertTriangle,
    Banknote,
    CheckCircle2,
    CreditCard,
    Delete,
    QrCode,
    Receipt,
    RotateCcw,
    Split,
    Users,
    X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCents } from '@/lib/money';
import type { BillSplitData, SplitModeValue, TenderMethodValue } from '@/types/billing';
import type { ActiveOrderData } from '@/types/pos';

interface UnifiedPaymentModalProps {
    open: boolean;
    order: ActiveOrderData | null;
    onClose: () => void;
    onOpenReceipt: (billSplitId: number) => void;
}

export function UnifiedPaymentModal({
    open,
    order,
    onClose,
    onOpenReceipt,
}: UnifiedPaymentModalProps) {
    const splits: BillSplitData[] = order?.bill_splits ?? [];
    const firstPending = splits.find((s) => s.state !== 'paid') ?? splits[0];

    const [selectedSplitId, setSelectedSplitId] = useState<number>(firstPending?.id ?? 0);
    const [tenderMethod, setTenderMethod] = useState<TenderMethodValue>('cash');
    const [tipPercent, setTipPercent] = useState<number>(0);
    const [cashInput, setCashInput] = useState<string>('');
    const [cardReaderOpen, setCardReaderOpen] = useState<boolean>(false);
    const [paymentError, setPaymentError] = useState<string | null>(null);
    const [idempotencyKey, setIdempotencyKey] = useState<string>(() => crypto.randomUUID());

    const [splitPanelOpen, setSplitPanelOpen] = useState(false);
    const [splitMode, setSplitMode] = useState<SplitModeValue>('equal');
    const [equalWays, setEqualWays] = useState(2);
    const [seatMap, setSeatMap] = useState<Record<number, number>>({});

    useEffect(() => {
        if (!open || !order) {
            return;
        }
        setPaymentError(null);
        setCardReaderOpen(false);
        setCashInput('');
        setSplitPanelOpen(false);
        if (firstPending && !splits.some((s) => s.id === selectedSplitId && s.state !== 'paid')) {
            setSelectedSplitId(firstPending.id);
        }
        const initialSeats: Record<number, number> = {};
        order.items
            .filter((i) => i.prep_state !== 'voided')
            .forEach((item) => {
                initialSeats[item.id] = item.seat_number ?? 1;
            });
        setSeatMap(initialSeats);
    }, [open, order?.id, splits.length]);

    if (!open || !order) {
        return null;
    }

    const activeSplit = splits.find((s) => s.id === selectedSplitId) ?? firstPending;
    const tipCents = activeSplit ? Math.floor((activeSplit.total_cents * tipPercent) / 100) : 0;
    const totalDueCents = (activeSplit?.total_cents ?? 0) + tipCents;
    const parsedCashCents = cashInput.trim()
        ? Math.round(Number.parseFloat(cashInput) * 100) || 0
        : totalDueCents;
    const changeDueCents = Math.max(0, parsedCashCents - totalDueCents);
    const canModifySplit = order.state === 'billing';
    const activeItems = order.items.filter((i) => i.prep_state !== 'voided');

    const handlePay = (simulateDecline = false) => {
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
                simulate_decline: simulateDecline,
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setIdempotencyKey(crypto.randomUUID());
                    setCashInput('');
                    setCardReaderOpen(false);
                },
                onError: (errors) => {
                    setIdempotencyKey(crypto.randomUUID());
                    setCardReaderOpen(false);
                    setPaymentError(errors.payment || 'Payment could not be completed.');
                },
            },
        );
    };

    const handleApplySplit = (targetMode: SplitModeValue) => {
        if (targetMode === 'unified') {
            router.post(
                `/billing/orders/${order.id}/split`,
                { mode: 'unified' },
                { preserveScroll: true, onSuccess: () => setSplitPanelOpen(false) },
            );
            return;
        }

        if (targetMode === 'equal') {
            router.post(
                `/billing/orders/${order.id}/split`,
                { mode: 'equal', equal_ways: equalWays },
                { preserveScroll: true, onSuccess: () => setSplitPanelOpen(false) },
            );
            return;
        }

        const seatGroups: Record<string, { order_item_id: number; share_numerator: number; share_denominator: number }[]> =
            {};
        activeItems.forEach((item) => {
            const seat = seatMap[item.id] ?? 1;
            const label = `Seat ${seat}`;
            seatGroups[label] ??= [];
            seatGroups[label].push({ order_item_id: item.id, share_numerator: 1, share_denominator: 1 });
        });

        router.post(
            `/billing/orders/${order.id}/split`,
            { mode: 'item_seat', seat_groups: seatGroups },
            { preserveScroll: true, onSuccess: () => setSplitPanelOpen(false) },
        );
    };

    const handleKeypadDigit = (key: string) => {
        if (key === '⌫') {
            setCashInput((prev) => prev.slice(0, -1));
            return;
        }
        if (key === '.' && cashInput.includes('.')) {
            return;
        }
        setCashInput((prev) => (prev === '0' && key !== '.' ? key : prev + key));
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-xs">
            <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-2xl">
                <div className="flex items-center justify-between border-b border-border px-6 py-4">
                    <div>
                        <h3 className="text-lg font-bold">Payment &amp; Check Settlement</h3>
                        <p className="text-xs text-muted-foreground">
                            {order.order_number} ·{' '}
                            {order.table_code ? `Table ${order.table_code}` : order.customer_name || 'Takeaway'}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        {canModifySplit && (
                            <>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setSplitPanelOpen((prev) => !prev)}
                                >
                                    <Split className="h-3.5 w-3.5" />
                                    {splitPanelOpen ? 'Close Split Options' : 'Split Check'}
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={() =>
                                        router.post(`/billing/orders/${order.id}/reopen`, {}, { onSuccess: onClose })
                                    }
                                >
                                    <RotateCcw className="h-3.5 w-3.5" />
                                    Reopen Order
                                </Button>
                            </>
                        )}
                        <button type="button" onClick={onClose} className="rounded-lg p-1.5 hover:bg-muted cursor-pointer">
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                <div className="grid flex-1 overflow-y-auto md:grid-cols-12">
                    <div className="space-y-4 border-b border-border bg-muted/35 p-6 md:col-span-5 md:border-r md:border-b-0">
                        {order.state === 'partially_paid' && (
                            <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs font-medium text-amber-900">
                                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                                <span>
                                    Partial settlement active. Completed checks remain locked; settle remaining unpaid checks below.
                                </span>
                            </div>
                        )}

                        {splitPanelOpen && canModifySplit && (
                            <div className="space-y-3 rounded-2xl border border-orange-200 bg-white p-3.5 shadow-2xs">
                                <div className="flex flex-wrap gap-1.5">
                                    <button
                                        type="button"
                                        onClick={() => handleApplySplit('unified')}
                                        className="rounded-lg border border-border px-2.5 py-1 text-xs font-semibold hover:bg-muted cursor-pointer"
                                    >
                                        Single Check
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setSplitMode('equal')}
                                        className={`rounded-lg px-2.5 py-1 text-xs font-semibold cursor-pointer ${
                                            splitMode === 'equal'
                                                ? 'bg-primary text-primary-foreground'
                                                : 'border border-border'
                                        }`}
                                    >
                                        Equal Split
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setSplitMode('item_seat')}
                                        className={`rounded-lg px-2.5 py-1 text-xs font-semibold cursor-pointer ${
                                            splitMode === 'item_seat'
                                                ? 'bg-primary text-primary-foreground'
                                                : 'border border-border'
                                        }`}
                                    >
                                        <Users className="mr-1 inline h-3 w-3" />
                                        By Seat
                                    </button>
                                </div>

                                {splitMode === 'equal' && (
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex gap-1">
                                            {[2, 3, 4, 5].map((n) => (
                                                <button
                                                    key={n}
                                                    type="button"
                                                    onClick={() => setEqualWays(n)}
                                                    className={`rounded-md px-2.5 py-1 text-xs font-bold cursor-pointer ${
                                                        equalWays === n
                                                            ? 'bg-orange-100 text-orange-700'
                                                            : 'bg-muted text-stone-700'
                                                    }`}
                                                >
                                                    {n}×
                                                </button>
                                            ))}
                                        </div>
                                        <Button type="button" size="sm" onClick={() => handleApplySplit('equal')}>
                                            Apply
                                        </Button>
                                    </div>
                                )}

                                {splitMode === 'item_seat' && (
                                    <div className="space-y-2">
                                        {activeItems.map((item) => (
                                            <div key={item.id} className="flex items-center justify-between text-xs">
                                                <span className="truncate pr-2 font-medium">
                                                    {item.quantity}× {item.item_name}
                                                </span>
                                                <select
                                                    value={seatMap[item.id] ?? 1}
                                                    onChange={(e) =>
                                                        setSeatMap((prev) => ({
                                                            ...prev,
                                                            [item.id]: Number(e.target.value),
                                                        }))
                                                    }
                                                    className="rounded border border-input bg-background px-2 py-0.5 text-xs"
                                                >
                                                    {[1, 2, 3, 4, 5, 6].map((s) => (
                                                        <option key={s} value={s}>
                                                            Seat {s}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        ))}
                                        <Button
                                            type="button"
                                            size="sm"
                                            className="w-full"
                                            onClick={() => handleApplySplit('item_seat')}
                                        >
                                            Apply Seat Split
                                        </Button>
                                    </div>
                                )}
                            </div>
                        )}

                        {splits.length > 0 && (
                            <div className="space-y-2">
                                <div className="text-xs font-semibold uppercase text-muted-foreground">
                                    Checks ({splits.length})
                                </div>
                                <div className="grid gap-2">
                                    {splits.map((split) => {
                                        const isSelected = activeSplit?.id === split.id;
                                        return (
                                            <div
                                                key={split.id}
                                                onClick={() => {
                                                    setSelectedSplitId(split.id);
                                                    setCardReaderOpen(false);
                                                    setPaymentError(null);
                                                }}
                                                className={`flex items-center justify-between rounded-xl border p-3 text-sm transition cursor-pointer ${
                                                    isSelected
                                                        ? 'border-primary bg-white ring-2 ring-primary/20'
                                                        : 'border-border bg-white/70 hover:bg-white'
                                                }`}
                                            >
                                                <div>
                                                    <div className="flex items-center gap-2 font-semibold">
                                                        <span>{split.label}</span>
                                                        <Badge
                                                            variant={
                                                                split.state === 'paid'
                                                                    ? 'success'
                                                                    : split.state === 'failed'
                                                                      ? 'destructive'
                                                                      : 'outline'
                                                            }
                                                        >
                                                            {split.state}
                                                        </Badge>
                                                    </div>
                                                    <div className="mt-0.5 font-mono text-xs text-muted-foreground">
                                                        Subtotal {formatCents(split.subtotal_cents)} · Tax{' '}
                                                        {formatCents(split.tax_cents)}
                                                    </div>
                                                </div>

                                                <div className="text-right">
                                                    <div className="font-mono font-bold">
                                                        {formatCents(split.total_cents)}
                                                    </div>
                                                    {split.state === 'paid' && (
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                onOpenReceipt(split.id);
                                                            }}
                                                            className="mt-0.5 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline cursor-pointer"
                                                        >
                                                            <Receipt className="h-3 w-3" /> Receipt
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        <div className="rounded-2xl border border-border bg-white p-4 space-y-2 text-xs">
                            <div className="text-xs font-bold text-foreground uppercase">Transaction Summary</div>
                            <div className="max-h-36 space-y-1.5 overflow-y-auto border-b border-dashed border-border pb-2">
                                {activeItems.map((item) => (
                                    <div key={item.id} className="flex justify-between">
                                        <span className="truncate pr-2">
                                            {item.quantity}× {item.item_name}
                                        </span>
                                        <span className="font-mono font-medium">
                                            {formatCents(item.line_total_cents)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                            {activeSplit && (
                                <div className="space-y-1 pt-1">
                                    <div className="flex justify-between text-muted-foreground">
                                        <span>Check Total</span>
                                        <span className="font-mono">{formatCents(activeSplit.total_cents)}</span>
                                    </div>
                                    <div className="flex justify-between text-muted-foreground">
                                        <span>Gratuity ({tipPercent}%)</span>
                                        <span className="font-mono">{formatCents(tipCents)}</span>
                                    </div>
                                    <div className="flex justify-between border-t border-border pt-1.5 text-sm font-bold text-foreground">
                                        <span>Total Due</span>
                                        <span className="font-mono">{formatCents(totalDueCents)}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="space-y-5 p-6 md:col-span-7">
                        {!activeSplit || activeSplit.state === 'paid' ? (
                            <div className="flex h-full flex-col items-center justify-center space-y-3 py-12 text-center">
                                <CheckCircle2 className="h-12 w-12 text-emerald-600" />
                                <div className="text-lg font-bold">Selected Check Settled</div>
                                {activeSplit && (
                                    <Button type="button" variant="outline" onClick={() => onOpenReceipt(activeSplit.id)}>
                                        <Receipt className="h-4 w-4" />
                                        View Thermal Receipt
                                    </Button>
                                )}
                            </div>
                        ) : (
                            <>
                                {paymentError && (
                                    <div className="rounded-xl border border-rose-300 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700">
                                        {paymentError}
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <div className="text-xs font-semibold uppercase text-muted-foreground">
                                        Payment Method
                                    </div>
                                    <div className="grid grid-cols-3 gap-2">
                                        {(
                                            [
                                                ['cash', 'Cash', Banknote],
                                                ['card', 'Card Terminal', CreditCard],
                                                ['qr', 'Mobile QR', QrCode],
                                            ] as const
                                        ).map(([method, label, Icon]) => (
                                            <button
                                                key={method}
                                                type="button"
                                                onClick={() => {
                                                    setTenderMethod(method);
                                                    setCardReaderOpen(false);
                                                    setPaymentError(null);
                                                }}
                                                className={`flex items-center justify-center gap-2 rounded-xl border py-2.5 text-xs font-semibold transition cursor-pointer ${
                                                    tenderMethod === method
                                                        ? 'border-primary bg-orange-50 text-orange-700 ring-1 ring-primary/40'
                                                        : 'border-border bg-background hover:bg-muted/60'
                                                }`}
                                            >
                                                <Icon className="h-4 w-4" />
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <div className="text-xs font-semibold uppercase text-muted-foreground">
                                        Add Tip / Gratuity
                                    </div>
                                    <div className="grid grid-cols-4 gap-2">
                                        {[0, 10, 15, 20].map((pct) => (
                                            <button
                                                key={pct}
                                                type="button"
                                                onClick={() => setTipPercent(pct)}
                                                className={`rounded-xl border py-2 font-mono text-xs font-semibold transition cursor-pointer ${
                                                    tipPercent === pct
                                                        ? 'border-primary bg-orange-50 text-orange-700'
                                                        : 'border-border bg-background'
                                                }`}
                                            >
                                                {pct === 0 ? 'No Tip' : `${pct}%`}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {tenderMethod === 'cash' && (
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between rounded-2xl border border-border bg-muted/30 px-4 py-3">
                                            <div>
                                                <div className="text-[11px] uppercase text-muted-foreground">
                                                    Cash Tendered
                                                </div>
                                                <div className="font-mono text-2xl font-bold">
                                                    {formatCents(parsedCashCents)}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-[11px] uppercase text-muted-foreground">
                                                    Change Due
                                                </div>
                                                <div className="font-mono text-lg font-bold text-emerald-600">
                                                    {formatCents(changeDueCents)}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap gap-1.5">
                                            <button
                                                type="button"
                                                onClick={() => setCashInput((totalDueCents / 100).toFixed(2))}
                                                className="rounded-lg bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-700 hover:bg-orange-100 cursor-pointer"
                                            >
                                                Exact ({formatCents(totalDueCents)})
                                            </button>
                                            {[5, 10, 20, 50, 100].map((bill) => (
                                                <button
                                                    key={bill}
                                                    type="button"
                                                    onClick={() => setCashInput(String(bill))}
                                                    className="rounded-lg border border-border bg-background px-3 py-1.5 font-mono text-xs font-semibold hover:bg-muted cursor-pointer"
                                                >
                                                    ${bill}
                                                </button>
                                            ))}
                                        </div>

                                        <div className="grid grid-cols-3 gap-2">
                                            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'].map((key) => (
                                                <button
                                                    key={key}
                                                    type="button"
                                                    onClick={() => handleKeypadDigit(key)}
                                                    className="flex h-12 items-center justify-center rounded-xl border border-border bg-background font-mono text-base font-bold hover:border-orange-300 hover:bg-orange-50 active:scale-95 cursor-pointer"
                                                >
                                                    {key === '⌫' ? <Delete className="h-4 w-4" /> : key}
                                                </button>
                                            ))}
                                        </div>

                                        <Button
                                            type="button"
                                            onClick={() => handlePay(false)}
                                            disabled={parsedCashCents < totalDueCents}
                                            className="w-full rounded-xl py-5 text-sm font-bold"
                                        >
                                            Pay {formatCents(totalDueCents)} Cash
                                        </Button>
                                    </div>
                                )}

                                {tenderMethod === 'card' && (
                                    <div className="space-y-4 rounded-2xl border border-border bg-muted/25 p-5 text-center">
                                        {!cardReaderOpen ? (
                                            <>
                                                <CreditCard className="mx-auto h-10 w-10 text-primary" />
                                                <div>
                                                    <div className="text-base font-bold">
                                                        Card Total: {formatCents(totalDueCents)}
                                                    </div>
                                                    <p className="mt-1 text-xs text-muted-foreground">
                                                        Send transaction to the countertop EMV/NFC reader.
                                                    </p>
                                                </div>
                                                <Button
                                                    type="button"
                                                    onClick={() => setCardReaderOpen(true)}
                                                    className="w-full rounded-xl py-5 text-sm font-bold"
                                                >
                                                    Present Card ({formatCents(totalDueCents)})
                                                </Button>
                                            </>
                                        ) : (
                                            <>
                                                <Badge variant="warning">Simulated Card Reader</Badge>
                                                <div className="text-lg font-bold font-mono">
                                                    {formatCents(totalDueCents)}
                                                </div>
                                                <p className="text-xs text-muted-foreground">
                                                    Choose an issuer response to complete or test partial-settlement recovery:
                                                </p>
                                                <div className="grid gap-2 sm:grid-cols-2">
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        className="border-rose-300 text-rose-700 hover:bg-rose-50"
                                                        onClick={() => handlePay(true)}
                                                    >
                                                        Decline Card
                                                    </Button>
                                                    <Button type="button" onClick={() => handlePay(false)}>
                                                        Approve Payment
                                                    </Button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                )}

                                {tenderMethod === 'qr' && (
                                    <div className="space-y-4 rounded-2xl border border-border bg-muted/25 p-5 text-center">
                                        <QrCode className="mx-auto h-12 w-12 text-primary" />
                                        <div>
                                            <div className="text-base font-bold">
                                                Scan QR Total: {formatCents(totalDueCents)}
                                            </div>
                                            <p className="mt-1 text-xs text-muted-foreground">
                                                Guest scans table wallet QR and confirms digital transfer.
                                            </p>
                                        </div>
                                        <Button
                                            type="button"
                                            onClick={() => handlePay(false)}
                                            className="w-full rounded-xl py-5 text-sm font-bold"
                                        >
                                            Confirm QR Settlement ({formatCents(totalDueCents)})
                                        </Button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
