import type { PropsWithChildren } from 'react';
import { usePage } from '@inertiajs/react';
import { EvaluatorControlBar } from '@/components/evaluator/EvaluatorControlBar';
import type { SharedPageProps } from '@/types/evaluator';

export function AppShellLayout({ children }: PropsWithChildren) {
    const { flash } = usePage<SharedPageProps>().props;

    return (
        <div className="min-h-screen bg-background text-foreground">
            <EvaluatorControlBar />

            {flash?.error && (
                <div className="border-b border-rose-500/30 bg-rose-500/10 px-4 py-2 text-center text-sm font-medium text-rose-700">
                    {flash.error}
                </div>
            )}

            {flash?.success && (
                <div className="border-b border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-center text-sm font-medium text-emerald-700">
                    {flash.success}
                </div>
            )}

            <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
        </div>
    );
}
