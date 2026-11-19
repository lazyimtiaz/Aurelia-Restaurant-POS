import type { PropsWithChildren } from 'react';
import { Link, router, usePage } from '@inertiajs/react';
import { ArrowLeft, ChefHat, Lock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { PosSharedProps } from '@/types/pos-app';

export function KitchenLayout({ children }: PropsWithChildren) {
    const { auth, flash } = usePage<PosSharedProps>().props;
    const staff = auth?.staff;
    const activeBranch = auth?.activeBranch;
    const canLeaveKitchen = staff ? staff.allowed_sections.some((s) => s !== 'kitchen') : false;

    return (
        <div className="dark min-h-screen bg-zinc-950 text-zinc-50">
            <header className="sticky top-0 z-30 border-b border-zinc-800 bg-zinc-950/95 px-4 py-3 backdrop-blur">
                <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400">
                            <ChefHat className="h-5 w-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="text-base font-bold tracking-tight">Kitchen Display System</span>
                                {activeBranch && (
                                    <Badge variant="outline" className="border-zinc-700 bg-zinc-900 text-zinc-300">
                                        {activeBranch.code} · {activeBranch.name}
                                    </Badge>
                                )}
                            </div>
                            <p className="text-xs text-zinc-400">
                                {staff ? `${staff.name} · ${staff.role_label}` : 'Kitchen Line'}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {canLeaveKitchen && staff && (
                            <Link
                                href={staff.home_route}
                                className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-800"
                            >
                                <ArrowLeft className="h-3.5 w-3.5" />
                                Exit KDS
                            </Link>
                        )}
                        <button
                            type="button"
                            onClick={() => router.post('/lock')}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-100 hover:border-amber-500/50 hover:text-amber-300 cursor-pointer"
                        >
                            <Lock className="h-3.5 w-3.5" />
                            Lock
                        </button>
                    </div>
                </div>
            </header>

            {flash?.error && (
                <div className="border-b border-rose-500/30 bg-rose-500/15 px-4 py-2 text-center text-sm text-rose-200">
                    {flash.error}
                </div>
            )}

            <main className="mx-auto max-w-7xl px-4 py-5">{children}</main>
        </div>
    );
}
