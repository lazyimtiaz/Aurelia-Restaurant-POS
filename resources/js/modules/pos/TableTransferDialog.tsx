import { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
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

    if (!open) {
        return null;
    }

    const effectiveTarget = selectedId || availableTables[0]?.id || 0;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
            <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-2xl space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold">Transfer Open Table Tab</h3>
                    <button type="button" onClick={onClose} className="rounded p-1 hover:bg-muted cursor-pointer">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {availableTables.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No available tables in this branch right now.</p>
                ) : (
                    <>
                        <label className="block space-y-1 text-xs">
                            <span className="font-medium text-muted-foreground">Destination Table</span>
                            <select
                                value={effectiveTarget}
                                onChange={(e) => setSelectedId(Number(e.target.value))}
                                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                            >
                                {availableTables.map((t) => (
                                    <option key={t.id} value={t.id}>
                                        Table {t.code} ({t.capacity} seats · {t.state_label})
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className="flex items-center gap-2 text-xs cursor-pointer">
                            <input
                                type="checkbox"
                                checked={markDirty}
                                onChange={(e) => setMarkDirty(e.target.checked)}
                            />
                            <span>Mark original table as Needs Clearing (Dirty)</span>
                        </label>
                    </>
                )}

                <div className="flex justify-end gap-2">
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
        </div>
    );
}
