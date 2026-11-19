import { useState } from 'react';
import { Head, router, usePage } from '@inertiajs/react';
import { LockKeyhole, ShieldAlert, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard, StatusPill } from '@/design-system';
import { PosAppLayout } from '@/layouts/PosAppLayout';
import { formatCents } from '@/lib/money';
import type { ShiftSummaryRow } from '@/types/billing';
import type { PosSharedProps } from '@/types/pos-app';

interface ShiftsPageProps {
    shifts: ShiftSummaryRow[];
}

export default function ShiftsPage({ shifts }: ShiftsPageProps) {
    const { auth } = usePage<PosSharedProps>().props;
    const activeShift = auth?.activeShift;

    const [openingDollars, setOpeningDollars] = useState('250.00');
    const [countedDollars, setCountedDollars] = useState('');
    const [notes, setNotes] = useState('');
    const [pinInput, setPinInput] = useState<Record<number, string>>({});
    const [noteInput, setNoteInput] = useState<Record<number, string>>({});
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const handleOpenShift = (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMessage(null);
        const cents = Math.round(Number.parseFloat(openingDollars) * 100) || 0;
        router.post(
            '/shifts/open',
            { opening_cash_cents: cents },
            {
                preserveScroll: true,
                onError: (errors) => setErrorMessage(errors.shift || 'Could not open shift.'),
            },
        );
    };

    const handleCloseShift = (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeShift) return;
        setErrorMessage(null);
        const cents = Math.round(Number.parseFloat(countedDollars) * 100);
        if (!Number.isFinite(cents) || cents < 0) {
            setErrorMessage('Enter a valid counted cash dollar amount.');
            return;
        }
        router.post(
            `/shifts/${activeShift.id}/close`,
            { counted_cash_cents: cents, notes: notes.trim() || null },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setCountedDollars('');
                    setNotes('');
                },
                onError: (errors) => setErrorMessage(errors.shift || 'Could not close shift.'),
            },
        );
    };

    const handleApproveVariance = (shiftId: number) => {
        setErrorMessage(null);
        router.post(
            `/shifts/${shiftId}/approve-variance`,
            {
                manager_pin: pinInput[shiftId] ?? '',
                resolution_note: noteInput[shiftId] ?? 'Verified cash count',
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setPinInput((prev) => ({ ...prev, [shiftId]: '' }));
                },
                onError: (errors) =>
                    setErrorMessage(errors.manager_pin || errors.shift || 'Approval failed.'),
            },
        );
    };

    const varianceFlaggedCount = shifts.filter((s) => s.state === 'variance_flagged').length;

    return (
        <PosAppLayout
            title="Cash Drawer & Shifts"
            subtitle="Open a register float, submit blind cash counts at close, and review drawer variances."
        >
            <Head title="Shifts & Cash Drawer — Aurelia POS" />

            <div className="space-y-6">
                {errorMessage && (
                    <div className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm font-medium text-rose-700">
                        {errorMessage}
                    </div>
                )}

                {activeShift && (
                    <div className="grid gap-4 sm:grid-cols-3">
                        <StatCard
                            label="Opening Float"
                            value={formatCents(activeShift.opening_cash_cents)}
                            icon={<Wallet className="h-4.5 w-4.5" />}
                            tone="slate"
                            subtitle={activeShift.opened_at ?? 'Current shift'}
                        />
                        <StatCard
                            label="Expected Drawer Cash"
                            value={formatCents(activeShift.expected_cash_cents)}
                            icon={<Wallet className="h-4.5 w-4.5" />}
                            tone="emerald"
                            subtitle="Float + captured cash sales"
                        />
                        <StatCard
                            label="Variance Flags"
                            value={varianceFlaggedCount}
                            icon={<ShieldAlert className="h-4.5 w-4.5" />}
                            tone={varianceFlaggedCount > 0 ? 'rose' : 'emerald'}
                            subtitle="Pending Manager PIN review"
                        />
                    </div>
                )}

                <Card>
                    <CardHeader className="border-b border-border/60 bg-[var(--surface-inset)]/60">
                        <CardTitle className="flex items-center gap-2">
                            <Wallet className="h-4.5 w-4.5 text-primary" />
                            <span>
                                {activeShift ? 'Active Register Drawer' : 'Open New Cash Drawer Shift'}
                            </span>
                        </CardTitle>
                        <CardDescription>
                            {activeShift
                                ? `Opened at ${activeShift.opened_at ?? 'shift start'} · Expected cash ${formatCents(activeShift.expected_cash_cents)}`
                                : 'No open register shift at this branch. Enter opening float to start taking orders.'}
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="p-5 sm:p-6">
                        {!activeShift ? (
                            <form onSubmit={handleOpenShift} className="flex flex-wrap items-end gap-3">
                                <label className="space-y-1.5 text-xs">
                                    <span className="ds-label block">Opening Float ($)</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={openingDollars}
                                        onChange={(e) => setOpeningDollars(e.target.value)}
                                        className="h-11 block w-48 rounded-xl border border-input bg-[var(--surface-inset)] px-3.5 font-mono text-sm focus:border-primary focus:bg-card focus:outline-none"
                                    />
                                </label>
                                <Button type="submit" size="lg">
                                    Open Shift
                                </Button>
                            </form>
                        ) : (
                            <form
                                onSubmit={handleCloseShift}
                                className="grid gap-4 md:grid-cols-3 md:items-end"
                            >
                                <label className="space-y-1.5 text-xs">
                                    <span className="ds-label block">
                                        Blind Counted Cash ($) — Expected{' '}
                                        {formatCents(activeShift.expected_cash_cents)}
                                    </span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        required
                                        value={countedDollars}
                                        onChange={(e) => setCountedDollars(e.target.value)}
                                        placeholder="0.00"
                                        className="h-11 w-full rounded-xl border border-input bg-[var(--surface-inset)] px-3.5 font-mono text-sm focus:border-primary focus:bg-card focus:outline-none"
                                    />
                                </label>

                                <label className="space-y-1.5 text-xs">
                                    <span className="ds-label block">Closing Notes (Optional)</span>
                                    <input
                                        type="text"
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        placeholder="End of evening count"
                                        className="h-11 w-full rounded-xl border border-input bg-[var(--surface-inset)] px-3.5 text-sm focus:border-primary focus:bg-card focus:outline-none"
                                    />
                                </label>

                                <Button
                                    type="submit"
                                    variant="outline"
                                    size="lg"
                                    className="border-primary/40 text-primary hover:bg-accent"
                                >
                                    <LockKeyhole className="h-4 w-4" />
                                    <span>Submit Blind Count &amp; Close</span>
                                </Button>
                            </form>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="border-b border-border/60 bg-[var(--surface-inset)]/60">
                        <CardTitle>Shift Reconciliation History</CardTitle>
                        <CardDescription>
                            Variances outside branch tolerance require Manager PIN sign-off.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3 p-5 sm:p-6">
                        {shifts.length === 0 ? (
                            <p className="py-8 text-center text-sm text-muted-foreground">
                                No shift records found.
                            </p>
                        ) : (
                            shifts.map((shift) => (
                                <div
                                    key={shift.id}
                                    className="space-y-3 rounded-2xl border border-border bg-[var(--surface-inset)] p-4 text-xs"
                                >
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div className="flex items-center gap-2.5 text-sm font-semibold">
                                            <span>{shift.user_name ?? 'Cashier'}</span>
                                            <StatusPill
                                                tone={
                                                    shift.state === 'open'
                                                        ? 'success'
                                                        : shift.state === 'variance_flagged'
                                                          ? 'danger'
                                                          : 'neutral'
                                                }
                                                pulse={shift.state === 'open' || shift.state === 'variance_flagged'}
                                                label={shift.state.replace('_', ' ')}
                                            />
                                        </div>
                                        <span className="font-mono text-muted-foreground tabular-nums">
                                            Opening {formatCents(shift.opening_cash_cents)} · Expected{' '}
                                            {formatCents(shift.expected_cash_cents ?? 0)}
                                            {shift.counted_cash_cents !== null &&
                                                ` · Counted ${formatCents(shift.counted_cash_cents)}`}
                                            {shift.variance_cents !== null &&
                                                ` · Variance ${formatCents(shift.variance_cents)}`}
                                        </span>
                                    </div>

                                    {shift.state === 'variance_flagged' && (
                                        <div className="flex flex-wrap items-center gap-2.5 rounded-xl border border-rose-500/25 bg-rose-500/8 p-3">
                                            <ShieldAlert className="h-4 w-4 shrink-0 text-rose-600" />
                                            <input
                                                type="text"
                                                placeholder="Resolution note"
                                                value={noteInput[shift.id] ?? ''}
                                                onChange={(e) =>
                                                    setNoteInput((prev) => ({
                                                        ...prev,
                                                        [shift.id]: e.target.value,
                                                    }))
                                                }
                                                className="h-9 min-w-[160px] flex-1 rounded-xl border border-input bg-card px-3 text-xs focus:border-primary focus:outline-none"
                                            />
                                            <input
                                                type="password"
                                                inputMode="numeric"
                                                maxLength={4}
                                                placeholder="Manager PIN"
                                                value={pinInput[shift.id] ?? ''}
                                                onChange={(e) =>
                                                    setPinInput((prev) => ({
                                                        ...prev,
                                                        [shift.id]: e.target.value,
                                                    }))
                                                }
                                                className="h-9 w-28 rounded-xl border border-input bg-card px-3 text-center font-mono text-xs tracking-widest focus:border-primary focus:outline-none"
                                            />
                                            <Button
                                                type="button"
                                                size="sm"
                                                onClick={() => handleApproveVariance(shift.id)}
                                            >
                                                Approve Variance
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </CardContent>
                </Card>
            </div>
        </PosAppLayout>
    );
}
