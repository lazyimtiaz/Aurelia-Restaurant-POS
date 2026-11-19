import { useEffect, useState } from 'react';
import { router } from '@inertiajs/react';
import { motion } from 'motion/react';
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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { IconBadge, MotionModal, StatusPill } from '@/design-system';
import { formatCents } from '@/lib/money';
import { cn } from '@/lib/utils';
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
    const [submitting, setSubmitting] = useState(false);
    const [paymentError, setPaymentError] = useState<string | null>(null);
    const [idempotencyKey, setIdempotencyKey] = useState<string>(() => crypto.randomUUID());

    const [splitPanelOpen, setSplitPanelOpen] = useState(false);
    const [splitMode, setSplitMode] = useState<SplitModeValue>('equal');
    const [equalWays, setEqualWays] = useState(2);
    const [seatMap, setSeatMap] = useState<Record<number, number>>({});

    useEffect(() => {
        if (!open || !order) return;
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

    const activeSplit = splits.find((s) => s.id === selectedSplitId) ?? firstPending;
    const tipCents = activeSplit ? Math.floor((activeSplit.total_cents * tipPercent) / 100) : 0;
    const totalDueCents = (activeSplit?.total_cents ?? 0) + tipCents;
    const parsedCashCents = cashInput.trim()
        ? Math.round(Number.parseFloat(cashInput) * 100) || 0
        : totalDueCents;
    const changeDueCents = Math.max(0, parsedCashCents - totalDueCents);
    const canModifySplit = order?.state === 'billing';
    const activeItems = order?.items.filter((i) => i.prep_state !== 'voided') ?? [];

    const handlePay = (simulateDecline = false) => {
        if (!activeSplit || submitting) return;
        setPaymentError(null);
        setSubmitting(true);

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
                onFinish: () => setSubmitting(false),
            },
        );
    };

    const handleApplySplit = (targetMode: SplitModeValue) => {
        if (!order) return;
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
        const seatGroups: Record<
            string,
            { order_item_id: number; share_numerator: number; share_denominator: number }[]
        > = {};
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
        if (key === '.' && cashInput.includes('.')) return;
        setCashInput((prev) => (prev === '0' && key !== '.' ? key : prev + key));
    };

    return (
        <MotionModal
            open={open && order !== null}
            onClose={onClose}
            title="Payment & Check Settlement"
            description={
                order
                    ? `${order.order_number} · ${
                          order.table_code
                              ? `Table ${order.table_code}`
                              : order.customer_name || 'Takeaway'
                      }`
                    : undefined
            }
            icon={
                <IconBadge tone="emerald" shape="squircle">
                    <Receipt className="h-4.5 w-4.5" />
                </IconBadge>
            }
            maxWidth="4xl"
        >
            {order && (
                <div>
                    {canModifySplit && (
                        <div className="flex flex-wrap items-center justify-end gap-2 border-b border-border bg-card px-5 py-2.5 sm:px-6">
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => setSplitPanelOpen((prev) => !prev)}
                            >
                                <Split className="h-3.5 w-3.5" />
                                <span>{splitPanelOpen ? 'Close Split Options' : 'Split Check'}</span>
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
                                <span>Reopen Order</span>
                            </Button>
                        </div>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-12">
                        {/* Left Receipt & Split Checks Column */}
                        <div className="space-y-4 border-b border-border bg-[var(--surface-inset)] p-5 sm:p-6 lg:col-span-5 lg:border-r lg:border-b-0">
                            {order.state === 'partially_paid' && (
                                <div className="flex items-start gap-2.5 rounded-2xl border border-amber-500/30 bg-amber-500/12 p-3 text-xs font-medium text-amber-900">
                                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                                    <span>
                                        Partial settlement active. Settled checks are locked; complete remaining unpaid checks.
                                    </span>
                                </div>
                            )}

                            {splitPanelOpen && canModifySplit && (
                                <div className="space-y-3 rounded-2xl border border-primary/25 bg-card p-4 shadow-bistro-card">
                                    <div className="flex flex-wrap gap-1.5">
                                        <button
                                            type="button"
                                            onClick={() => handleApplySplit('unified')}
                                            className="rounded-lg border border-border px-2.5 py-1 text-xs font-semibold hover:bg-secondary cursor-pointer"
                                        >
                                            Single Check
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setSplitMode('equal')}
                                            className={cn(
                                                'rounded-lg px-2.5 py-1 text-xs font-semibold cursor-pointer',
                                                splitMode === 'equal'
                                                    ? 'bg-primary text-primary-foreground'
                                                    : 'border border-border hover:bg-secondary',
                                            )}
                                        >
                                            Equal Split
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setSplitMode('item_seat')}
                                            className={cn(
                                                'inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold cursor-pointer',
                                                splitMode === 'item_seat'
                                                    ? 'bg-primary text-primary-foreground'
                                                    : 'border border-border hover:bg-secondary',
                                            )}
                                        >
                                            <Users className="h-3 w-3" />
                                            <span>By Seat</span>
                                        </button>
                                    </div>

                                    {splitMode === 'equal' && (
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex gap-1.5">
                                                {[2, 3, 4, 5].map((n) => (
                                                    <button
                                                        key={n}
                                                        type="button"
                                                        onClick={() => setEqualWays(n)}
                                                        className={cn(
                                                            'rounded-lg px-2.5 py-1 font-mono text-xs font-bold cursor-pointer',
                                                            equalWays === n
                                                                ? 'bg-accent text-primary ring-1 ring-primary/30'
                                                                : 'bg-secondary text-stone-700',
                                                        )}
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
                                                        className="rounded-lg border border-input bg-card px-2 py-1 text-xs"
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
                                    <span className="ds-overline block">Checks ({splits.length})</span>
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
                                                    className={cn(
                                                        'flex items-center justify-between rounded-2xl border p-3.5 text-sm transition cursor-pointer',
                                                        isSelected
                                                            ? 'border-primary bg-card ring-2 ring-primary/20 shadow-bistro-card'
                                                            : 'border-border bg-card/75 hover:bg-card',
                                                    )}
                                                >
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-2 font-semibold">
                                                            <span className="truncate">{split.label}</span>
                                                            <StatusPill
                                                                tone={
                                                                    split.state === 'paid'
                                                                        ? 'success'
                                                                        : split.state === 'failed'
                                                                          ? 'danger'
                                                                          : 'neutral'
                                                                }
                                                                label={split.state}
                                                            />
                                                        </div>
                                                        <div className="mt-0.5 font-mono text-[11px] text-muted-foreground tabular-nums">
                                                            Subtotal {formatCents(split.subtotal_cents)} · Tax{' '}
                                                            {formatCents(split.tax_cents)}
                                                        </div>
                                                    </div>

                                                    <div className="shrink-0 text-right pl-2">
                                                        <div className="ds-num-sm text-foreground">
                                                            {formatCents(split.total_cents)}
                                                        </div>
                                                        {split.state === 'paid' && (
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    onOpenReceipt(split.id);
                                                                }}
                                                                className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline cursor-pointer"
                                                            >
                                                                <Receipt className="h-3 w-3" />
                                                                <span>Receipt</span>
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Thermal Paper Receipt Preview Card */}
                            <div className="receipt-serrated rounded-t-2xl border border-border bg-card p-4 pb-6 space-y-3 text-xs shadow-bistro-card">
                                <span className="ds-overline block text-foreground">Transaction Details</span>
                                <div className="max-h-36 space-y-1.5 overflow-y-auto border-b border-dashed border-border pb-3">
                                    {activeItems.map((item) => (
                                        <div key={item.id} className="flex justify-between gap-2">
                                            <span className="truncate text-foreground">
                                                {item.quantity}× {item.item_name}
                                            </span>
                                            <span className="shrink-0 font-mono font-semibold text-foreground tabular-nums">
                                                {formatCents(item.line_total_cents)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                                {activeSplit && (
                                    <div className="space-y-1.5 pt-1">
                                        <div className="flex justify-between text-muted-foreground">
                                            <span>Check Total</span>
                                            <span className="font-mono tabular-nums">
                                                {formatCents(activeSplit.total_cents)}
                                            </span>
                                        </div>
                                        <div className="flex justify-between text-muted-foreground">
                                            <span>Gratuity ({tipPercent}%)</span>
                                            <span className="font-mono tabular-nums">{formatCents(tipCents)}</span>
                                        </div>
                                        <div className="flex justify-between border-t border-dashed border-border pt-2 text-sm font-bold text-foreground">
                                            <span>Total Due</span>
                                            <span className="ds-num-sm text-primary">
                                                {formatCents(totalDueCents)}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right Settlement Controls Column */}
                        <div className="space-y-5 p-5 sm:p-6 lg:col-span-7">
                            {!activeSplit || activeSplit.state === 'paid' ? (
                                <div className="flex h-full flex-col items-center justify-center space-y-4 py-12 text-center">
                                    <IconBadge tone="emerald" size="lg">
                                        <CheckCircle2 className="h-6 w-6" />
                                    </IconBadge>
                                    <div>
                                        <div className="ds-section-title">Selected Check Settled</div>
                                        <p className="ds-caption mt-1">
                                            Guest payment has been captured and ledgered.
                                        </p>
                                    </div>
                                    {activeSplit && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => onOpenReceipt(activeSplit.id)}
                                        >
                                            <Receipt className="h-4 w-4" />
                                            <span>View Thermal Receipt</span>
                                        </Button>
                                    )}
                                </div>
                            ) : (
                                <>
                                    {paymentError && (
                                        <div className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-3.5 py-2.5 text-xs font-medium text-rose-700">
                                            {paymentError}
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        <span className="ds-overline block">Payment Method</span>
                                        <div className="grid grid-cols-3 gap-2">
                                            {(
                                                [
                                                    ['cash', 'Cash', Banknote],
                                                    ['card', 'Card Terminal', CreditCard],
                                                    ['qr', 'Mobile QR', QrCode],
                                                ] as const
                                            ).map(([method, label, Icon]) => (
                                                <motion.button
                                                    key={method}
                                                    type="button"
                                                    whileTap={{ scale: 0.97 }}
                                                    onClick={() => {
                                                        setTenderMethod(method);
                                                        setCardReaderOpen(false);
                                                        setPaymentError(null);
                                                    }}
                                                    className={cn(
                                                        'flex flex-col sm:flex-row items-center justify-center gap-1.5 rounded-xl border px-2 py-2.5 text-xs font-semibold transition cursor-pointer',
                                                        tenderMethod === method
                                                            ? 'border-primary bg-accent text-primary ring-2 ring-primary/20'
                                                            : 'border-border bg-[var(--surface-inset)] text-foreground hover:bg-secondary/70',
                                                    )}
                                                >
                                                    <Icon className="h-4 w-4 shrink-0" />
                                                    <span className="truncate">{label}</span>
                                                </motion.button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <span className="ds-overline block">Gratuity</span>
                                        <div className="grid grid-cols-4 gap-2">
                                            {[0, 10, 15, 20].map((pct) => (
                                                <button
                                                    key={pct}
                                                    type="button"
                                                    onClick={() => setTipPercent(pct)}
                                                    className={cn(
                                                        'rounded-xl border py-2 font-mono text-xs font-semibold transition cursor-pointer',
                                                        tipPercent === pct
                                                            ? 'border-primary bg-accent text-primary'
                                                            : 'border-border bg-card text-foreground hover:bg-[var(--surface-inset)]',
                                                    )}
                                                >
                                                    {pct === 0 ? 'No Tip' : `${pct}%`}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {tenderMethod === 'cash' && (
                                        <div className="space-y-3.5">
                                            <div className="flex items-center justify-between rounded-2xl border border-border bg-[var(--surface-inset)] px-4 py-3">
                                                <div>
                                                    <span className="ds-overline block">Cash Tendered</span>
                                                    <div className="ds-num-lg text-foreground">
                                                        {formatCents(parsedCashCents)}
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <span className="ds-overline block">Change Due</span>
                                                    <div className="ds-num-md text-emerald-600">
                                                        {formatCents(changeDueCents)}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex flex-wrap gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() => setCashInput((totalDueCents / 100).toFixed(2))}
                                                    className="rounded-xl bg-accent px-3 py-1.5 text-xs font-semibold text-primary hover:bg-orange-100 cursor-pointer"
                                                >
                                                    Exact ({formatCents(totalDueCents)})
                                                </button>
                                                {[5, 10, 20, 50, 100].map((bill) => (
                                                    <button
                                                        key={bill}
                                                        type="button"
                                                        onClick={() => setCashInput(String(bill))}
                                                        className="rounded-xl border border-border bg-card px-3 py-1.5 font-mono text-xs font-semibold hover:bg-secondary cursor-pointer"
                                                    >
                                                        ${bill}
                                                    </button>
                                                ))}
                                            </div>

                                            <div className="grid grid-cols-3 gap-2">
                                                {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'].map(
                                                    (key) => (
                                                        <motion.button
                                                            key={key}
                                                            type="button"
                                                            whileTap={{ scale: 0.94 }}
                                                            onClick={() => handleKeypadDigit(key)}
                                                            className="flex h-12 items-center justify-center rounded-xl border border-border bg-card font-mono text-base font-bold shadow-[0_1px_2px_rgba(24,21,18,0.04)] hover:border-primary/40 hover:bg-accent/50 cursor-pointer select-none"
                                                        >
                                                            {key === '⌫' ? <Delete className="h-4 w-4" /> : key}
                                                        </motion.button>
                                                    ),
                                                )}
                                            </div>

                                            <Button
                                                type="button"
                                                size="xl"
                                                loading={submitting}
                                                onClick={() => handlePay(false)}
                                                disabled={parsedCashCents < totalDueCents}
                                                className="w-full"
                                            >
                                                Pay {formatCents(totalDueCents)} Cash
                                            </Button>
                                        </div>
                                    )}

                                    {tenderMethod === 'card' && (
                                        <div className="space-y-4 rounded-2xl border border-border bg-[var(--surface-inset)] p-6 text-center">
                                            {!cardReaderOpen ? (
                                                <>
                                                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-primary ring-1 ring-primary/20">
                                                        <CreditCard className="h-7 w-7" />
                                                    </div>
                                                    <div>
                                                        <div className="ds-num-md text-foreground">
                                                            {formatCents(totalDueCents)}
                                                        </div>
                                                        <p className="ds-caption mt-1">
                                                            Dispatch amount to countertop EMV &amp; contactless reader.
                                                        </p>
                                                    </div>
                                                    <Button
                                                        type="button"
                                                        size="xl"
                                                        onClick={() => setCardReaderOpen(true)}
                                                        className="w-full"
                                                    >
                                                        Present Card ({formatCents(totalDueCents)})
                                                    </Button>
                                                </>
                                            ) : (
                                                <>
                                                    <div className="relative mx-auto flex h-24 w-24 items-center justify-center">
                                                        <motion.span
                                                            animate={{ scale: [1, 1.45, 1], opacity: [0.6, 0, 0.6] }}
                                                            transition={{ duration: 1.8, repeat: Infinity }}
                                                            className="absolute inset-0 rounded-full border-2 border-primary/40"
                                                        />
                                                        <motion.span
                                                            animate={{ scale: [1, 1.25, 1], opacity: [0.8, 0.15, 0.8] }}
                                                            transition={{ duration: 1.8, repeat: Infinity, delay: 0.35 }}
                                                            className="absolute inset-2 rounded-full border-2 border-primary/50"
                                                        />
                                                        <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md">
                                                            <CreditCard className="h-6 w-6" />
                                                        </div>
                                                    </div>
                                                    <StatusPill tone="warning" pulse label="Waiting for Card Tap / Insert" />
                                                    <div className="ds-num-lg">{formatCents(totalDueCents)}</div>
                                                    <p className="ds-caption">
                                                        Choose an issuer simulation response to test approval or recovery:
                                                    </p>
                                                    <div className="grid gap-2.5 sm:grid-cols-2">
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="lg"
                                                            disabled={submitting}
                                                            className="border-rose-300 text-rose-700 hover:bg-rose-50"
                                                            onClick={() => handlePay(true)}
                                                        >
                                                            Decline Card
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            size="lg"
                                                            loading={submitting}
                                                            onClick={() => handlePay(false)}
                                                        >
                                                            Approve Payment
                                                        </Button>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    )}

                                    {tenderMethod === 'qr' && (
                                        <div className="space-y-4 rounded-2xl border border-border bg-[var(--surface-inset)] p-6 text-center">
                                            <div className="mx-auto flex h-32 w-32 items-center justify-center rounded-2xl border-2 border-primary/25 bg-card p-3 shadow-bistro-card">
                                                <QrCode className="h-24 w-24 text-foreground" />
                                            </div>
                                            <div>
                                                <div className="ds-num-md text-foreground">
                                                    {formatCents(totalDueCents)}
                                                </div>
                                                <p className="ds-caption mt-1">
                                                    Guest scans table wallet QR to settle transaction instantly.
                                                </p>
                                            </div>
                                            <Button
                                                type="button"
                                                size="xl"
                                                loading={submitting}
                                                onClick={() => handlePay(false)}
                                                className="w-full"
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
            )}
        </MotionModal>
    );
}
