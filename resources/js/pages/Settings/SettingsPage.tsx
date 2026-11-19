import { Head, router, useForm } from '@inertiajs/react';
import { LogOut, Save, Settings as SettingsIcon } from 'lucide-react';
import { PosAppLayout } from '@/layouts/PosAppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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

            <div className="grid gap-6 lg:grid-cols-3">
                <Card className="rounded-2xl lg:col-span-2">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <SettingsIcon className="h-4 w-4 text-primary" />
                            Branch Tax &amp; Loss-Prevention Rules
                        </CardTitle>
                        <CardDescription>
                            Rates use integer basis points (e.g. 825 bps = 8.25%) and cents to prevent rounding drift.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {Object.values(errors).length > 0 && (
                                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs text-rose-700">
                                    {Object.values(errors)[0]}
                                </div>
                            )}

                            <div className="grid gap-4 sm:grid-cols-2">
                                <label className="space-y-1 text-xs">
                                    <span className="font-semibold text-stone-700">Branch Display Name</span>
                                    <input
                                        type="text"
                                        required
                                        value={data.name}
                                        onChange={(e) => setData('name', e.target.value)}
                                        className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                                    />
                                </label>

                                <label className="space-y-1 text-xs">
                                    <span className="font-semibold text-stone-700">Timezone</span>
                                    <input
                                        type="text"
                                        required
                                        value={data.timezone}
                                        onChange={(e) => setData('timezone', e.target.value)}
                                        className="w-full rounded-xl border border-input bg-background px-3 py-2 font-mono text-sm"
                                    />
                                </label>

                                <label className="space-y-1 text-xs">
                                    <span className="font-semibold text-stone-700">
                                        Sales Tax (bps) · Preview {formatBps(Number(data.tax_rate_bps) || 0)}
                                    </span>
                                    <input
                                        type="number"
                                        min="0"
                                        max="3000"
                                        required
                                        value={data.tax_rate_bps}
                                        onChange={(e) => setData('tax_rate_bps', e.target.value)}
                                        className="w-full rounded-xl border border-input bg-background px-3 py-2 font-mono text-sm"
                                    />
                                </label>

                                <label className="space-y-1 text-xs">
                                    <span className="font-semibold text-stone-700">
                                        Service Charge (bps) · Preview {formatBps(Number(data.service_charge_bps) || 0)}
                                    </span>
                                    <input
                                        type="number"
                                        min="0"
                                        max="3000"
                                        required
                                        value={data.service_charge_bps}
                                        onChange={(e) => setData('service_charge_bps', e.target.value)}
                                        className="w-full rounded-xl border border-input bg-background px-3 py-2 font-mono text-sm"
                                    />
                                </label>

                                <label className="space-y-1 text-xs">
                                    <span className="font-semibold text-stone-700">
                                        Discount PIN Gate (bps) · Preview{' '}
                                        {formatBps(Number(data.discount_pin_threshold_bps) || 0)}
                                    </span>
                                    <input
                                        type="number"
                                        min="0"
                                        max="10000"
                                        required
                                        value={data.discount_pin_threshold_bps}
                                        onChange={(e) => setData('discount_pin_threshold_bps', e.target.value)}
                                        className="w-full rounded-xl border border-input bg-background px-3 py-2 font-mono text-sm"
                                    />
                                </label>

                                <label className="space-y-1 text-xs">
                                    <span className="font-semibold text-stone-700">
                                        Cash Variance Tolerance (cents) · Preview{' '}
                                        {formatCents(Number(data.cash_variance_tolerance_cents) || 0)}
                                    </span>
                                    <input
                                        type="number"
                                        min="0"
                                        max="100000"
                                        required
                                        value={data.cash_variance_tolerance_cents}
                                        onChange={(e) => setData('cash_variance_tolerance_cents', e.target.value)}
                                        className="w-full rounded-xl border border-input bg-background px-3 py-2 font-mono text-sm"
                                    />
                                </label>
                            </div>

                            <Button type="submit" disabled={processing} className="rounded-xl">
                                <Save className="h-4 w-4" />
                                {processing ? 'Saving...' : 'Save Branch Settings'}
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                <Card className="rounded-2xl">
                    <CardHeader>
                        <CardTitle>Terminal Device Session</CardTitle>
                        <CardDescription>
                            Signing out unlinks this POS browser session from {branchSettings.name} and clears active staff unlock.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <p className="text-xs text-muted-foreground">
                            Use “Lock Terminal” in the sidebar to switch cashiers, waiters, or kitchen staff without signing the terminal out.
                        </p>
                        <Button
                            type="button"
                            variant="destructive"
                            onClick={handleSignOutTerminal}
                            className="w-full rounded-xl"
                        >
                            <LogOut className="h-4 w-4" />
                            Sign Out Terminal Device
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </PosAppLayout>
    );
}
