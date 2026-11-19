import { useEffect, useState } from 'react';
import { Head, router, usePage } from '@inertiajs/react';
import { motion } from 'motion/react';
import { Building2, Check, LogOut, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AureliaMark, FloatingToaster, MotionModal, PinKeypad } from '@/design-system';
import { cn } from '@/lib/utils';
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
    const [errorTick, setErrorTick] = useState(0);
    const [submitting, setSubmitting] = useState(false);
    const [now, setNow] = useState(() => new Date());

    const [signOutModalOpen, setSignOutModalOpen] = useState(false);
    const [signOutPin, setSignOutPin] = useState('');
    const [signOutSubmitting, setSignOutSubmitting] = useState(false);

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
                onError: () => {
                    setPin('');
                    setErrorTick((prev) => prev + 1);
                },
                onFinish: () => setSubmitting(false),
            },
        );
    };

    const handleSignOutTerminal = (fullPin: string) => {
        setSignOutSubmitting(true);
        router.post(
            '/terminal/sign-out',
            { manager_pin: fullPin },
            {
                onSuccess: () => setSignOutModalOpen(false),
                onError: () => setSignOutPin(''),
                onFinish: () => setSignOutSubmitting(false),
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
        <div className="flex min-h-screen flex-col justify-between bg-background px-4 py-5 sm:px-6 lg:px-10 lg:py-8">
            <Head title={`Unlock Terminal · ${terminalBranch.code}`} />
            <FloatingToaster variant="light" />

            <header className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                    <AureliaMark size="md" />
                    <div className="min-w-0">
                        <div className="truncate text-base font-bold tracking-tight text-foreground">
                            Aurelia POS Terminal
                        </div>
                        <div className="flex items-center gap-1.5 ds-caption truncate">
                            <Building2 className="h-3.5 w-3.5 shrink-0 text-primary" />
                            <span className="truncate">
                                {terminalBranch.code} · {terminalBranch.name}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3 sm:gap-4">
                    <div className="text-right">
                        <div className="ds-num-md leading-none">{timeFormatted}</div>
                        <div className="mt-1 ds-caption hidden sm:block">{dateFormatted}</div>
                    </div>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            setSignOutPin('');
                            setSignOutModalOpen(true);
                        }}
                    >
                        <LogOut className="h-3.5 w-3.5" />
                        <span>Sign Out</span>
                    </Button>
                </div>
            </header>

            <main className="mx-auto my-6 sm:my-8 grid w-full max-w-6xl gap-6 lg:grid-cols-12 items-start">
                <section className="space-y-4 lg:col-span-7">
                    <div>
                        <h1 className="ds-page-title">Select Staff Profile</h1>
                        <p className="ds-body mt-1 text-muted-foreground">
                            Tap your profile on this {terminalBranch.name} terminal and enter your 4-digit PIN.
                        </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                        {staffMembers.map((member) => {
                            const active = selectedStaff?.id === member.id;
                            return (
                                <motion.button
                                    key={member.id}
                                    type="button"
                                    whileTap={{ scale: 0.985 }}
                                    onClick={() => {
                                        setSelectedStaff(member);
                                        setPin('');
                                    }}
                                    className={cn(
                                        'flex items-center gap-3.5 rounded-2xl border p-3.5 text-left transition-all cursor-pointer',
                                        active
                                            ? 'border-primary bg-card ring-2 ring-primary/20 shadow-bistro-card'
                                            : 'border-border bg-card/85 hover:border-[#dcd4c7] hover:bg-card',
                                    )}
                                >
                                    <div
                                        className={cn(
                                            'flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-colors',
                                            active
                                                ? 'bg-primary text-primary-foreground'
                                                : 'bg-[var(--surface-inset)] text-stone-700 ring-1 ring-border',
                                        )}
                                    >
                                        {member.initials}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="truncate text-sm font-semibold text-foreground">
                                                {member.name}
                                            </span>
                                            {active && (
                                                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                                                    <Check className="h-3 w-3" />
                                                </span>
                                            )}
                                        </div>
                                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
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
                                </motion.button>
                            );
                        })}
                    </div>
                </section>

                <section className="lg:col-span-5">
                    <Card className="shadow-bistro-elevated">
                        <CardContent className="p-5 sm:p-6">
                            {selectedStaff ? (
                                <div className="space-y-4">
                                    <div className="text-center">
                                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent text-lg font-bold text-primary ring-1 ring-primary/20">
                                            {selectedStaff.initials}
                                        </div>
                                        <h2 className="ds-section-title mt-3">{selectedStaff.name}</h2>
                                        <p className="ds-caption">{selectedStaff.role_label}</p>
                                    </div>

                                    <PinKeypad
                                        value={pin}
                                        onChange={setPin}
                                        errorMessage={errors.pin}
                                        errorKey={errorTick}
                                        disabled={submitting}
                                        enableKeyboard={!signOutModalOpen}
                                        onSubmit={(fullPin) => submitUnlock(selectedStaff, fullPin)}
                                    />
                                </div>
                            ) : (
                                <p className="py-12 text-center text-sm text-muted-foreground">
                                    No staff members found for this branch.
                                </p>
                            )}
                        </CardContent>
                    </Card>
                </section>
            </main>

            <footer className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 ds-caption">
                <span>Session locks automatically after inactivity.</span>
                <span>Aurelia POS · Secure Staff Session</span>
            </footer>

            <MotionModal
                open={signOutModalOpen}
                onClose={() => setSignOutModalOpen(false)}
                title="Sign Out Terminal"
                description={`Enter a Manager, Owner, or Admin PIN to unlink this device from ${terminalBranch.name}.`}
                icon={<ShieldCheck className="h-5 w-5 text-primary" />}
                maxWidth="sm"
            >
                <div className="p-5 sm:p-6 space-y-4">
                    <PinKeypad
                        value={signOutPin}
                        onChange={setSignOutPin}
                        errorMessage={errors.manager_pin}
                        disabled={signOutSubmitting}
                        enableKeyboard={signOutModalOpen}
                        showSubmitButton
                        submitLabel={signOutSubmitting ? 'Signing Out...' : 'Sign Out Device'}
                        submitTone="rose"
                        onSubmit={handleSignOutTerminal}
                    />
                </div>
            </MotionModal>
        </div>
    );
}
