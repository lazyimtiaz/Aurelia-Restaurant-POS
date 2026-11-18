import { Head, usePage } from '@inertiajs/react';
import { AppShellLayout } from '@/layouts/AppShellLayout';
import { KdsPanel } from '@/modules/kds/KdsPanel';
import type { SharedPageProps } from '@/types/evaluator';
import type { KdsTicketData } from '@/types/pos';

interface KdsWorkspaceProps {
    tickets: KdsTicketData[];
    stations: { value: string; label: string }[];
    activeStation?: string | null;
}

export default function KdsWorkspace({
    tickets,
    stations,
    activeStation = null,
}: KdsWorkspaceProps) {
    const { evaluator } = usePage<SharedPageProps>().props;

    return (
        <AppShellLayout>
            <Head title="Kitchen Display System" />

            <div className="space-y-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">
                        Kitchen Display System — {evaluator.activeBranch.name}
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Touch-friendly station bumping (`Queued → In Prep → Ready`), live SLA timers, and Expediter tray handoff.
                    </p>
                </div>

                <KdsPanel tickets={tickets} stations={stations} initialStation={activeStation} />
            </div>
        </AppShellLayout>
    );
}
