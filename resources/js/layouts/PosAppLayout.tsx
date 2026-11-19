import type { PropsWithChildren } from 'react';
import { Link, router, usePage } from '@inertiajs/react';
import {
    BarChart3,
    Boxes,
    Building2,
    ChefHat,
    ClipboardList,
    Grid2X2,
    LayoutDashboard,
    Lock,
    Settings,
    ShoppingBag,
    UtensilsCrossed,
    Wallet,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatCents } from '@/lib/money';
import type { NavSectionKey, PosSharedProps } from '@/types/pos-app';

interface PosAppLayoutProps extends PropsWithChildren {
    title?: string;
    subtitle?: string;
}

interface NavDefinition {
    key: NavSectionKey;
    label: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavDefinition[] = [
    { key: 'dashboard', label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { key: 'pos', label: 'POS Register', href: '/pos', icon: ShoppingBag },
    { key: 'orders', label: 'Orders', href: '/orders', icon: ClipboardList },
    { key: 'tables', label: 'Tables', href: '/tables', icon: Grid2X2 },
    { key: 'kitchen', label: 'Kitchen KDS', href: '/kitchen', icon: ChefHat },
    { key: 'menu', label: 'Menu', href: '/menu', icon: UtensilsCrossed },
    { key: 'inventory', label: 'Inventory', href: '/inventory', icon: Boxes },
    { key: 'reports', label: 'Reports', href: '/reports', icon: BarChart3 },
    { key: 'shifts', label: 'Shifts', href: '/shifts', icon: Wallet },
    { key: 'settings', label: 'Settings', href: '/settings', icon: Settings },
];

export function PosAppLayout({ title, subtitle, children }: PosAppLayoutProps) {
    const page = usePage<PosSharedProps>();
    const { auth, flash } = page.props;
    const currentPath = page.url.split('?')[0];

    const staff = auth?.staff;
    const activeBranch = auth?.activeBranch;
    const allowed = new Set<NavSectionKey>(staff?.allowed_sections ?? []);
    const visibleNav = NAV_ITEMS.filter((item) => allowed.has(item.key));

    const initials = (staff?.name ?? 'ST')
        .split(/\s+/)
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase() ?? '')
        .join('');

    const formattedDate = new Intl.DateTimeFormat('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    }).format(new Date());

    const handleLock = () => {
        router.post('/lock');
    };

    const handleBranchChange = (branchId: number) => {
        router.post('/branch/switch', { branch_id: branchId }, { preserveScroll: true });
    };

    return (
        <div className="flex min-h-screen bg-background text-foreground">
            <aside className="sticky top-0 hidden h-screen w-52 xl:w-60 shrink-0 flex-col justify-between border-r border-border bg-card px-3 py-5 md:flex">
                <div className="space-y-6">
                    <div className="flex items-center gap-3 px-2.5">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                            <UtensilsCrossed className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                            <div className="truncate text-base font-bold tracking-tight">Aurelia POS</div>
                            <div className="truncate text-xs text-muted-foreground">
                                {activeBranch?.name ?? 'Dining Group'}
                            </div>
                        </div>
                    </div>

                    <nav aria-label="Primary Sidebar" className="space-y-1">
                        {visibleNav.map((item) => {
                            const Icon = item.icon;
                            const isActive =
                                currentPath === item.href || currentPath.startsWith(`${item.href}/`);

                            return (
                                <Link
                                    key={item.key}
                                    href={item.href}
                                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                                        isActive
                                            ? 'bg-orange-50 text-orange-600 shadow-2xs border border-orange-200/70'
                                            : 'text-stone-600 hover:bg-muted hover:text-foreground'
                                    }`}
                                >
                                    <Icon
                                        className={`h-4 w-4 ${isActive ? 'text-orange-600' : 'text-stone-400'}`}
                                    />
                                    <span>{item.label}</span>
                                </Link>
                            );
                        })}
                    </nav>
                </div>

                <div className="space-y-3 border-t border-border pt-4">
                    {staff && (
                        <div className="flex items-center gap-2.5 rounded-xl bg-muted/60 px-2.5 py-2">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-100 text-xs font-bold text-orange-700">
                                {initials}
                            </div>
                            <div className="min-w-0">
                                <div className="truncate text-xs font-semibold text-foreground">
                                    {staff.name}
                                </div>
                                <div className="truncate text-[11px] text-muted-foreground">
                                    {staff.role_label}
                                </div>
                            </div>
                        </div>
                    )}

                    <button
                        type="button"
                        onClick={handleLock}
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium text-stone-700 transition hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700 cursor-pointer"
                    >
                        <Lock className="h-4 w-4" />
                        Lock Terminal
                    </button>
                </div>
            </aside>

            <div className="flex min-w-0 flex-1 flex-col">
                <header className="sticky top-0 z-30 border-b border-border bg-card/90 px-4 py-3 backdrop-blur-md lg:px-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                            {title ? (
                                <>
                                    <h1 className="truncate text-lg font-bold tracking-tight lg:text-xl">
                                        {title}
                                    </h1>
                                    <p className="truncate text-xs text-muted-foreground">
                                        {subtitle ?? formattedDate}
                                    </p>
                                </>
                            ) : (
                                <div className="text-xs font-medium text-muted-foreground">{formattedDate}</div>
                            )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2.5">
                            {staff?.can_switch_branch && (auth?.branches.length ?? 0) > 0 ? (
                                <label className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-medium">
                                    <Building2 className="h-3.5 w-3.5 text-primary" />
                                    <select
                                        aria-label="Active Branch"
                                        value={activeBranch?.id ?? ''}
                                        onChange={(e) => handleBranchChange(Number(e.target.value))}
                                        className="bg-transparent text-xs font-semibold text-foreground focus:outline-none cursor-pointer"
                                    >
                                        {auth?.branches.map((branch) => (
                                            <option key={branch.id} value={branch.id}>
                                                {branch.code} — {branch.name}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            ) : (
                                activeBranch && (
                                    <Badge variant="outline" className="rounded-xl px-3 py-1.5 text-xs font-semibold">
                                        <Building2 className="h-3.5 w-3.5 text-primary" />
                                        {activeBranch.code} · {activeBranch.name}
                                    </Badge>
                                )
                            )}

                            {staff && allowed.has('shifts') && (
                                <Link href="/shifts">
                                    {auth?.activeShift ? (
                                        <Badge
                                            variant="success"
                                            className="rounded-xl px-3 py-1.5 text-xs font-semibold hover:opacity-90"
                                        >
                                            <Wallet className="h-3.5 w-3.5" />
                                            Drawer Open · {formatCents(auth.activeShift.expected_cash_cents)}
                                        </Badge>
                                    ) : (
                                        <Badge variant="warning" className="rounded-xl px-3 py-1.5 text-xs font-semibold">
                                            Shift Closed · Open Drawer
                                        </Badge>
                                    )}
                                </Link>
                            )}

                            <button
                                type="button"
                                onClick={handleLock}
                                className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-2.5 py-1.5 text-xs font-semibold text-stone-700 md:hidden cursor-pointer"
                            >
                                <Lock className="h-3.5 w-3.5" />
                                Lock
                            </button>
                        </div>
                    </div>

                    <div className="mt-2.5 flex gap-1.5 overflow-x-auto pb-0.5 md:hidden">
                        {visibleNav.map((item) => {
                            const isActive =
                                currentPath === item.href || currentPath.startsWith(`${item.href}/`);
                            return (
                                <Link
                                    key={item.key}
                                    href={item.href}
                                    className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-medium ${
                                        isActive
                                            ? 'bg-orange-100 text-orange-700'
                                            : 'bg-muted text-stone-600'
                                    }`}
                                >
                                    {item.label}
                                </Link>
                            );
                        })}
                    </div>
                </header>

                {flash?.error && (
                    <div className="border-b border-rose-500/30 bg-rose-50 px-4 py-2.5 text-center text-sm font-medium text-rose-700">
                        {flash.error}
                    </div>
                )}

                {flash?.success && (
                    <div className="border-b border-emerald-500/30 bg-emerald-50 px-4 py-2.5 text-center text-sm font-medium text-emerald-700">
                        {flash.success}
                    </div>
                )}

                <main className="flex-1 p-4 lg:p-6">{children}</main>
            </div>
        </div>
    );
}
