import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Ban, Plus, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatCents } from '@/lib/money';
import type { MenuCategoryData, MenuItemData } from '@/types/evaluator';

interface ProductGridProps {
    catalog: MenuCategoryData[];
    disabled?: boolean;
    onSelectItem: (item: MenuItemData) => void;
}

export function ProductGrid({ catalog, disabled = false, onSelectItem }: ProductGridProps) {
    const [activeCategoryId, setActiveCategoryId] = useState<number | 'all'>('all');
    const [search, setSearch] = useState('');

    const visibleItems = useMemo(() => {
        const needle = search.trim().toLowerCase();

        return catalog
            .filter((cat) => activeCategoryId === 'all' || cat.id === activeCategoryId)
            .flatMap((cat) => cat.items)
            .filter((item) => !needle || item.name.toLowerCase().includes(needle));
    }, [catalog, activeCategoryId, search]);

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[180px]">
                    <Search className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Search menu items..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full rounded-lg border border-input bg-background py-1.5 pr-3 pl-9 text-sm focus:border-primary focus:outline-none"
                    />
                </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
                <button
                    type="button"
                    onClick={() => setActiveCategoryId('all')}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                        activeCategoryId === 'all'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                    }`}
                >
                    All Menu
                </button>
                {catalog.map((cat) => (
                    <button
                        key={cat.id}
                        type="button"
                        onClick={() => setActiveCategoryId(cat.id)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                            activeCategoryId === cat.id
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                        }`}
                    >
                        {cat.name}
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {visibleItems.map((item) => {
                    const anyAvailable = item.variants.some((v) => v.is_available);
                    const leadVariant = item.variants[0];

                    return (
                        <motion.button
                            key={item.id}
                            type="button"
                            whileTap={{ scale: anyAvailable && !disabled ? 0.98 : 1 }}
                            disabled={!anyAvailable || disabled}
                            onClick={() => onSelectItem(item)}
                            className={`flex flex-col justify-between rounded-xl border p-3.5 text-left transition cursor-pointer disabled:cursor-not-allowed ${
                                anyAvailable
                                    ? 'border-border bg-card hover:border-primary/60 hover:shadow-sm'
                                    : 'border-rose-500/30 bg-rose-500/5 opacity-65'
                            }`}
                        >
                            <div className="flex items-start justify-between gap-2">
                                <div>
                                    <div className="font-semibold leading-tight">{item.name}</div>
                                    <div className="mt-1 text-xs text-muted-foreground">{item.prep_station_label}</div>
                                </div>
                                {anyAvailable ? (
                                    <span className="rounded-md bg-primary/15 p-1 text-primary">
                                        <Plus className="h-4 w-4" />
                                    </span>
                                ) : (
                                    <Badge variant="destructive">
                                        <Ban className="h-3 w-3" />
                                        86&apos;d
                                    </Badge>
                                )}
                            </div>

                            <div className="mt-3 flex items-center justify-between text-xs">
                                <span className="font-mono font-bold text-foreground">
                                    {leadVariant ? formatCents(leadVariant.effective_price_cents) : '—'}
                                    {item.variants.length > 1 && '+'}
                                </span>
                                {item.modifier_groups.length > 0 && (
                                    <span className="text-muted-foreground">Customizable</span>
                                )}
                            </div>
                        </motion.button>
                    );
                })}
            </div>
        </div>
    );
}
