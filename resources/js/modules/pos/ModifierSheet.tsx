import { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCents } from '@/lib/money';
import type { MenuItemData, MenuVariantData } from '@/types/evaluator';

interface ModifierSheetProps {
    item: MenuItemData | null;
    onClose: () => void;
    onAdd: (payload: {
        menu_item_variant_id: number;
        quantity: number;
        modifier_option_ids: number[];
        seat_number: number | null;
        special_instructions: string;
    }) => void;
}

export function ModifierSheet({ item, onClose, onAdd }: ModifierSheetProps) {
    const [selectedVariantId, setSelectedVariantId] = useState<number | null>(null);
    const [selectedMods, setSelectedMods] = useState<number[]>([]);
    const [quantity, setQuantity] = useState(1);
    const [seatNumber, setSeatNumber] = useState<number>(1);
    const [notes, setNotes] = useState('');

    if (!item) {
        return null;
    }

    const availableVariants = item.variants.filter((v) => v.is_available);
    const activeVariant: MenuVariantData | undefined =
        item.variants.find((v) => v.id === selectedVariantId) ?? availableVariants[0] ?? item.variants[0];

    const toggleMod = (optionId: number, maxSelect: number, groupOptionIds: number[]) => {
        setSelectedMods((prev) => {
            if (prev.includes(optionId)) {
                return prev.filter((id) => id !== optionId);
            }
            if (maxSelect === 1) {
                return [...prev.filter((id) => !groupOptionIds.includes(id)), optionId];
            }
            const currentInGroup = prev.filter((id) => groupOptionIds.includes(id));
            if (currentInGroup.length >= maxSelect) {
                return prev;
            }
            return [...prev, optionId];
        });
    };

    const handleConfirm = () => {
        if (!activeVariant || !activeVariant.is_available) {
            return;
        }

        onAdd({
            menu_item_variant_id: activeVariant.id,
            quantity,
            modifier_option_ids: selectedMods,
            seat_number: seatNumber,
            special_instructions: notes.trim(),
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
            <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl space-y-4">
                <div className="flex items-start justify-between">
                    <div>
                        <h3 className="text-lg font-bold">{item.name}</h3>
                        <p className="text-xs text-muted-foreground">{item.prep_station_label}</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-md p-1 text-muted-foreground hover:bg-muted cursor-pointer"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="space-y-2">
                    <span className="text-xs font-semibold text-muted-foreground uppercase">Portion / Variant</span>
                    <div className="grid grid-cols-2 gap-2">
                        {item.variants.map((variant) => {
                            const selected = activeVariant?.id === variant.id;

                            return (
                                <button
                                    key={variant.id}
                                    type="button"
                                    disabled={!variant.is_available}
                                    onClick={() => setSelectedVariantId(variant.id)}
                                    className={`rounded-xl border p-2.5 text-left text-sm transition cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
                                        selected
                                            ? 'border-primary bg-primary/10 font-semibold'
                                            : 'border-border hover:bg-muted/50'
                                    }`}
                                >
                                    <div>{variant.name}</div>
                                    <div className="font-mono text-xs text-muted-foreground">
                                        {variant.is_available
                                            ? formatCents(variant.effective_price_cents)
                                            : "86'd"}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {item.modifier_groups.map((group) => {
                    const groupOptionIds = group.options.map((o) => o.id);

                    return (
                        <div key={group.id} className="space-y-2">
                            <div className="flex justify-between text-xs font-semibold text-muted-foreground uppercase">
                                <span>{group.name}</span>
                                <span>{group.is_required ? 'Required' : `Max ${group.max_select}`}</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {group.options.map((opt) => {
                                    const active = selectedMods.includes(opt.id);

                                    return (
                                        <button
                                            key={opt.id}
                                            type="button"
                                            onClick={() => toggleMod(opt.id, group.max_select, groupOptionIds)}
                                            className={`rounded-lg border px-2.5 py-1 text-xs transition cursor-pointer ${
                                                active
                                                    ? 'border-primary bg-primary text-primary-foreground'
                                                    : 'border-border bg-background hover:bg-muted'
                                            }`}
                                        >
                                            {opt.name}
                                            {opt.price_delta_cents > 0 && ` (+${formatCents(opt.price_delta_cents)})`}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}

                <div className="grid grid-cols-2 gap-3">
                    <label className="space-y-1 text-xs">
                        <span className="font-medium text-muted-foreground">Quantity</span>
                        <input
                            type="number"
                            min={1}
                            max={20}
                            value={quantity}
                            onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                            className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm"
                        />
                    </label>

                    <label className="space-y-1 text-xs">
                        <span className="font-medium text-muted-foreground">Seat #</span>
                        <input
                            type="number"
                            min={1}
                            max={12}
                            value={seatNumber}
                            onChange={(e) => setSeatNumber(Math.max(1, Number(e.target.value)))}
                            className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm"
                        />
                    </label>
                </div>

                <label className="block space-y-1 text-xs">
                    <span className="font-medium text-muted-foreground">Kitchen Notes / Allergy</span>
                    <input
                        type="text"
                        placeholder="e.g. No sesame, sauce on side"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm"
                    />
                </label>

                <div className="flex justify-end gap-2 pt-1">
                    <Button type="button" variant="outline" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        disabled={!activeVariant || !activeVariant.is_available}
                        onClick={handleConfirm}
                    >
                        Add to Tab
                    </Button>
                </div>
            </div>
        </div>
    );
}
