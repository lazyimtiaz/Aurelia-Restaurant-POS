import { useState } from 'react';
import { Link, router, usePage } from '@inertiajs/react';
import { AnimatePresence, motion } from 'motion/react';
import {
    AlertTriangle,
    Building2,
    ChevronDown,
    ChevronUp,
    CreditCard,
    KeyRound,
    SplitSquareHorizontal,
    UserCheck,
    Wallet,
} from 'lucide-react';
import type { SharedPageProps, StaffRoleValue } from '@/types/evaluator';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { formatCents } from '@/lib/money';
import { ShiftReconciliationModal } from '@/pages/Shifts/ShiftReconciliationModal';

export function EvaluatorControlBar() {
    const { evaluator } = usePage<SharedPageProps>().props;
    const [collapsed, setCollapsed] = useState(false);
    const [shiftModalOpen, setShiftModalOpen] = useState(false);

    const handleRoleChange = (role: StaffRoleValue) => {
        router.post('/evaluator/switch-role', { role }, { preserveScroll: true });
    };

    const handleBranchChange = (branchId: number) => {
        router.post('/evaluator/switch-branch', { branch_id: branchId }, { preserveScroll: true });
    };

    const toggleSimulation = (
        key: 'simulate_card_decline' | 'trigger_low_stock_auto_86',
        checked: boolean,
    ) => {
        router.post('/evaluator/simulations', { [key]: checked }, { preserveScroll: true });
    };

    return (
        <header className="sticky top-0 z-50 border-b border-amber-500/20 bg-zinc-950 text-zinc-100 shadow-lg">
            <div className="mx-auto max-w-7xl px-4 py-2">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                            <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                            <span className="text-xs font-bold tracking-wider text-amber-400 uppercase">
                                Aurelia Evaluator Bar
                            </span>
                        </div>

                        <Badge variant="outline" className="border-zinc-700 bg-zinc-900 text-zinc-200">
                            <Building2 className="h-3 w-3 text-amber-400" />
                            {evaluator.activeBranch.name} ({evaluator.activeBranch.code})
                        </Badge>

                        <Badge variant="outline" className="border-zinc-700 bg-zinc-900 text-zinc-200">
                            <UserCheck className="h-3 w-3 text-sky-400" />
                            {evaluator.activeUser.role_label}
                        </Badge>

                        {evaluator.activeUser.can_authorize_pin && (
                            <Badge variant="warning" className="border-amber-500/40 bg-amber-500/15 text-amber-300">
                                <KeyRound className="h-3 w-3" />
                                PIN: 1234
                            </Badge>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setShiftModalOpen(true)}
                            className="cursor-pointer"
                            title="Open Blind Shift & Cash Drawer Reconciliation"
                        >
                            {evaluator.activeShift ? (
                                <Badge variant="success" className="border-emerald-500/30 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25">
                                    <Wallet className="h-3 w-3" />
                                    Shift Open · {formatCents(evaluator.activeShift.expected_cash_cents)}
                                </Badge>
                            ) : (
                                <Badge variant="destructive">No Open Shift · Open Drawer</Badge>
                            )}
                        </button>

                        <Link
                            href="/demo/split-screen"
                            className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/50 bg-amber-500/20 px-2.5 py-1 text-xs font-semibold text-amber-300 hover:bg-amber-500/30 transition"
                        >
                            <SplitSquareHorizontal className="h-3.5 w-3.5 text-amber-400" />
                            Split-Screen POS ↔ KDS
                        </Link>

                        <button
                            type="button"
                            onClick={() => setCollapsed((prev) => !prev)}
                            className="inline-flex items-center gap-1 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800 cursor-pointer"
                            aria-expanded={!collapsed}
                        >
                            {collapsed ? (
                                <>
                                    Controls <ChevronDown className="h-3.5 w-3.5" />
                                </>
                            ) : (
                                <>
                                    Hide <ChevronUp className="h-3.5 w-3.5" />
                                </>
                            )}
                        </button>
                    </div>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-zinc-800/80 pt-2 text-xs">
                    {[
                        { href: '/', label: 'Control Center' },
                        { href: '/floor', label: 'Floor Map' },
                        { href: '/pos', label: 'Cashier POS' },
                        { href: '/kds', label: 'Kitchen KDS' },
                        { href: '/demo/split-screen', label: 'Split-Screen Demo' },
                    ].map((nav) => (
                        <Link
                            key={nav.href}
                            href={nav.href}
                            className="rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1 font-medium text-zinc-300 hover:border-amber-500/40 hover:text-amber-300 transition"
                        >
                            {nav.label}
                        </Link>
                    ))}
                </div>

                <AnimatePresence initial={false}>
                    {!collapsed && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.18 }}
                            className="overflow-hidden"
                        >
                            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-4 border-t border-zinc-800 pt-2.5 text-xs">
                                <div className="flex flex-wrap items-center gap-4">
                                    <label className="flex items-center gap-2">
                                        <span className="font-medium text-zinc-400">Branch:</span>
                                        <select
                                            aria-label="Switch Active Branch"
                                            value={evaluator.activeBranch.id}
                                            onChange={(e) => handleBranchChange(Number(e.target.value))}
                                            className="rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-xs font-medium text-zinc-100 focus:border-amber-500 focus:outline-none"
                                        >
                                            {evaluator.branches.map((branch) => (
                                                <option key={branch.id} value={branch.id}>
                                                    {branch.code} — {branch.name}
                                                </option>
                                            ))}
                                        </select>
                                    </label>

                                    <label className="flex items-center gap-2">
                                        <span className="font-medium text-zinc-400">Role Persona:</span>
                                        <select
                                            aria-label="Switch Active Role"
                                            value={evaluator.activeUser.role}
                                            onChange={(e) => handleRoleChange(e.target.value as StaffRoleValue)}
                                            className="rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-xs font-medium text-zinc-100 focus:border-amber-500 focus:outline-none"
                                        >
                                            {evaluator.roles.map((role) => (
                                                <option key={role.value} value={role.value}>
                                                    {role.label}
                                                    {role.can_authorize_pin ? ' [PIN Auth]' : ''}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                </div>

                                <div className="flex flex-wrap items-center gap-5">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <CreditCard className="h-3.5 w-3.5 text-rose-400" />
                                        <span className="text-zinc-300">Simulate Card Decline</span>
                                        <Switch
                                            checked={evaluator.simulations.simulateCardDecline}
                                            onCheckedChange={(checked) =>
                                                toggleSimulation('simulate_card_decline', checked)
                                            }
                                        />
                                    </label>

                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                                        <span className="text-zinc-300">Trigger Low-Stock Auto-86</span>
                                        <Switch
                                            checked={evaluator.simulations.triggerLowStockAuto86}
                                            onCheckedChange={(checked) =>
                                                toggleSimulation('trigger_low_stock_auto_86', checked)
                                            }
                                        />
                                    </label>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <ShiftReconciliationModal
                open={shiftModalOpen}
                onClose={() => setShiftModalOpen(false)}
            />
        </header>
    );
}
