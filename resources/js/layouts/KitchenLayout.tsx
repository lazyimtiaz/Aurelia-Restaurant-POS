import type { PropsWithChildren } from 'react';
import { Link, router, usePage } from '@inertiajs/react';
import { ArrowLeft, Lock } from 'lucide-react';
import { AureliaMark, FloatingToaster } from '@/design-system';
import type { PosSharedProps } from '@/types/pos-app';

export function KitchenLayout({ children }: PropsWithChildren) {
    const { auth } = usePage<PosSharedProps>().props;
    const staff = auth?.staff;
    const activeBranch = auth?.activeBranch;
    const canLeaveKitchen = staff ? staff.allowed_sections.some((s) => s !== 'kitchen') : false;

    return (
        <div className="dark min-h-screen overflow-x-clip bg-[#0D0F14] text-slate-100">
            <FloatingToaster variant="dark" />

            <header className="sticky top-0 z-30 border-b border-[#282E3A] bg-[#0D0F14]/95 px-4 py-3 backdrop-blur-md sm:px-6 lg:px-8">
                <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                        <AureliaMark size="md" variant="dark" />
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-base font-bold tracking-tight text-white">
                                    Kitchen Display System
                                </span>
                                {activeBranch && (
                                    <span className="inline-flex items-center rounded-full border border-slate-700 bg-[#161922] px-2.5 py-0.5 font-mono text-[11px] font-semibold text-orange-300">
                                        {activeBranch.code} · {activeBranch.name}
                                    </span>
                                )}
                            </div>
                            <p className="truncate text-xs text-slate-400">
                                {staff ? `${staff.name} · ${staff.role_label}` : 'Kitchen Expediter Line'}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {canLeaveKitchen && staff && (
                            <Link
                                href={staff.home_route}
                                className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-slate-700 bg-[#161922] px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-[#1D212B]"
                            >
                                <ArrowLeft className="h-3.5 w-3.5" />
                                <span>Exit KDS</span>
                            </Link>
                        )}
                        <button
                            type="button"
                            onClick={() => router.post('/lock')}
                            className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-slate-700 bg-[#161922] px-3 py-1.5 text-xs font-semibold text-slate-100 transition hover:border-orange-500/50 hover:text-orange-300 active:scale-[0.98] cursor-pointer"
                        >
                            <Lock className="h-3.5 w-3.5" />
                            <span>Lock</span>
                        </button>
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">{children}</main>
        </div>
    );
}
