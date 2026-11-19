import { useState } from 'react';
import { Head, useForm } from '@inertiajs/react';
import { motion } from 'motion/react';
import { Building2, Eye, EyeOff, KeyRound, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AureliaMark } from '@/design-system';
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
        <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8 sm:py-12">
            <Head title="Terminal Sign-In — Aurelia POS" />

            <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28 }}
                className="w-full max-w-md space-y-6"
            >
                <div className="flex flex-col items-center text-center">
                    <AureliaMark size="xl" />
                    <h1 className="ds-page-title mt-4">Aurelia Dining Group</h1>
                    <p className="ds-caption mt-1 max-w-xs text-sm">
                        Activate this POS station and bind it to an operating restaurant branch.
                    </p>
                </div>

                <Card className="overflow-hidden shadow-bistro-elevated">
                    <CardHeader className="border-b border-border bg-[var(--surface-inset)]">
                        <CardTitle className="flex items-center gap-2 text-base">
                            <KeyRound className="h-4 w-4 text-primary" />
                            <span>Manager Terminal Activation</span>
                        </CardTitle>
                        <CardDescription>
                            Sign in with Manager, Owner, or System Admin credentials to unlock staff PIN switching.
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="p-5 sm:p-6">
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {errors.email && (
                                <motion.div
                                    initial={{ opacity: 0, y: -4 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-3.5 py-2.5 text-xs font-medium text-rose-700"
                                >
                                    {errors.email}
                                </motion.div>
                            )}

                            <div className="space-y-1.5">
                                <label htmlFor="terminal-email" className="ds-label block">
                                    Work Email
                                </label>
                                <input
                                    id="terminal-email"
                                    type="email"
                                    required
                                    autoComplete="username"
                                    value={data.email}
                                    onChange={(e) => setData('email', e.target.value)}
                                    placeholder="manager@aurelia.test"
                                    className="h-11 w-full rounded-xl border border-input bg-[var(--surface-inset)] px-3.5 text-sm text-foreground transition focus:border-primary focus:bg-card focus:ring-2 focus:ring-primary/20 focus:outline-none"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <label htmlFor="terminal-password" className="ds-label">
                                        Password
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword((prev) => !prev)}
                                        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline cursor-pointer"
                                    >
                                        {showPassword ? (
                                            <>
                                                <EyeOff className="h-3.5 w-3.5" />
                                                <span>Hide</span>
                                            </>
                                        ) : (
                                            <>
                                                <Eye className="h-3.5 w-3.5" />
                                                <span>Show</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                                <input
                                    id="terminal-password"
                                    type={showPassword ? 'text' : 'password'}
                                    required
                                    autoComplete="current-password"
                                    value={data.password}
                                    onChange={(e) => setData('password', e.target.value)}
                                    className="h-11 w-full rounded-xl border border-input bg-[var(--surface-inset)] px-3.5 text-sm text-foreground transition focus:border-primary focus:bg-card focus:ring-2 focus:ring-primary/20 focus:outline-none"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label
                                    htmlFor="terminal-branch"
                                    className="ds-label flex items-center gap-1.5"
                                >
                                    <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                                    <span>Terminal Branch</span>
                                </label>
                                <select
                                    id="terminal-branch"
                                    value={data.branch_id}
                                    onChange={(e) => setData('branch_id', e.target.value)}
                                    className="h-11 w-full rounded-xl border border-input bg-[var(--surface-inset)] px-3.5 text-sm text-foreground transition focus:border-primary focus:bg-card focus:ring-2 focus:ring-primary/20 focus:outline-none"
                                >
                                    {branches.map((branch) => (
                                        <option key={branch.id} value={branch.id}>
                                            {branch.code} — {branch.name}
                                        </option>
                                    ))}
                                </select>
                                <p className="ds-caption">
                                    Branch Managers bind directly to their assigned location.
                                </p>
                            </div>

                            <Button type="submit" size="lg" loading={processing} className="w-full mt-2">
                                {processing ? 'Activating Terminal...' : 'Sign In Terminal'}
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                <p className="flex items-center justify-center gap-1.5 ds-caption">
                    <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                    <span>Encrypted restaurant terminal binding</span>
                </p>
            </motion.div>
        </div>
    );
}
