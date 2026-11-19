import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Check, Minus, Plus, UtensilsCrossed } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { IconBadge, MotionModal } from '@/design-system';
import { formatCents } from '@/lib/money';
import { cn } from '@/lib/utils';
import type { MenuItemData, MenuVariantData } from '@/types/pos-app';

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

    useEffect(() => {
        if (item) {
            const firstAvail = item.variants.find((v) => v.is_available) ?? item.variants[0] ?? null;
            setSelectedVariantId(firstAvail?.id ?? null);
            setSelectedMods([]);
            setQuantity(1);
            setNotes('');
        }
    }, [item?.id]);

    const availableVariants = item?.variants.filter((v) => v.is_available) ?? [];
    const activeVariant: MenuVariantData | undefined = item
        ? item.variants.find((v) => v.id === selectedVariantId) ?? availableVariants[0] ?? item.variants[0]
        : undefined;

    const modifiersTotalCents = useMemo(() => {
        if (!item) return 0;
        const allOptions = item.modifier_groups.flatMap((g) => g.options);
        return selectedMods.reduce((sum, id) => {
            const opt = allOptions.find((o) => o.id === id);
            return sum + (opt?.price_delta_cents ?? 0);
        }, 0);
    }, [item, selectedMods]);

    const computedUnitCents = (activeVariant?.effective_price_cents ?? 0) + modifiersTotalCents;
    const computedLineCents = computedUnitCents * quantity;

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
        if (!activeVariant || !activeVariant.is_available) return;
        onAdd({
            menu_item_variant_id: activeVariant.id,
            quantity,
            modifier_option_ids: selectedMods,
            seat_number: seatNumber,
            special_instructions: notes.trim(),
        });
    };

    return (
        <MotionModal
            open={item !== null}
            onClose={onClose}
            title={item?.name}
            description={item ? `${item.prep_station_label} · Customize portion & kitchen prep` : undefined}
            icon={
                <IconBadge tone="orange" shape="squircle">
                    <UtensilsCrossed className="h-4.5 w-4.5" />
                </IconBadge>
            }
            maxWidth="md"
        >
            {item && (
                <div className="space-y-5 p-5 sm:p-6">
                    <div className="space-y-2">
                        <span className="ds-overline block">Portion / Variant</span>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            {item.variants.map((variant) => {
                                const selected = activeVariant?.id === variant.id;
                                return (
                                    <motion.button
                                        key={variant.id}
                                        type="button"
                                        whileTap={{ scale: 0.98 }}
                                        disabled={!variant.is_available}
                                        onClick={() => setSelectedVariantId(variant.id)}
                                        className={cn(
                                            'flex items-center justify-between rounded-xl border px-3.5 py-3 text-left text-sm transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-45',
                                            selected
                                                ? 'border-primary bg-accent font-semibold ring-2 ring-primary/20'
                                                : 'border-border bg-[var(--surface-inset)] hover:border-[#dcd4c7]',
                                        )}
                                    >
                                        <div className="min-w-0 pr-2">
                                            <div className="truncate text-foreground">{variant.name}</div>
                                            <div className="ds-num-sm text-muted-foreground">
                                                {variant.is_available
                                                    ? formatCents(variant.effective_price_cents)
                                                    : "86'd"}
                                            </div>
                                        </div>
                                        {selected && (
                                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                                                <Check className="h-3 w-3" />
                                            </span>
                                        )}
                                    </motion.button>
                                );
                            })}
                        </div>
                    </div>

                    {item.modifier_groups.map((group) => {
                        const groupOptionIds = group.options.map((o) => o.id);
                        return (
                            <div key={group.id} className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="ds-overline">{group.name}</span>
                                    <span className="ds-caption">
                                        {group.is_required ? 'Required' : `Up to ${group.max_select}`}
                                    </span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {group.options.map((opt) => {
                                        const active = selectedMods.includes(opt.id);
                                        return (
                                            <motion.button
                                                key={opt.id}
                                                type="button"
                                                whileTap={{ scale: 0.95 }}
                                                onClick={() => toggleMod(opt.id, group.max_select, groupOptionIds)}
                                                className={cn(
                                                    'rounded-xl border px-3 py-1.5 text-xs font-semibold transition cursor-pointer',
                                                    active
                                                        ? 'border-primary bg-primary text-primary-foreground shadow-xs'
                                                        : 'border-border bg-card text-foreground hover:bg-[var(--surface-inset)]',
                                                )}
                                            >
                                                {opt.name}
                                                {opt.price_delta_cents > 0 &&
                                                    ` (+${formatCents(opt.price_delta_cents)})`}
                                            </motion.button>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}

                    <div className="grid grid-cols-2 gap-3">
                        <div className="flex items-center justify-between rounded-xl border border-border bg-[var(--surface-inset)] px-3 py-2">
                            <span className="ds-caption font-semibold">Qty</span>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-card hover:bg-secondary cursor-pointer"
                                >
                                    <Minus className="h-3 w-3" />
                                </button>
                                <span className="w-5 text-center ds-num-sm">{quantity}</span>
                                <button
                                    type="button"
                                    onClick={() => setQuantity((q) => Math.min(20, q + 1))}
                                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-card hover:bg-secondary cursor-pointer"
                                >
                                    <Plus className="h-3 w-3" />
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center justify-between rounded-xl border border-border bg-[var(--surface-inset)] px-3 py-2">
                            <span className="ds-caption font-semibold">Seat #</span>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setSeatNumber((s) => Math.max(1, s - 1))}
                                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-card hover:bg-secondary cursor-pointer"
                                >
                                    <Minus className="h-3 w-3" />
                                </button>
                                <span className="w-5 text-center ds-num-sm">{seatNumber}</span>
                                <button
                                    type="button"
                                    onClick={() => setSeatNumber((s) => Math.min(12, s + 1))}
                                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-card hover:bg-secondary cursor-pointer"
                                >
                                    <Plus className="h-3 w-3" />
                                </button>
                            </div>
                        </div>
                    </div>

                    <label className="block space-y-1.5">
                        <span className="ds-label block">Kitchen Notes / Allergy</span>
                        <input
                            type="text"
                            placeholder="e.g. No sesame, sauce on side"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="h-10 w-full rounded-xl border border-input bg-[var(--surface-inset)] px-3.5 text-sm text-foreground focus:border-primary focus:bg-card focus:outline-none"
                        />
                    </label>

                    <div className="flex gap-2.5 pt-1">
                        <Button type="button" variant="outline" size="lg" onClick={onClose} className="w-28">
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            size="lg"
                            disabled={!activeVariant || !activeVariant.is_available}
                            onClick={handleConfirm}
                            className="flex-1"
                        >
                            Add to Tab · {formatCents(computedLineCents)}
                        </Button>
                    </div>
                </div>
            )}
        </MotionModal>
    );
}
