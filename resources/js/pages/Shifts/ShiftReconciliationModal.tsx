import { useEffect, useState } from 'react';
import { router, usePage } from '@inertiajs/react';
import { AlertTriangle, CheckCircle2, Lock, Unlock, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCents } from '@/lib/money';
import type { ShiftSummaryRow } from '@/types/billing';
import type { SharedPageProps } from '@/types/evaluator';

interface ShiftReconciliationModalProps {
    open: boolean;
    onClose: () => void;
}

export function ShiftReconciliationModal({ open, onClose }: ShiftReconciliationModalProps) {
    const { evaluator } = usePage<SharedPageProps>().props;
    const [shifts, setShifts] = useState<ShiftSummaryRow[]>([]);
    const [countedDollars, setCountedDollars] = useState('');
    const [closeNotes, setCloseNotes] = useState('');
    const [openingDollars, setOpeningDollars] = useState('250.00');
    const [approveShiftId, setApproveShiftId] = useState<number | null>(null);
    const [managerPin, setManagerPin] = useState('');
    const [resolutionNote, setResolutionNote] = useState('Verified cash drop envelope');
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const fetchShifts = () => {
        fetch('/shifts', { headers: { Accept: 'application/json' } })
            .then((r) => r.json())
            .then((d: { shifts: ShiftSummaryRow[] }) => setShifts(d.shifts || []))
            .catch(() => {});
    };

    useEffect(() => {
        if (open) {
            setErrorMsg(null);
            fetchShifts();
        }
    }, [open, evaluator.activeBranch.id, evaluator.activeShift?.id]);

    if (!open) {
        return null;
    }

    const handleCloseShift = () => {
        if (!evaluator.activeShift) {
            return;
        }
        setErrorMsg(null);
        const countedCents = Math.max(0, Math.round(Number(countedDollars || '0') * 100));

        router.post(
            `/shifts/${evaluator.activeShift.id}/close`,
            { counted_cash_cents: countedCents, notes: closeNotes },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setCountedDollars('');
                    setCloseNotes('');
                    fetchShifts();
                },
                onError: (errors) => setErrorMsg(errors.shift || 'Could not close shift.'),
            },
        );
    };

    const handleOpenShift = () => {
        setErrorMsg(null);
        const openingCents = Math.max(0, Math.round(Number(openingDollars || '0') * 100));

        router.post(
            '/shifts/open',
            { opening_cash_cents: openingCents },
            {
                preserveScroll: true,
                onSuccess: () => fetchShifts(),
                onError: (errors) => setErrorMsg(errors.shift || 'Could not open shift.'),
            },
        );
    };

    const handleApproveVariance = () => {
        if (!approveShiftId) {
            return;
        }
        setErrorMsg(null);

        router.post(
            `/shifts/${approveShiftId}/approve-variance`,
            { manager_pin: managerPin, resolution_note: resolutionNote },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setApproveShiftId(null);
                    setManagerPin('');
                    fetchShifts();
                },
                onError: (errors) => setErrorMsg(errors.manager_pin || errors.shift || 'PIN rejected.'),
            },
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
            <div className="w-full max-w-xl rounded-2xl border border-border bg-card p-5 shadow-2xl space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-bold">Cash Drawer &amp; Blind Shift Reconciliation</h3>
                        <p className="text-xs text-muted-foreground">
                            {evaluator.activeBranch.name} · Tolerance: ±{formatCents(evaluator.activeBranch.cash_variance_tolerance_cents)}
                        </p>
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

                {evaluator.activeShift ? (
                    <div className="rounded-xl border border-border bg-background/70 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="inline-flex items-center gap-1.5 text-sm font-semibold">
                                <Lock className="h-4 w-4 text-amber-600" />
                                Blind Close Active Shift #{evaluator.activeShift.id}
                            </span>
                            <Badge variant="warning">Expected Hidden (Blind Count)</Badge>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2 text-xs">
                            <label className="space-y-1">
                                <span className="font-medium text-muted-foreground">Counted Drawer Cash ($)</span>
                                <input
                                    type="number"
                                    step="0.01"
                                    placeholder="e.g. 250.00"
                                    value={countedDollars}
                                    onChange={(e) => setCountedDollars(e.target.value)}
                                    className="w-full rounded-lg border border-input bg-background px-3 py-1.5 font-mono text-sm"
                                />
                            </label>
                            <label className="space-y-1">
                                <span className="font-medium text-muted-foreground">Shift Notes</span>
                                <input
                                    type="text"
                                    placeholder="Optional drawer note"
                                    value={closeNotes}
                                    onChange={(e) => setCloseNotes(e.target.value)}
                                    className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm"
                                />
                            </label>
                        </div>

                        <Button type="button" onClick={handleCloseShift}>
                            Submit Blind Cash Count &amp; Close Shift
                        </Button>
                    </div>
                ) : (
                    <div className="rounded-xl border border-border bg-background/70 p-4 space-y-3">
                        <div className="flex items-center gap-2 text-sm font-semibold">
                            <Unlock className="h-4 w-4 text-emerald-600" />
                            Open Cash Drawer Shift
                        </div>
                        <div className="flex items-end gap-3">
                            <label className="flex-1 space-y-1 text-xs">
                                <span className="font-medium text-muted-foreground">Opening Float ($)</span>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={openingDollars}
                                    onChange={(e) => setOpeningDollars(e.target.value)}
                                    className="w-full rounded-lg border border-input bg-background px-3 py-1.5 font-mono text-sm"
                                />
                            </label>
                            <Button type="button" onClick={handleOpenShift}>
                                Open Shift
                            </Button>
                        </div>
                    </div>
                )}

                <div className="max-h-60 space-y-2 overflow-y-auto">
                    <div className="text-xs font-semibold text-muted-foreground uppercase">Recent Branch Shifts</div>
                    {shifts.map((s) => (
                        <div
                            key={s.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-background/50 p-3 text-xs"
                        >
                            <div>
                                <div className="font-semibold">
                                    Shift #{s.id} · {s.user_name || 'Staff'}
                                </div>
                                <div className="text-muted-foreground">
                                    Float: {formatCents(s.opening_cash_cents)}
                                    {s.variance_cents !== null && (
                                        <span className={`ml-2 font-mono font-bold ${s.variance_cents === 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                                            Variance: {formatCents(s.variance_cents)}
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <Badge
                                    variant={
                                        s.state === 'variance_flagged'
                                            ? 'destructive'
                                            : s.state === 'open'
                                              ? 'success'
                                              : 'secondary'
                                    }
                                >
                                    {s.state === 'variance_flagged' && <AlertTriangle className="h-3 w-3" />}
                                    {s.state === 'closed' && <CheckCircle2 className="h-3 w-3" />}
                                    {s.state}
                                </Badge>

                                {s.state === 'variance_flagged' && (
                                    <Button size="sm" variant="outline" onClick={() => setApproveShiftId(s.id)}>
                                        Approve PIN
                                    </Button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {approveShiftId && (
                    <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 space-y-2 text-xs">
                        <div className="font-semibold">Approve Variance for Shift #{approveShiftId}</div>
                        <div className="grid gap-2 sm:grid-cols-2">
                            <input
                                type="password"
                                maxLength={4}
                                placeholder="Manager PIN (1234)"
                                value={managerPin}
                                onChange={(e) => setManagerPin(e.target.value)}
                                className="rounded-lg border border-input bg-background px-2.5 py-1.5 font-mono"
                            />
                            <input
                                type="text"
                                value={resolutionNote}
                                onChange={(e) => setResolutionNote(e.target.value)}
                                className="rounded-lg border border-input bg-background px-2.5 py-1.5"
                            />
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button size="sm" variant="ghost" onClick={() => setApproveShiftId(null)}>
                                Cancel
                            </Button>
                            <Button size="sm" onClick={handleApproveVariance}>
                                Approve &amp; Close
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
