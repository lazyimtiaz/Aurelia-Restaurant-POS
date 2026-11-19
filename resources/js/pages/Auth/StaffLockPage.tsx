import { useEffect, useState } from 'react';
import { Head, router, usePage } from '@inertiajs/react';
import { motion } from 'motion/react';
import { Building2, Delete, LogOut, ShieldCheck, UtensilsCrossed, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { BranchOptionData, PosSharedProps, StaffRoleValue } from '@/types/pos-app';

interface LockStaffMember {
    id: number;
    name: string;
    role: StaffRoleValue;
    role_label: string;
    initials: string;
    assigned_station: string | null;
}

interface StaffLockPageProps {
    terminalBranch: BranchOptionData;
    staffMembers: LockStaffMember[];
}

export default function StaffLockPage({ terminalBranch, staffMembers }: StaffLockPageProps) {
    const page = usePage<PosSharedProps & { errors?: Record<string, string> }>();
    const errors = page.props.errors ?? {};

    const [selectedStaff, setSelectedStaff] = useState<LockStaffMember | null>(staffMembers[0] ?? null);
    const [pin, setPin] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [now, setNow] = useState(() => new Date());
    const [signOutModalOpen, setSignOutModalOpen] = useState(false);
    const [signOutPin, setSignOutPin] = useState('');

    useEffect(() => {
        const timer = window.setInterval(() => setNow(new Date()), 15000);
        return () => window.clearInterval(timer);
    }, []);

    const submitUnlock = (targetStaff: LockStaffMember, fullPin: string) => {
        setSubmitting(true);
        router.post(
            '/lock/unlock',
            {
                user_id: targetStaff.id,
                pin: fullPin,
            },
            {
                preserveScroll: true,
                onError: () => setPin(''),
                onFinish: () => setSubmitting(false),
            },
        );
    };

    const handleDigit = (digit: string) => {
        if (!selectedStaff || submitting || pin.length >= 4) {
            return;
        }
        const nextPin = pin + digit;
        setPin(nextPin);
        if (nextPin.length === 4) {
            submitUnlock(selectedStaff, nextPin);
        }
    };

    const handleBackspace = () => {
        setPin((prev) => prev.slice(0, -1));
    };

    useEffect(() => {
        if (signOutModalOpen) {
            return;
        }
        const onKeyDown = (e: KeyboardEvent) => {
            if (/^\d$/.test(e.key)) {
                handleDigit(e.key);
            } else if (e.key === 'Backspace') {
                handleBackspace();
            } else if (e.key === 'Escape') {
                setPin('');
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [selectedStaff?.id, pin, submitting, signOutModalOpen]);

    const handleSignOutTerminal = (e: React.FormEvent) => {
        e.preventDefault();
        router.post(
            '/terminal/sign-out',
            { manager_pin: signOutPin },
            {
                onSuccess: () => setSignOutModalOpen(false),
                onError: () => setSignOutPin(''),
            },
        );
    };

    const timeFormatted = new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        minute: '2-digit',
    }).format(now);
    const dateFormatted = new Intl.DateTimeFormat('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
    }).format(now);

    return (
        <div className="flex min-h-screen flex-col justify-between bg-background px-4 py-6 lg:px-10">
            <Head title={`Unlock Terminal · ${terminalBranch.code}`} />

            <header className="mx-auto flex w-full max-w-6xl items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                        <UtensilsCrossed className="h-5 w-5" />
                    </div>
                    <div>
                        <div className="text-base font-bold tracking-tight">Aurelia POS Terminal</div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Building2 className="h-3.5 w-3.5 text-primary" />
                            <span>
                                {terminalBranch.code} · {terminalBranch.name}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="text-right">
                        <div className="font-mono text-lg font-bold leading-none">{timeFormatted}</div>
                        <div className="mt-1 text-xs text-muted-foreground">{dateFormatted}</div>
                    </div>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-xl"
                        onClick={() => setSignOutModalOpen(true)}
                    >
                        <LogOut className="h-3.5 w-3.5" />
                        Sign Out Terminal
                    </Button>
                </div>
            </header>

            <main className="mx-auto my-8 grid w-full max-w-6xl gap-6 lg:grid-cols-12">
                <section className="space-y-4 lg:col-span-7">
                    <div>
                        <h1 className="text-xl font-bold tracking-tight">Select Staff Profile</h1>
                        <p className="text-sm text-muted-foreground">
                            Tap your name on this {terminalBranch.name} terminal and enter your 4-digit PIN.
                        </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                        {staffMembers.map((member) => {
                            const active = selectedStaff?.id === member.id;
                            return (
                                <button
                                    key={member.id}
                                    type="button"
                                    onClick={() => {
                                        setSelectedStaff(member);
                                        setPin('');
                                    }}
                                    className={`flex items-center gap-3 rounded-2xl border p-3.5 text-left transition-all cursor-pointer ${
                                        active
                                            ? 'border-primary bg-orange-50/70 ring-2 ring-primary/25 shadow-sm'
                                            : 'border-border bg-card hover:border-orange-300'
                                    }`}
                                >
                                    <div
                                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                                            active
                                                ? 'bg-primary text-primary-foreground'
                                                : 'bg-muted text-stone-700'
                                        }`}
                                    >
                                        {member.initials}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="truncate text-sm font-semibold text-foreground">
                                            {member.name}
                                        </div>
                                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                                            <Badge variant="outline" className="text-[11px]">
                                                {member.role_label}
                                            </Badge>
                                            {member.assigned_station && (
                                                <Badge variant="secondary" className="text-[10px] capitalize">
                                                    {member.assigned_station}
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </section>

                <section className="lg:col-span-5">
                    <Card className="rounded-2xl border border-border p-6 shadow-md">
                        {selectedStaff ? (
                            <div className="space-y-5">
                                <div className="text-center">
                                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-orange-100 text-lg font-bold text-orange-700">
                                        {selectedStaff.initials}
                                    </div>
                                    <h2 className="mt-3 text-lg font-bold">{selectedStaff.name}</h2>
                                    <p className="text-xs text-muted-foreground">{selectedStaff.role_label}</p>
                                </div>

                                <div className="flex justify-center gap-3 py-1" aria-label="PIN progress">
                                    {[0, 1, 2, 3].map((slot) => {
                                        const filled = slot < pin.length;
                                        return (
                                            <motion.span
                                                key={slot}
                                                animate={{ scale: filled ? 1.1 : 1 }}
                                                className={`h-4 w-4 rounded-full border-2 transition-colors ${
                                                    filled
                                                        ? 'border-primary bg-primary'
                                                        : 'border-stone-300 bg-muted/40'
                                                }`}
                                            />
                                        );
                                    })}
                                </div>

                                {errors.pin && (
                                    <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-center text-xs font-medium text-rose-700">
                                        {errors.pin}
                                    </div>
                                )}

                                <div className="grid grid-cols-3 gap-2.5">
                                    {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                                        <button
                                            key={digit}
                                            type="button"
                                            disabled={submitting}
                                            onClick={() => handleDigit(digit)}
                                            className="flex h-14 items-center justify-center rounded-xl border border-border bg-background text-lg font-bold text-foreground transition hover:border-orange-300 hover:bg-orange-50 active:scale-95 cursor-pointer disabled:opacity-50"
                                        >
                                            {digit}
                                        </button>
                                    ))}
                                    <button
                                        type="button"
                                        disabled={submitting}
                                        onClick={() => setPin('')}
                                        className="flex h-14 items-center justify-center rounded-xl border border-border bg-muted/60 text-xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer"
                                    >
                                        Clear
                                    </button>
                                    <button
                                        type="button"
                                        disabled={submitting}
                                        onClick={() => handleDigit('0')}
                                        className="flex h-14 items-center justify-center rounded-xl border border-border bg-background text-lg font-bold text-foreground transition hover:border-orange-300 hover:bg-orange-50 active:scale-95 cursor-pointer disabled:opacity-50"
                                    >
                                        0
                                    </button>
                                    <button
                                        type="button"
                                        disabled={submitting}
                                        onClick={handleBackspace}
                                        aria-label="Backspace"
                                        className="flex h-14 items-center justify-center rounded-xl border border-border bg-muted/60 text-stone-700 hover:text-foreground cursor-pointer"
                                    >
                                        <Delete className="h-5 w-5" />
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <p className="py-12 text-center text-sm text-muted-foreground">
                                No staff members found for this branch.
                            </p>
                        )}
                    </Card>
                </section>
            </main>

            <footer className="mx-auto flex w-full max-w-6xl items-center justify-between text-xs text-muted-foreground">
                <span>Session locks automatically after inactivity.</span>
                <span>Aurelia POS · Secure Staff Session</span>
            </footer>

            {signOutModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
                    <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-2xl space-y-4">
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                                <ShieldCheck className="h-5 w-5 text-primary" />
                                <h3 className="text-base font-bold">Sign Out Terminal</h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSignOutModalOpen(false)}
                                className="rounded p-1 hover:bg-muted cursor-pointer"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Enter a Manager, Owner, or Admin PIN to unlink this device from {terminalBranch.name}.
                        </p>
                        <form onSubmit={handleSignOutTerminal} className="space-y-3">
                            {errors.manager_pin && (
                                <div className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
                                    {errors.manager_pin}
                                </div>
                            )}
                            <input
                                type="password"
                                inputMode="numeric"
                                maxLength={4}
                                required
                                autoFocus
                                value={signOutPin}
                                onChange={(e) => setSignOutPin(e.target.value)}
                                placeholder="4-digit Manager PIN"
                                className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-center font-mono text-lg tracking-widest focus:border-primary focus:outline-none"
                            />
                            <div className="flex justify-end gap-2">
                                <Button type="button" variant="outline" onClick={() => setSignOutModalOpen(false)}>
                                    Cancel
                                </Button>
                                <Button type="submit" variant="destructive">
                                    Sign Out Device
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
