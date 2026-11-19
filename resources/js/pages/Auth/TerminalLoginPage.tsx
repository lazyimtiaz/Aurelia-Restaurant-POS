import { useState } from 'react';
import { Head, useForm } from '@inertiajs/react';
import { Building2, KeyRound, UtensilsCrossed } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { BranchOptionData } from '@/types/pos-app';

interface TerminalLoginPageProps {
    branches: BranchOptionData[];
}

export default function TerminalLoginPage({ branches }: TerminalLoginPageProps) {
    const [showPassword, setShowPassword] = useState(false);
    const { data, setData, post, processing, errors } = useForm({
        email: '',
        password: '',
        branch_id: branches[0] ? String(branches[0].id) : '',
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        post('/login');
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
            <Head title="Terminal Sign-In — Aurelia POS" />

            <div className="w-full max-w-md space-y-6">
                <div className="text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md">
                        <UtensilsCrossed className="h-7 w-7" />
                    </div>
                    <h1 className="mt-4 text-2xl font-bold tracking-tight text-foreground">
                        Aurelia Dining Group
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Sign in to bind this POS terminal to a restaurant location.
                    </p>
                </div>

                <Card className="rounded-2xl border border-border shadow-md">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <KeyRound className="h-4 w-4 text-primary" />
                            Manager Terminal Activation
                        </CardTitle>
                        <CardDescription>
                            Enter Manager, Owner, or System Admin credentials to unlock staff PIN sign-in.
                        </CardDescription>
                    </CardHeader>

                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {errors.email && (
                                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700">
                                    {errors.email}
                                </div>
                            )}

                            <div className="space-y-1.5">
                                <label htmlFor="terminal-email" className="text-xs font-semibold text-stone-700">
                                    Work Email
                                </label>
                                <input
                                    id="terminal-email"
                                    type="email"
                                    required
                                    autoComplete="username"
                                    value={data.email}
                                    onChange={(e) => setData('email', e.target.value)}
                                    placeholder="name@aurelia.test"
                                    className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <label htmlFor="terminal-password" className="text-xs font-semibold text-stone-700">
                                        Password
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword((prev) => !prev)}
                                        className="text-xs font-medium text-primary hover:underline cursor-pointer"
                                    >
                                        {showPassword ? 'Hide' : 'Show'}
                                    </button>
                                </div>
                                <input
                                    id="terminal-password"
                                    type={showPassword ? 'text' : 'password'}
                                    required
                                    autoComplete="current-password"
                                    value={data.password}
                                    onChange={(e) => setData('password', e.target.value)}
                                    className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label htmlFor="terminal-branch" className="flex items-center gap-1.5 text-xs font-semibold text-stone-700">
                                    <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                                    Terminal Branch (for Multi-Branch Owners / Admins)
                                </label>
                                <select
                                    id="terminal-branch"
                                    value={data.branch_id}
                                    onChange={(e) => setData('branch_id', e.target.value)}
                                    className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
                                >
                                    {branches.map((branch) => (
                                        <option key={branch.id} value={branch.id}>
                                            {branch.code} — {branch.name}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-[11px] text-muted-foreground">
                                    Branch Managers are automatically bound to their assigned restaurant branch.
                                </p>
                            </div>

                            <Button type="submit" disabled={processing} className="w-full rounded-xl py-5 text-sm font-semibold">
                                {processing ? 'Activating Terminal...' : 'Sign In Terminal'}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
