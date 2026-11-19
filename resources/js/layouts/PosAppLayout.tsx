import { type PropsWithChildren, useState } from 'react';
import { Link, router, usePage } from '@inertiajs/react';
import { motion } from 'motion/react';
import {
    BarChart3,
    Boxes,
    Building2,
    ChefHat,
    ClipboardList,
    Grid2X2,
    LayoutDashboard,
    Lock,
    Menu,
    Settings,
    ShoppingBag,
    UtensilsCrossed,
    Wallet,
} from 'lucide-react';
import { AureliaMark, FloatingToaster, MotionDrawer, StatusPill } from '@/design-system';
import { formatCents } from '@/lib/money';
import { cn } from '@/lib/utils';
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
    const { auth } = page.props;
    const currentPath = page.url.split('?')[0];
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const staff = auth?.staff;
    const activeBranch = auth?.activeBranch;
    const allowed = new Set<NavSectionKey>(staff?.allowed_sections ?? []);
    const visibleNav = NAV_ITEMS.filter((item) => allowed.has(item.key));

    const nameParts = (staff?.name ?? 'ST').match(/[A-Za-z0-9]+/g) ?? ['ST'];
    const initials = (
        nameParts.length >= 2
            ? `${nameParts[0][0] ?? 'S'}${nameParts[1][0] ?? 'T'}`
            : nameParts[0].slice(0, 2)
    ).toUpperCase();

    const formattedDate = new Intl.DateTimeFormat('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    }).format(new Date());

    const handleLock = () => {
        setMobileMenuOpen(false);
        router.post('/lock');
    };

    const handleBranchChange = (branchId: number) => {
        router.post('/branch/switch', { branch_id: branchId }, { preserveScroll: true });
    };

    const renderNavLinks = (compact: boolean, onSelect?: () => void) => (
        <nav aria-label="Primary Sidebar" className="space-y-1">
            {visibleNav.map((item) => {
                const Icon = item.icon;
                const isActive =
                    currentPath === item.href || currentPath.startsWith(`${item.href}/`);

                return (
                    <Link
                        key={item.key}
                        href={item.href}
                        onClick={onSelect}
                        title={compact ? item.label : undefined}
                        className={cn(
                            'group relative flex items-center rounded-xl transition-colors select-none',
                            compact ? 'justify-center px-2 py-3' : 'gap-3 px-3.5 py-2.5 text-sm font-medium',
                            isActive
                                ? 'text-primary font-semibold'
                                : 'text-stone-600 hover:bg-[var(--surface-inset)] hover:text-foreground',
                        )}
                    >
                        {isActive && (
                            <motion.span
                                layoutId={compact ? 'sidebar-pill-tablet' : 'sidebar-pill-full'}
                                transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                                className="absolute inset-0 rounded-xl border border-primary/20 bg-accent"
                            />
                        )}
                        <Icon
                            className={cn(
                                'relative z-10 h-4.5 w-4.5 shrink-0 transition-transform duration-150 group-hover:scale-105',
                                isActive ? 'text-primary' : 'text-stone-400 group-hover:text-stone-700',
                            )}
                        />
                        {!compact && <span className="relative z-10 truncate">{item.label}</span>}
                    </Link>
                );
            })}
        </nav>
    );

    return (
        <div className="flex min-h-screen w-full overflow-x-clip bg-background text-foreground">
            <FloatingToaster variant="light" />

            {/* Tablet Compact Rail (md..lg-1) */}
            <aside className="sticky top-0 hidden h-screen w-20 shrink-0 flex-col justify-between border-r border-border bg-card px-2.5 py-5 md:flex lg:hidden">
                <div className="flex flex-col items-center space-y-6">
                    <Link href={staff?.home_route ?? '/pos'} title="Aurelia POS">
                        <AureliaMark size="md" />
                    </Link>
                    {renderNavLinks(true)}
                </div>

                <div className="flex flex-col items-center gap-3 border-t border-border pt-4">
                    {staff && (
                        <div
                            title={`${staff.name} · ${staff.role_label}`}
                            className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-xs font-bold text-primary ring-1 ring-primary/20"
                        >
                            {initials}
                        </div>
                    )}
                    <button
                        type="button"
                        onClick={handleLock}
                        title="Lock Terminal"
                        aria-label="Lock Terminal"
                        className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card text-stone-700 transition hover:border-primary/40 hover:bg-accent hover:text-primary cursor-pointer"
                    >
                        <Lock className="h-4 w-4" />
                    </button>
                </div>
            </aside>

            {/* Desktop Full Sidebar (lg+) */}
            <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col justify-between border-r border-border bg-card px-3.5 py-5 lg:flex">
                <div className="space-y-6">
                    <Link
                        href={staff?.home_route ?? '/pos'}
                        className="flex items-center gap-3 px-2 rounded-xl focus:outline-none"
                    >
                        <AureliaMark size="md" />
                        <div className="min-w-0">
                            <div className="truncate text-[15px] font-bold tracking-tight text-foreground">
                                Aurelia POS
                            </div>
                            <div className="truncate text-xs text-muted-foreground">
                                {activeBranch?.name ?? 'Dining Group'}
                            </div>
                        </div>
                    </Link>

                    {renderNavLinks(false)}
                </div>

                <div className="space-y-3 border-t border-border pt-4">
                    {staff && (
                        <div className="flex items-center gap-2.5 rounded-xl border border-border/70 bg-[var(--surface-inset)] px-2.5 py-2">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-primary ring-1 ring-primary/20">
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
                        className="flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-stone-700 transition hover:border-primary/40 hover:bg-accent hover:text-primary active:scale-[0.98] cursor-pointer"
                    >
                        <Lock className="h-3.5 w-3.5" />
                        <span>Lock Terminal</span>
                    </button>
                </div>
            </aside>

            {/* Mobile Drawer Navigation (<md) */}
            <MotionDrawer
                open={mobileMenuOpen}
                onClose={() => setMobileMenuOpen(false)}
                side="left"
                title={
                    <span className="flex items-center gap-2.5">
                        <AureliaMark size="sm" />
                        <span>Aurelia POS</span>
                    </span>
                }
                description={activeBranch ? `${activeBranch.code} · ${activeBranch.name}` : undefined}
            >
                <div className="flex h-full flex-col justify-between p-4 space-y-6">
                    <div className="space-y-4">
                        {renderNavLinks(false, () => setMobileMenuOpen(false))}

                        {staff?.can_switch_branch && (auth?.branches.length ?? 0) > 0 && (
                            <div className="rounded-xl border border-border bg-[var(--surface-inset)] p-3 space-y-1.5">
                                <span className="ds-overline block">Active Branch</span>
                                <select
                                    aria-label="Mobile Active Branch"
                                    value={activeBranch?.id ?? ''}
                                    onChange={(e) => {
                                        handleBranchChange(Number(e.target.value));
                                        setMobileMenuOpen(false);
                                    }}
                                    className="w-full rounded-lg border border-border bg-card px-2.5 py-2 text-xs font-semibold text-foreground focus:border-primary focus:outline-none"
                                >
                                    {auth?.branches.map((branch) => (
                                        <option key={branch.id} value={branch.id}>
                                            {branch.code} — {branch.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>

                    <div className="space-y-3 border-t border-border pt-4">
                        {staff && (
                            <div className="flex items-center gap-2.5 rounded-xl bg-[var(--surface-inset)] p-2.5">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-primary">
                                    {initials}
                                </div>
                                <div className="min-w-0">
                                    <div className="truncate text-xs font-semibold">{staff.name}</div>
                                    <div className="truncate text-[11px] text-muted-foreground">
                                        {staff.role_label}
                                    </div>
                                </div>
                            </div>
                        )}
                        <button
                            type="button"
                            onClick={handleLock}
                            className="flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:border-primary/40 hover:bg-accent hover:text-primary cursor-pointer"
                        >
                            <Lock className="h-3.5 w-3.5" />
                            <span>Lock Terminal</span>
                        </button>
                    </div>
                </div>
            </MotionDrawer>

            {/* Main Viewport Column */}
            <div className="flex min-w-0 flex-1 flex-col">
                <header className="sticky top-0 z-30 border-b border-border bg-card/90 px-4 py-3 backdrop-blur-md md:px-6 lg:px-8">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                            <button
                                type="button"
                                onClick={() => setMobileMenuOpen(true)}
                                aria-label="Open navigation menu"
                                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-foreground transition hover:bg-secondary md:hidden cursor-pointer"
                            >
                                <Menu className="h-5 w-5" />
                            </button>

                            <div className="min-w-0">
                                {title ? (
                                    <>
                                        <h1 className="truncate text-lg sm:text-xl font-bold tracking-[-0.02em] text-foreground">
                                            {title}
                                        </h1>
                                        <p className="truncate ds-caption">
                                            {subtitle ?? formattedDate}
                                        </p>
                                    </>
                                ) : (
                                    <div className="ds-caption font-medium">{formattedDate}</div>
                                )}
                            </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
                            {staff?.can_switch_branch && (auth?.branches.length ?? 0) > 0 ? (
                                <label className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-border bg-[var(--surface-inset)] px-3 py-1.5 text-xs font-medium">
                                    <Building2 className="h-3.5 w-3.5 shrink-0 text-primary" />
                                    <select
                                        aria-label="Active Branch"
                                        value={activeBranch?.id ?? ''}
                                        onChange={(e) => handleBranchChange(Number(e.target.value))}
                                        className="max-w-[240px] pr-1 bg-transparent text-xs font-semibold text-foreground focus:outline-none cursor-pointer"
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
                                    <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-border bg-[var(--surface-inset)] px-3 py-1 text-xs font-semibold text-foreground">
                                        <Building2 className="h-3.5 w-3.5 text-primary" />
                                        <span>{activeBranch.code}</span>
                                    </span>
                                )
                            )}

                            {staff && allowed.has('shifts') && (
                                <Link href="/shifts" className="hidden sm:inline-flex">
                                    {auth?.activeShift ? (
                                        <StatusPill
                                            tone="success"
                                            size="md"
                                            pulse
                                            icon={<Wallet className="h-3.5 w-3.5" />}
                                            label={`Drawer ${formatCents(auth.activeShift.expected_cash_cents)}`}
                                            className="font-mono"
                                        />
                                    ) : (
                                        <StatusPill
                                            tone="warning"
                                            size="md"
                                            label="Shift Closed"
                                        />
                                    )}
                                </Link>
                            )}

                            <button
                                type="button"
                                onClick={handleLock}
                                className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-border bg-card px-2.5 py-1.5 text-xs font-semibold text-foreground md:hidden cursor-pointer"
                            >
                                <Lock className="h-3.5 w-3.5 text-primary" />
                                <span>Lock</span>
                            </button>
                        </div>
                    </div>
                </header>

                <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
            </div>
        </div>
    );
}
