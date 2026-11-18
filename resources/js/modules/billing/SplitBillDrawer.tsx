import { useState } from 'react';
import { router } from '@inertiajs/react';
import { motion } from 'motion/react';
import { Split, Users, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCents } from '@/lib/money';
import type { SplitModeValue } from '@/types/billing';
import type { ActiveOrderData } from '@/types/pos';

interface SplitBillDrawerProps {
    open: boolean;
    order: ActiveOrderData | null;
    onClose: () => void;
    onProceedToPay: () => void;
}

export function SplitBillDrawer({
    open,
    order,
    onClose,
    onProceedToPay,
}: SplitBillDrawerProps) {
    const [mode, setMode] = useState<SplitModeValue>('equal');
    const [equalWays, setEqualWays] = useState(2);
    const [seatCount, setSeatCount] = useState(2);
    const [itemSeatMap, setItemSeatMap] = useState<Record<number, number | 'shared'>>({});
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    if (!open || !order) {
        return null;
    }

    const billableItems = order.items.filter((i) => i.prep_state !== 'voided');

    const applySplit = (proceedToPay: boolean) => {
        setErrorMsg(null);

        if (mode === 'unified') {
            router.post(
                `/billing/orders/${order.id}/split`,
                { mode: 'unified' },
                {
                    preserveScroll: true,
                    onSuccess: () => (proceedToPay ? onProceedToPay() : onClose()),
                    onError: (errors) => setErrorMsg(errors.split || 'Could not apply split.'),
                },
            );
            return;
        }

        if (mode === 'equal') {
            router.post(
                `/billing/orders/${order.id}/split`,
                { mode: 'equal', equal_ways: equalWays },
                {
                    preserveScroll: true,
                    onSuccess: () => (proceedToPay ? onProceedToPay() : onClose()),
                    onError: (errors) => setErrorMsg(errors.split || 'Could not split equally.'),
                },
            );
            return;
        }

        const seatGroups: Record<string, { order_item_id: number; share_numerator: number; share_denominator: number }[]> = {};
        for (let s = 1; s <= seatCount; s++) {
            seatGroups[`Check ${s}`] = [];
        }

        billableItems.forEach((item) => {
            const assignment = itemSeatMap[item.id] ?? 1;
            if (assignment === 'shared') {
                for (let s = 1; s <= seatCount; s++) {
                    seatGroups[`Check ${s}`].push({
                        order_item_id: item.id,
                        share_numerator: 1,
                        share_denominator: seatCount,
                    });
                }
            } else {
                const targetSeat = Math.min(seatCount, Math.max(1, assignment));
                seatGroups[`Check ${targetSeat}`].push({
                    order_item_id: item.id,
                    share_numerator: 1,
                    share_denominator: 1,
                });
            }
        });

        router.post(
            `/billing/orders/${order.id}/split`,
            { mode: 'item_seat', seat_groups: seatGroups },
            {
                preserveScroll: true,
                onSuccess: () => (proceedToPay ? onProceedToPay() : onClose()),
                onError: (errors) => setErrorMsg(errors.split || 'Check item seat assignments.'),
            },
        );
    };

    const equalPreview = Array.from({ length: equalWays }, (_, idx) => {
        const base = Math.floor(order.total_cents / equalWays);
        const rem = order.total_cents % equalWays;
        return base + (idx >= equalWays - rem ? 1 : 0);
    });

    return (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs">
            <motion.div
                initial={{ x: 360 }}
                animate={{ x: 0 }}
                exit={{ x: 360 }}
                className="flex h-full w-full max-w-lg flex-col border-l border-border bg-card shadow-2xl"
            >
                <div className="flex items-center justify-between border-b border-border px-5 py-4">
                    <div className="flex items-center gap-2">
                        <Split className="h-5 w-5 text-primary" />
                        <div>
                            <h3 className="text-base font-bold">Split Bill — {order.order_number}</h3>
                            <p className="text-xs text-muted-foreground">
                                Order Total: <span className="font-mono font-semibold">{formatCents(order.total_cents)}</span>
                            </p>
                        </div>
                    </div>
                    <button type="button" onClick={onClose} className="rounded p-1 hover:bg-muted cursor-pointer">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="flex-1 space-y-5 overflow-y-auto p-5">
                    <div className="grid grid-cols-3 gap-2">
                        {[
                            { value: 'unified' as const, label: 'One Bill' },
                            { value: 'equal' as const, label: 'Equal N-Way' },
                            { value: 'item_seat' as const, label: 'By Item / Seat' },
                        ].map((tab) => (
                            <Button
                                key={tab.value}
                                type="button"
                                variant={mode === tab.value ? 'default' : 'outline'}
                                onClick={() => setMode(tab.value)}
                            >
                                {tab.label}
                            </Button>
                        ))}
                    </div>

                    {errorMsg && (
                        <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-xs font-medium text-rose-700">
                            {errorMsg}
                        </div>
                    )}

                    {mode === 'unified' && (
                        <div className="rounded-xl border border-border bg-background/60 p-4 text-sm">
                            <p className="font-semibold">Single Unified Check</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                                Settles the full {formatCents(order.total_cents)} balance on one receipt.
                            </p>
                        </div>
                    )}

                    {mode === 'equal' && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">Number of Equal Checks</span>
                                <div className="flex items-center gap-1.5">
                                    {[2, 3, 4, 5, 6].map((n) => (
                                        <Button
                                            key={n}
                                            size="sm"
                                            variant={equalWays === n ? 'default' : 'outline'}
                                            onClick={() => setEqualWays(n)}
                                        >
                                            {n}×
                                        </Button>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                {equalPreview.map((cents, idx) => (
                                    <div
                                        key={idx}
                                        className="flex items-center justify-between rounded-xl border border-border bg-background/70 px-3 py-2 text-sm"
                                    >
                                        <span className="font-medium">Check {idx + 1}</span>
                                        <span className="font-mono font-bold">{formatCents(cents)}</span>
                                    </div>
                                ))}
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                                Deterministic integer-cent distribution puts any odd pennies on the final check(s).
                            </p>
                        </div>
                    )}

                    {mode === 'item_seat' && (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="inline-flex items-center gap-1.5 text-sm font-medium">
                                    <Users className="h-4 w-4" /> Guest Checks
                                </span>
                                <div className="flex gap-1.5">
                                    {[2, 3, 4].map((n) => (
                                        <Button
                                            key={n}
                                            size="sm"
                                            variant={seatCount === n ? 'default' : 'outline'}
                                            onClick={() => setSeatCount(n)}
                                        >
                                            {n} Checks
                                        </Button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-2">
                                {billableItems.map((item) => {
                                    const current = itemSeatMap[item.id] ?? 1;

                                    return (
                                        <div
                                            key={item.id}
                                            className="rounded-xl border border-border bg-background/70 p-3 space-y-2"
                                        >
                                            <div className="flex justify-between text-sm font-medium">
                                                <span>
                                                    {item.quantity}× {item.item_name}
                                                </span>
                                                <span className="font-mono">{formatCents(item.line_total_cents)}</span>
                                            </div>
                                            <div className="flex flex-wrap gap-1.5">
                                                {Array.from({ length: seatCount }, (_, idx) => idx + 1).map((seat) => (
                                                    <Button
                                                        key={seat}
                                                        size="sm"
                                                        variant={current === seat ? 'default' : 'outline'}
                                                        onClick={() =>
                                                            setItemSeatMap((prev) => ({ ...prev, [item.id]: seat }))
                                                        }
                                                    >
                                                        Check {seat}
                                                    </Button>
                                                ))}
                                                <Button
                                                    size="sm"
                                                    variant={current === 'shared' ? 'default' : 'secondary'}
                                                    onClick={() =>
                                                        setItemSeatMap((prev) => ({ ...prev, [item.id]: 'shared' }))
                                                    }
                                                >
                                                    Share 1/{seatCount}
                                                </Button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex justify-end gap-2 border-t border-border p-4">
                    <Button type="button" variant="outline" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button type="button" variant="secondary" onClick={() => applySplit(false)}>
                        Save Split
                    </Button>
                    <Button type="button" onClick={() => applySplit(true)}>
                        Save &amp; Collect Payment
                    </Button>
                </div>
            </motion.div>
        </div>
    );
}
