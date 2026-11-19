import { Head } from '@inertiajs/react';
import { KitchenLayout } from '@/layouts/KitchenLayout';
import { KdsPanel } from '@/modules/kds/KdsPanel';
import type { KdsTicketData } from '@/types/pos';

interface KitchenPageProps {
    tickets: KdsTicketData[];
    stations: { value: string; label: string }[];
    activeStation?: string | null;
}

export default function KitchenPage({
    tickets,
    stations,
    activeStation = null,
}: KitchenPageProps) {
    return (
        <KitchenLayout>
            <Head title="Kitchen Display System — Aurelia POS" />
            <KdsPanel tickets={tickets} stations={stations} initialStation={activeStation} />
        </KitchenLayout>
    );
}
