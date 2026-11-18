import { useMemo, useState } from 'react';
import { Head, router, usePage } from '@inertiajs/react';
import { motion } from 'motion/react';
import {
    Ban,
    CheckCircle2,
    ChefHat,
    KeyRound,
    Layers,
    Percent,
    ShieldCheck,
    UtensilsCrossed,
    Wallet,
} from 'lucide-react';
import { AppShellLayout } from '@/layouts/AppShellLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatBps, formatCents } from '@/lib/money';
import type { MenuCategoryData, SharedPageProps, StaffRoleValue } from '@/types/evaluator';

interface WelcomeDashboardProps {
    catalog: MenuCategoryData[];
}

export default function WelcomeDashboard({ catalog }: WelcomeDashboardProps) {
    const { evaluator } = usePage<SharedPageProps>().props;
    const [stationFilter, setStationFilter] = useState<string>('all');

    const stations = useMemo(
        () => [
            { value: 'all', label: 'All Stations' },
            { value: 'grill', label: 'Grill & Hot Line' },
            { value: 'cold_salad', label: 'Cold & Garde Manger' },
            { value: 'pastry', label: 'Pastry & Desserts' },
            { value: 'bar', label: 'Bar & Beverages' },
        ],
        [],
    );

    const handleRoleSwitch = (role: StaffRoleValue) => {
        router.post('/evaluator/switch-role', { role }, { preserveScroll: true });
    };

    const handleToggle86 = (variantId: number, currentlyAvailable: boolean) => {
        router.post(
            `/evaluator/catalog/${variantId}/toggle-86`,
            {
                is_available: !currentlyAvailable,
                reason: currentlyAvailable ? '86d from Branch Control Center' : null,
            },
            { preserveScroll: true },
        );
    };

    const activeBranch = evaluator.activeBranch;

    return (
        <AppShellLayout>
            <Head title="Enterprise Control Center" />

            <div className="space-y-6">
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-amber-700 uppercase">
                            <Layers className="h-3.5 w-3.5" />
                            Phase 1 Foundation · Single-Brand Multi-Branch Enterprise
                        </div>
                        <h1 className="mt-1 text-2xl font-bold tracking-tight">
                            Aurelia Dining Group — {activeBranch.name}
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            Acting as <span className="font-semibold text-foreground">{evaluator.activeUser.name}</span>{' '}
                            ({evaluator.activeUser.role_label}) · All currency persisted in integer cents.
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <Badge variant="outline">Timezone: {activeBranch.timezone}</Badge>
                        <Badge variant="success">SQLite / MySQL Parity Ready</Badge>
                    </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Percent className="h-4 w-4 text-primary" />
                                    Branch Tax & Governance
                                </CardTitle>
                                <CardDescription>Corporate defaults & branch loss-prevention limits</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Sales Tax</span>
                                    <span className="font-mono font-semibold">{formatBps(activeBranch.tax_rate_bps)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Service Charge</span>
                                    <span className="font-mono font-semibold">
                                        {formatBps(activeBranch.service_charge_bps)}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Manager PIN Gate (&gt; discount)</span>
                                    <span className="font-mono font-semibold">
                                        {formatBps(activeBranch.discount_pin_threshold_bps)}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Cash Variance Tolerance</span>
                                    <span className="font-mono font-semibold">
                                        {formatCents(activeBranch.cash_variance_tolerance_cents)}
                                    </span>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.05 }}
                    >
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Wallet className="h-4 w-4 text-emerald-600" />
                                    Active Shift & Cash Drawer
                                </CardTitle>
                                <CardDescription>Transaction gate enforced by RequireOpenShiftMiddleware</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-2 text-sm">
                                {evaluator.activeShift ? (
                                    <>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">State</span>
                                            <Badge variant="success">Open (#{evaluator.activeShift.id})</Badge>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Opening Float</span>
                                            <span className="font-mono font-semibold">
                                                {formatCents(evaluator.activeShift.opening_cash_cents)}
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Expected Drawer Cash</span>
                                            <span className="font-mono font-semibold text-emerald-700">
                                                {formatCents(evaluator.activeShift.expected_cash_cents)}
                                            </span>
                                        </div>
                                    </>
                                ) : (
                                    <p className="text-muted-foreground">No active open shift on this branch.</p>
                                )}
                            </CardContent>
                        </Card>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                    >
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <ShieldCheck className="h-4 w-4 text-sky-600" />
                                    8-Role RBAC & Manager PIN
                                </CardTitle>
                                <CardDescription>Click any role to switch authenticated session immediately</CardDescription>
                            </CardHeader>
                            <CardContent className="flex flex-wrap gap-1.5">
                                {evaluator.roles.map((role) => {
                                    const active = evaluator.activeUser.role === role.value;

                                    return (
                                        <button
                                            key={role.value}
                                            type="button"
                                            onClick={() => handleRoleSwitch(role.value)}
                                            className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
                                                active
                                                    ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                                                    : 'border-border bg-secondary/40 text-foreground hover:bg-secondary'
                                            }`}
                                        >
                                            {role.can_authorize_pin && <KeyRound className="h-3 w-3" />}
                                            {role.label}
                                        </button>
                                    );
                                })}
                            </CardContent>
                        </Card>
                    </motion.div>
                </div>

                <Card>
                    <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <UtensilsCrossed className="h-4 w-4 text-primary" />
                                Branch Master Catalog & Real-Time 86&apos;ing ({activeBranch.code})
                            </CardTitle>
                            <CardDescription>
                                Toggle branch item availability (&quot;86&quot;) to verify per-branch isolation and
                                `ItemAvailabilityChanged` audit logging.
                            </CardDescription>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                            {stations.map((station) => (
                                <Button
                                    key={station.value}
                                    size="sm"
                                    variant={stationFilter === station.value ? 'default' : 'outline'}
                                    onClick={() => setStationFilter(station.value)}
                                >
                                    {station.label}
                                </Button>
                            ))}
                        </div>
                    </CardHeader>

                    <CardContent className="space-y-6">
                        {catalog.map((category) => {
                            const filteredItems = category.items.filter(
                                (item) => stationFilter === 'all' || item.prep_station === stationFilter,
                            );

                            if (filteredItems.length === 0) {
                                return null;
                            }

                            return (
                                <section key={category.id} className="space-y-3">
                                    <h4 className="border-b border-border pb-1.5 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                                        {category.name}
                                    </h4>

                                    <div className="grid gap-3 md:grid-cols-2">
                                        {filteredItems.map((item) => (
                                            <div
                                                key={item.id}
                                                className="rounded-xl border border-border bg-background/60 p-4 space-y-3"
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div>
                                                        <div className="font-semibold">{item.name}</div>
                                                        {item.description && (
                                                            <p className="mt-0.5 text-xs text-muted-foreground">
                                                                {item.description}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <Badge variant="outline" className="shrink-0">
                                                        <ChefHat className="h-3 w-3" />
                                                        {item.prep_station_label}
                                                    </Badge>
                                                </div>

                                                {item.allergen_tags.length > 0 && (
                                                    <div className="flex flex-wrap gap-1">
                                                        {item.allergen_tags.map((tag) => (
                                                            <Badge key={tag} variant="warning" className="text-[11px]">
                                                                {tag}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                )}

                                                <div className="space-y-2">
                                                    {item.variants.map((variant) => (
                                                        <div
                                                            key={variant.id}
                                                            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/80 bg-card px-3 py-2"
                                                        >
                                                            <div>
                                                                <div className="flex items-center gap-2 text-sm font-medium">
                                                                    <span>{variant.name}</span>
                                                                    <span className="font-mono text-xs text-muted-foreground">
                                                                        {variant.sku}
                                                                    </span>
                                                                    {variant.price_override_cents !== null && (
                                                                        <Badge variant="secondary" className="text-[10px]">
                                                                            Branch Override
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                                {!variant.is_available && variant.eighty_sixed_reason && (
                                                                    <p className="text-xs text-rose-600">
                                                                        86&apos;d: {variant.eighty_sixed_reason}
                                                                    </p>
                                                                )}
                                                            </div>

                                                            <div className="flex items-center gap-2.5">
                                                                <span className="font-mono text-sm font-semibold">
                                                                    {formatCents(variant.effective_price_cents)}
                                                                </span>

                                                                <Button
                                                                    size="sm"
                                                                    variant={
                                                                        variant.is_available ? 'outline' : 'destructive'
                                                                    }
                                                                    onClick={() =>
                                                                        handleToggle86(variant.id, variant.is_available)
                                                                    }
                                                                >
                                                                    {variant.is_available ? (
                                                                        <>
                                                                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                                                            Available · 86
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <Ban className="h-3.5 w-3.5" />
                                                                            86&apos;d · Restore
                                                                        </>
                                                                    )}
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            );
                        })}
                    </CardContent>
                </Card>
            </div>
        </AppShellLayout>
    );
}
