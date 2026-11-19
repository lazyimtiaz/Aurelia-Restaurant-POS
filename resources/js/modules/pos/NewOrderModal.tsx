import { useState } from 'react';
import { router } from '@inertiajs/react';
import { Minus, Plus, ShoppingBag, Utensils } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AnimatedTabs, IconBadge, MotionModal } from '@/design-system';
import type { DiningTableData, FloorZoneData } from '@/types/pos';

interface NewOrderModalProps {
    open: boolean;
    zones: FloorZoneData[];
    description?: string;
    onClose: () => void;
    onCreated?: () => void;
}

export function NewOrderModal({ open, zones, description, onClose, onCreated }: NewOrderModalProps) {
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
                    if (onCreated) {
                        onCreated();
                    } else {
                        onClose();
                    }
                },
                onFinish: () => setSubmitting(false),
            },
        );
    };

    return (
        <MotionModal
            open={open}
            onClose={onClose}
            title="Create New Order"
            description={description ?? 'Open a seated dining room tab or quick counter takeaway ticket.'}
            icon={
                <IconBadge tone="orange" shape="squircle">
                    <Utensils className="h-4.5 w-4.5" />
                </IconBadge>
            }
            maxWidth="md"
        >
            <form onSubmit={handleSubmit} className="space-y-4 p-5 sm:p-6">
                <AnimatedTabs
                    layoutId="new-order-service-type"
                    value={serviceType}
                    onChange={setServiceType}
                    className="w-full grid grid-cols-2"
                    items={[
                        { id: 'dine_in', label: 'Dine-In', icon: <Utensils className="h-3.5 w-3.5" /> },
                        {
                            id: 'takeaway',
                            label: 'Takeaway',
                            icon: <ShoppingBag className="h-3.5 w-3.5" />,
                        },
                    ]}
                />

                <div className="space-y-1.5">
                    <label htmlFor="new-order-guest-name" className="ds-label block">
                        Customer Name {serviceType === 'takeaway' ? '(Recommended)' : '(Optional)'}
                    </label>
                    <input
                        id="new-order-guest-name"
                        type="text"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder={
                            serviceType === 'takeaway' ? 'e.g. Jordan Patel' : 'e.g. Party under Elena'
                        }
                        className="h-11 w-full rounded-xl border border-input bg-[var(--surface-inset)] px-3.5 text-sm text-foreground focus:border-primary focus:bg-card focus:ring-2 focus:ring-primary/20 focus:outline-none"
                    />
                </div>

                {serviceType === 'dine_in' && (
                    <>
                        <div className="flex items-center justify-between rounded-xl border border-border bg-[var(--surface-inset)] px-4 py-3">
                            <span className="ds-label">Party Guests</span>
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => setGuestCount((g) => Math.max(1, g - 1))}
                                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card hover:bg-secondary cursor-pointer"
                                >
                                    <Minus className="h-3.5 w-3.5" />
                                </button>
                                <span className="w-8 text-center ds-num-sm">{guestCount}</span>
                                <button
                                    type="button"
                                    onClick={() => setGuestCount((g) => Math.min(20, g + 1))}
                                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card hover:bg-secondary cursor-pointer"
                                >
                                    <Plus className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label htmlFor="new-order-table" className="ds-label block">
                                Choose Table
                            </label>
                            {availableTables.length === 0 ? (
                                <p className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-3.5 py-2.5 text-xs font-medium text-rose-700">
                                    All tables are currently occupied or need clearing.
                                </p>
                            ) : (
                                <select
                                    id="new-order-table"
                                    value={effectiveTableId}
                                    onChange={(e) => setSelectedTableId(Number(e.target.value))}
                                    className="h-11 w-full rounded-xl border border-input bg-[var(--surface-inset)] px-3.5 text-sm text-foreground focus:border-primary focus:bg-card focus:outline-none"
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

                <div className="flex gap-2.5 pt-2">
                    <Button type="button" variant="outline" size="lg" onClick={onClose} className="w-28">
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        size="lg"
                        loading={submitting}
                        disabled={serviceType === 'dine_in' && !effectiveTableId}
                        className="flex-1"
                    >
                        {submitting ? 'Creating Order...' : 'Create Order'}
                    </Button>
                </div>
            </form>
        </MotionModal>
    );
}
