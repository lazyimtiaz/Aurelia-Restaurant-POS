import { useState } from 'react';
import { Head, router, usePage } from '@inertiajs/react';
import { LockKeyhole, ShieldAlert, Wallet } from 'lucide-react';
import { PosAppLayout } from '@/layouts/PosAppLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
        if (!activeShift) {
            return;
        }
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
                onError: (errors) => setErrorMessage(errors.manager_pin || errors.shift || 'Approval failed.'),
            },
        );
    };

    return (
        <PosAppLayout
            title="Cash Drawer & Shifts"
            subtitle="Open a register float, submit blind cash counts at close, and review variances."
        >
            <Head title="Shifts & Cash Drawer — Aurelia POS" />

            <div className="space-y-6">
                {errorMessage && (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">
                        {errorMessage}
                    </div>
                )}

                <Card className="rounded-2xl">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Wallet className="h-5 w-5 text-primary" />
                            {activeShift ? 'Active Register Drawer' : 'Open New Cash Drawer Shift'}
                        </CardTitle>
                        <CardDescription>
                            {activeShift
                                ? `Opened at ${activeShift.opened_at ?? 'shift start'} · Expected cash ${formatCents(activeShift.expected_cash_cents)}`
                                : 'No open register shift at this branch. Enter opening float to start taking orders.'}
                        </CardDescription>
                    </CardHeader>

                    <CardContent>
                        {!activeShift ? (
                            <form onSubmit={handleOpenShift} className="flex flex-wrap items-end gap-3">
                                <label className="space-y-1 text-xs">
                                    <span className="font-semibold text-stone-700">Opening Float ($)</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={openingDollars}
                                        onChange={(e) => setOpeningDollars(e.target.value)}
                                        className="block w-44 rounded-xl border border-input bg-background px-3 py-2 font-mono text-sm"
                                    />
                                </label>
                                <Button type="submit" className="rounded-xl">
                                    Open Shift
                                </Button>
                            </form>
                        ) : (
                            <form onSubmit={handleCloseShift} className="grid gap-4 md:grid-cols-3 md:items-end">
                                <label className="space-y-1 text-xs">
                                    <span className="font-semibold text-stone-700">
                                        Blind Counted Cash ($) — Expected {formatCents(activeShift.expected_cash_cents)}
                                    </span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        required
                                        value={countedDollars}
                                        onChange={(e) => setCountedDollars(e.target.value)}
                                        placeholder="0.00"
                                        className="w-full rounded-xl border border-input bg-background px-3 py-2 font-mono text-sm"
                                    />
                                </label>

                                <label className="space-y-1 text-xs">
                                    <span className="font-semibold text-stone-700">Closing Notes (Optional)</span>
                                    <input
                                        type="text"
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        placeholder="End of evening count"
                                        className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                                    />
                                </label>

                                <Button type="submit" variant="outline" className="rounded-xl border-orange-300 text-orange-700 hover:bg-orange-50">
                                    <LockKeyhole className="h-4 w-4" />
                                    Submit Blind Count &amp; Close
                                </Button>
                            </form>
                        )}
                    </CardContent>
                </Card>

                <Card className="rounded-2xl">
                    <CardHeader>
                        <CardTitle>Shift Reconciliation History</CardTitle>
                        <CardDescription>
                            Variances outside branch tolerance require Manager PIN sign-off.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {shifts.length === 0 ? (
                            <p className="py-6 text-center text-sm text-muted-foreground">No shift records found.</p>
                        ) : (
                            shifts.map((shift) => (
                                <div
                                    key={shift.id}
                                    className="rounded-xl border border-border bg-muted/25 p-4 text-xs space-y-2.5"
                                >
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div className="flex items-center gap-2 font-semibold text-sm">
                                            <span>{shift.user_name ?? 'Cashier'}</span>
                                            <Badge
                                                variant={
                                                    shift.state === 'open'
                                                        ? 'success'
                                                        : shift.state === 'variance_flagged'
                                                          ? 'destructive'
                                                          : 'outline'
                                                }
                                            >
                                                {shift.state}
                                            </Badge>
                                        </div>
                                        <span className="font-mono text-muted-foreground">
                                            Opening {formatCents(shift.opening_cash_cents)} · Expected{' '}
                                            {formatCents(shift.expected_cash_cents ?? 0)}
                                            {shift.counted_cash_cents !== null &&
                                                ` · Counted ${formatCents(shift.counted_cash_cents)}`}
                                            {shift.variance_cents !== null &&
                                                ` · Variance ${formatCents(shift.variance_cents)}`}
                                        </span>
                                    </div>

                                    {shift.state === 'variance_flagged' && (
                                        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-rose-200 bg-rose-50/70 p-3">
                                            <ShieldAlert className="h-4 w-4 text-rose-600 shrink-0" />
                                            <input
                                                type="text"
                                                placeholder="Resolution note"
                                                value={noteInput[shift.id] ?? ''}
                                                onChange={(e) =>
                                                    setNoteInput((prev) => ({ ...prev, [shift.id]: e.target.value }))
                                                }
                                                className="flex-1 rounded-lg border border-input bg-white px-2.5 py-1 text-xs"
                                            />
                                            <input
                                                type="password"
                                                inputMode="numeric"
                                                maxLength={4}
                                                placeholder="Manager PIN"
                                                value={pinInput[shift.id] ?? ''}
                                                onChange={(e) =>
                                                    setPinInput((prev) => ({ ...prev, [shift.id]: e.target.value }))
                                                }
                                                className="w-28 rounded-lg border border-input bg-white px-2.5 py-1 text-center font-mono text-xs"
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
