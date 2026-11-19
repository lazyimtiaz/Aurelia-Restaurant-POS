import { Head, router, useForm } from '@inertiajs/react';
import { LogOut, Save, Settings as SettingsIcon, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { IconBadge } from '@/design-system';
import { PosAppLayout } from '@/layouts/PosAppLayout';
import { formatBps, formatCents } from '@/lib/money';

interface BranchSettingsProps {
    branchSettings: {
        id: number;
        code: string;
        name: string;
        timezone: string;
        tax_rate_bps: number;
        service_charge_bps: number;
        discount_pin_threshold_bps: number;
        cash_variance_tolerance_cents: number;
        operating_hours: Record<string, string>;
        is_active: boolean;
    };
}

export default function SettingsPage({ branchSettings }: BranchSettingsProps) {
    const { data, setData, put, processing, errors } = useForm({
        name: branchSettings.name,
        timezone: branchSettings.timezone,
        tax_rate_bps: String(branchSettings.tax_rate_bps),
        service_charge_bps: String(branchSettings.service_charge_bps),
        discount_pin_threshold_bps: String(branchSettings.discount_pin_threshold_bps),
        cash_variance_tolerance_cents: String(branchSettings.cash_variance_tolerance_cents),
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        put('/settings/branch');
    };

    const handleSignOutTerminal = () => {
        router.post('/terminal/sign-out');
    };

    return (
        <PosAppLayout
            title={`Settings — ${branchSettings.name} (${branchSettings.code})`}
            subtitle="Configure tax rules, service charges, Manager PIN thresholds, and device activation."
        >
            <Head title="Settings — Aurelia POS" />

            <div className="grid gap-6 lg:grid-cols-3 items-start">
                <Card className="lg:col-span-2">
                    <CardHeader className="border-b border-border/60 bg-[var(--surface-inset)]/60">
                        <CardTitle className="flex items-center gap-2">
                            <SettingsIcon className="h-4 w-4 text-primary" />
                            <span>Branch Tax &amp; Loss-Prevention Rules</span>
                        </CardTitle>
                        <CardDescription>
                            Rates use integer basis points (e.g. 825 bps = 8.25%) and cents to prevent rounding drift.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-5 sm:p-6">
                        <form onSubmit={handleSubmit} className="space-y-5">
                            {Object.values(errors).length > 0 && (
                                <div className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-3.5 py-2.5 text-xs font-medium text-rose-700">
                                    {Object.values(errors)[0]}
                                </div>
                            )}

                            <div className="grid gap-4 sm:grid-cols-2">
                                <label className="space-y-1.5 text-xs">
                                    <span className="ds-label block">Branch Display Name</span>
                                    <input
                                        type="text"
                                        required
                                        value={data.name}
                                        onChange={(e) => setData('name', e.target.value)}
                                        className="h-11 w-full rounded-xl border border-input bg-[var(--surface-inset)] px-3.5 text-sm focus:border-primary focus:bg-card focus:outline-none"
                                    />
                                </label>

                                <label className="space-y-1.5 text-xs">
                                    <span className="ds-label block">Timezone</span>
                                    <input
                                        type="text"
                                        required
                                        value={data.timezone}
                                        onChange={(e) => setData('timezone', e.target.value)}
                                        className="h-11 w-full rounded-xl border border-input bg-[var(--surface-inset)] px-3.5 font-mono text-sm focus:border-primary focus:bg-card focus:outline-none"
                                    />
                                </label>

                                <label className="space-y-1.5 text-xs">
                                    <span className="ds-label block">
                                        Sales Tax (bps) · Preview{' '}
                                        <span className="font-mono text-primary">
                                            {formatBps(Number(data.tax_rate_bps) || 0)}
                                        </span>
                                    </span>
                                    <input
                                        type="number"
                                        min="0"
                                        max="3000"
                                        required
                                        value={data.tax_rate_bps}
                                        onChange={(e) => setData('tax_rate_bps', e.target.value)}
                                        className="h-11 w-full rounded-xl border border-input bg-[var(--surface-inset)] px-3.5 font-mono text-sm focus:border-primary focus:bg-card focus:outline-none"
                                    />
                                </label>

                                <label className="space-y-1.5 text-xs">
                                    <span className="ds-label block">
                                        Service Charge (bps) · Preview{' '}
                                        <span className="font-mono text-primary">
                                            {formatBps(Number(data.service_charge_bps) || 0)}
                                        </span>
                                    </span>
                                    <input
                                        type="number"
                                        min="0"
                                        max="3000"
                                        required
                                        value={data.service_charge_bps}
                                        onChange={(e) => setData('service_charge_bps', e.target.value)}
                                        className="h-11 w-full rounded-xl border border-input bg-[var(--surface-inset)] px-3.5 font-mono text-sm focus:border-primary focus:bg-card focus:outline-none"
                                    />
                                </label>

                                <label className="space-y-1.5 text-xs">
                                    <span className="ds-label block">
                                        Discount PIN Gate (bps) · Preview{' '}
                                        <span className="font-mono text-primary">
                                            {formatBps(Number(data.discount_pin_threshold_bps) || 0)}
                                        </span>
                                    </span>
                                    <input
                                        type="number"
                                        min="0"
                                        max="10000"
                                        required
                                        value={data.discount_pin_threshold_bps}
                                        onChange={(e) => setData('discount_pin_threshold_bps', e.target.value)}
                                        className="h-11 w-full rounded-xl border border-input bg-[var(--surface-inset)] px-3.5 font-mono text-sm focus:border-primary focus:bg-card focus:outline-none"
                                    />
                                </label>

                                <label className="space-y-1.5 text-xs">
                                    <span className="ds-label block">
                                        Cash Variance Tolerance (cents) · Preview{' '}
                                        <span className="font-mono text-primary">
                                            {formatCents(Number(data.cash_variance_tolerance_cents) || 0)}
                                        </span>
                                    </span>
                                    <input
                                        type="number"
                                        min="0"
                                        max="100000"
                                        required
                                        value={data.cash_variance_tolerance_cents}
                                        onChange={(e) =>
                                            setData('cash_variance_tolerance_cents', e.target.value)
                                        }
                                        className="h-11 w-full rounded-xl border border-input bg-[var(--surface-inset)] px-3.5 font-mono text-sm focus:border-primary focus:bg-card focus:outline-none"
                                    />
                                </label>
                            </div>

                            <Button type="submit" size="lg" loading={processing}>
                                <Save className="h-4 w-4" />
                                <span>{processing ? 'Saving...' : 'Save Branch Settings'}</span>
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="border-b border-border/60 bg-[var(--surface-inset)]/60">
                        <div className="flex items-center gap-3">
                            <IconBadge tone="rose" shape="squircle">
                                <Shield className="h-4.5 w-4.5" />
                            </IconBadge>
                            <div>
                                <CardTitle>Terminal Device Session</CardTitle>
                                <CardDescription>Unlink browser station from branch</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4 p-5 sm:p-6">
                        <p className="ds-caption leading-relaxed">
                            Signing out unlinks this POS browser session from {branchSettings.name} and clears active staff unlock. Use “Lock Terminal” in the sidebar to switch staff without signing the terminal out.
                        </p>
                        <Button
                            type="button"
                            variant="destructive"
                            size="lg"
                            onClick={handleSignOutTerminal}
                            className="w-full"
                        >
                            <LogOut className="h-4 w-4" />
                            <span>Sign Out Terminal Device</span>
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </PosAppLayout>
    );
}
