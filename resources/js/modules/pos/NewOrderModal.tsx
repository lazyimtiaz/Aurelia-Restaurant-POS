import { useState } from 'react';
import { router } from '@inertiajs/react';
import { Minus, Plus, ShoppingBag, Utensils, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { DiningTableData, FloorZoneData } from '@/types/pos';

interface NewOrderModalProps {
    open: boolean;
    zones: FloorZoneData[];
    onClose: () => void;
}

export function NewOrderModal({ open, zones, onClose }: NewOrderModalProps) {
    const [serviceType, setServiceType] = useState<'dine_in' | 'takeaway'>('dine_in');
    const [customerName, setCustomerName] = useState('');
    const [guestCount, setGuestCount] = useState(2);

    const availableTables: (DiningTableData & { zoneName: string })[] = zones.flatMap((z) =>
        z.tables
            .filter((t) => t.state === 'available' || t.state === 'reserved')
            .map((t) => ({ ...t, zoneName: z.name })),
    );

    const [selectedTableId, setSelectedTableId] = useState<number>(availableTables[0]?.id ?? 0);
    const [submitting, setSubmitting] = useState(false);

    if (!open) {
        return null;
    }

    const effectiveTableId = selectedTableId || availableTables[0]?.id || 0;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);

        router.post(
            '/pos/orders',
            {
                service_type: serviceType,
                table_id: serviceType === 'dine_in' ? effectiveTableId || null : null,
                guest_count: serviceType === 'dine_in' ? guestCount : 1,
                customer_name: customerName.trim() || null,
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setCustomerName('');
                    onClose();
                },
                onFinish: () => setSubmitting(false),
            },
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
            <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-5">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold">Create New Order</h3>
                    <button type="button" onClick={onClose} className="rounded p-1 hover:bg-muted cursor-pointer">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted p-1">
                        <button
                            type="button"
                            onClick={() => setServiceType('dine_in')}
                            className={`flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-semibold transition cursor-pointer ${
                                serviceType === 'dine_in'
                                    ? 'bg-primary text-primary-foreground shadow-xs'
                                    : 'text-stone-600 hover:text-foreground'
                            }`}
                        >
                            <Utensils className="h-3.5 w-3.5" />
                            Dine-In
                        </button>
                        <button
                            type="button"
                            onClick={() => setServiceType('takeaway')}
                            className={`flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-semibold transition cursor-pointer ${
                                serviceType === 'takeaway'
                                    ? 'bg-primary text-primary-foreground shadow-xs'
                                    : 'text-stone-600 hover:text-foreground'
                            }`}
                        >
                            <ShoppingBag className="h-3.5 w-3.5" />
                            Takeaway
                        </button>
                    </div>

                    <div className="space-y-1.5">
                        <label htmlFor="new-order-guest-name" className="text-xs font-semibold text-stone-700">
                            Customer Name {serviceType === 'takeaway' ? '(Recommended)' : '(Optional)'}
                        </label>
                        <input
                            id="new-order-guest-name"
                            type="text"
                            value={customerName}
                            onChange={(e) => setCustomerName(e.target.value)}
                            placeholder={serviceType === 'takeaway' ? 'e.g. Jordan Patel' : 'e.g. Party under Elena'}
                            className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm focus:border-primary focus:outline-none"
                        />
                    </div>

                    {serviceType === 'dine_in' && (
                        <>
                            <div className="flex items-center justify-between rounded-xl border border-border bg-muted/30 px-3.5 py-2.5">
                                <span className="text-xs font-semibold text-stone-700">Guests</span>
                                <div className="flex items-center gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setGuestCount((g) => Math.max(1, g - 1))}
                                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card hover:bg-muted cursor-pointer"
                                    >
                                        <Minus className="h-3.5 w-3.5" />
                                    </button>
                                    <span className="w-8 text-center font-mono text-sm font-bold">
                                        {guestCount}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setGuestCount((g) => Math.min(20, g + 1))}
                                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card hover:bg-muted cursor-pointer"
                                    >
                                        <Plus className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label htmlFor="new-order-table" className="text-xs font-semibold text-stone-700">
                                    Choose Table
                                </label>
                                {availableTables.length === 0 ? (
                                    <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                                        All tables are currently occupied or need clearing.
                                    </p>
                                ) : (
                                    <select
                                        id="new-order-table"
                                        value={effectiveTableId}
                                        onChange={(e) => setSelectedTableId(Number(e.target.value))}
                                        className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm focus:border-primary focus:outline-none"
                                    >
                                        {availableTables.map((t) => (
                                            <option key={t.id} value={t.id}>
                                                {t.code} — {t.zoneName} ({t.capacity} seats)
                                            </option>
                                        ))}
                                    </select>
                                )}
                            </div>
                        </>
                    )}

                    <Button
                        type="submit"
                        disabled={submitting || (serviceType === 'dine_in' && !effectiveTableId)}
                        className="w-full rounded-xl py-5 text-sm font-semibold"
                    >
                        {submitting ? 'Creating Order...' : 'Create Order'}
                    </Button>
                </form>
            </div>
        </div>
    );
}
