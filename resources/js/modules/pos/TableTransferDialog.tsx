import { useState } from 'react';
import { ArrowRightLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { IconBadge, MotionModal } from '@/design-system';
import type { FloorZoneData } from '@/types/pos';

interface TableTransferDialogProps {
    open: boolean;
    zones: FloorZoneData[];
    currentTableId: number | null;
    onClose: () => void;
    onConfirm: (targetTableId: number, markSourceDirty: boolean) => void;
}

export function TableTransferDialog({
    open,
    zones,
    currentTableId,
    onClose,
    onConfirm,
}: TableTransferDialogProps) {
    const availableTables = zones
        .flatMap((z) => z.tables)
        .filter((t) => (t.state === 'available' || t.state === 'reserved') && t.id !== currentTableId);

    const [selectedId, setSelectedId] = useState<number>(availableTables[0]?.id ?? 0);
    const [markDirty, setMarkDirty] = useState(false);

    const effectiveTarget = selectedId || availableTables[0]?.id || 0;

    return (
        <MotionModal
            open={open}
            onClose={onClose}
            title="Transfer Open Table Tab"
            description="Move all running items and guests to another table."
            icon={
                <IconBadge tone="orange" size="md" shape="squircle">
                    <ArrowRightLeft className="h-4.5 w-4.5" />
                </IconBadge>
            }
            maxWidth="sm"
        >
            <div className="space-y-4 p-5 sm:p-6">
                {availableTables.length === 0 ? (
                    <p className="py-2 text-sm text-muted-foreground">
                        No available tables in this branch right now.
                    </p>
                ) : (
                    <>
                        <label className="block space-y-1.5">
                            <span className="ds-label block">Destination Table</span>
                            <select
                                value={effectiveTarget}
                                onChange={(e) => setSelectedId(Number(e.target.value))}
                                className="h-10 w-full rounded-xl border border-input bg-[var(--surface-inset)] px-3 text-sm text-foreground focus:border-primary focus:bg-card focus:outline-none"
                            >
                                {availableTables.map((t) => (
                                    <option key={t.id} value={t.id}>
                                        Table {t.code} ({t.capacity} seats · {t.state_label})
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className="flex items-center gap-2.5 rounded-xl border border-border/80 bg-[var(--surface-inset)] px-3 py-2.5 text-xs font-medium cursor-pointer">
                            <input
                                type="checkbox"
                                checked={markDirty}
                                onChange={(e) => setMarkDirty(e.target.checked)}
                                className="h-4 w-4 rounded accent-[#EA580C]"
                            />
                            <span>Mark original table as Needs Clearing (Dirty)</span>
                        </label>
                    </>
                )}

                <div className="flex justify-end gap-2.5 pt-2">
                    <Button type="button" variant="outline" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        disabled={!effectiveTarget}
                        onClick={() => onConfirm(effectiveTarget, markDirty)}
                    >
                        Confirm Transfer
                    </Button>
                </div>
            </div>
        </MotionModal>
    );
}
