import { useMemo, useState } from 'react';
import { Head, router, usePage } from '@inertiajs/react';
import { Search } from 'lucide-react';
import { PosAppLayout } from '@/layouts/PosAppLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { formatCents } from '@/lib/money';
import { DishThumbnail } from '@/modules/pos/DishThumbnail';
import type { MenuCategoryData, PosSharedProps } from '@/types/pos-app';

interface MenuPageProps {
    catalog: MenuCategoryData[];
}

export default function MenuPage({ catalog }: MenuPageProps) {
    const { auth } = usePage<PosSharedProps>().props;
    const [activeCategory, setActiveCategory] = useState('all');
    const [search, setSearch] = useState('');
    const [priceInputs, setPriceInputs] = useState<Record<number, string>>({});

    const items = useMemo(() => {
        const needle = search.trim().toLowerCase();
        return catalog
            .filter((cat) => activeCategory === 'all' || cat.slug === activeCategory)
            .flatMap((cat) =>
                cat.items
                    .filter((item) => {
                        if (!needle) {
                            return true;
                        }
                        return (
                            item.name.toLowerCase().includes(needle) ||
                            item.variants.some((v) => v.sku.toLowerCase().includes(needle))
                        );
                    })
                    .map((item) => ({ ...item, categoryName: cat.name })),
            );
    }, [catalog, activeCategory, search]);

    const handleToggleAvailability = (variantId: number, currentlyAvailable: boolean) => {
        router.post(
            `/menu/${variantId}/availability`,
            {
                is_available: !currentlyAvailable,
                reason: currentlyAvailable ? 'Marked out of stock at branch' : null,
            },
            { preserveScroll: true },
        );
    };

    const handleSavePriceOverride = (variantId: number, clear = false) => {
        if (clear) {
            router.post(`/menu/${variantId}/price-override`, { price_override_cents: null }, { preserveScroll: true });
            return;
        }
        const rawDollars = Number.parseFloat(priceInputs[variantId] ?? '');
        if (!Number.isFinite(rawDollars) || rawDollars < 0) {
            return;
        }
        router.post(
            `/menu/${variantId}/price-override`,
            { price_override_cents: Math.round(rawDollars * 100) },
            { preserveScroll: true },
        );
    };

    return (
        <PosAppLayout
            title={`Menu Management — ${auth?.activeBranch.name ?? ''}`}
            subtitle="Manage branch 86 availability and local branch pricing overrides."
        >
            <Head title="Menu — Aurelia POS" />

            <div className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-3.5">
                    <div className="flex flex-wrap gap-1.5">
                        <button
                            type="button"
                            onClick={() => setActiveCategory('all')}
                            className={`rounded-xl px-3 py-1.5 text-xs font-semibold cursor-pointer ${
                                activeCategory === 'all'
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-muted text-stone-700'
                            }`}
                        >
                            All Categories
                        </button>
                        {catalog.map((cat) => (
                            <button
                                key={cat.id}
                                type="button"
                                onClick={() => setActiveCategory(cat.slug)}
                                className={`rounded-xl px-3 py-1.5 text-xs font-semibold cursor-pointer ${
                                    activeCategory === cat.slug
                                        ? 'bg-primary text-primary-foreground'
                                        : 'bg-muted text-stone-700'
                                }`}
                            >
                                {cat.name}
                            </button>
                        ))}
                    </div>

                    <div className="relative w-full sm:w-64">
                        <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                        <input
                            type="search"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search menu or SKU..."
                            className="w-full rounded-xl border border-input bg-background py-1.5 pr-3 pl-8 text-xs focus:border-primary focus:outline-none"
                        />
                    </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                    {items.map((item) => (
                        <div key={item.id} className="rounded-2xl border border-border bg-card p-4 shadow-2xs space-y-3">
                            <div className="flex gap-3.5">
                                <DishThumbnail
                                    imagePath={item.image_path}
                                    name={item.name}
                                    station={item.prep_station}
                                    className="h-20 w-20 shrink-0"
                                />
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center justify-between gap-2">
                                        <h3 className="truncate text-base font-bold">{item.name}</h3>
                                        <Badge variant="outline">{item.prep_station_label}</Badge>
                                    </div>
                                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                                        {item.description}
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-2 border-t border-border pt-3">
                                {item.variants.map((variant) => {
                                    const currentOverrideDollars =
                                        priceInputs[variant.id] ??
                                        (variant.price_override_cents !== null
                                            ? (variant.price_override_cents / 100).toFixed(2)
                                            : '');

                                    return (
                                        <div
                                            key={variant.id}
                                            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/70 bg-muted/30 px-3 py-2 text-xs"
                                        >
                                            <div>
                                                <div className="flex items-center gap-2 font-semibold">
                                                    <span>{variant.name}</span>
                                                    <span className="font-mono text-muted-foreground">
                                                        ({variant.sku})
                                                    </span>
                                                    {!variant.is_available && (
                                                        <Badge variant="destructive" className="text-[10px]">
                                                            86’d
                                                        </Badge>
                                                    )}
                                                </div>
                                                <div className="text-[11px] text-muted-foreground">
                                                    Base {formatCents(variant.base_price_cents)} · Effective{' '}
                                                    <span className="font-mono font-bold text-foreground">
                                                        {formatCents(variant.effective_price_cents)}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    placeholder="Override $"
                                                    value={currentOverrideDollars}
                                                    onChange={(e) =>
                                                        setPriceInputs((prev) => ({
                                                            ...prev,
                                                            [variant.id]: e.target.value,
                                                        }))
                                                    }
                                                    className="w-24 rounded-lg border border-input bg-background px-2 py-1 font-mono text-xs"
                                                />
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => handleSavePriceOverride(variant.id, false)}
                                                >
                                                    Set
                                                </Button>
                                                {variant.price_override_cents !== null && (
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => handleSavePriceOverride(variant.id, true)}
                                                    >
                                                        Reset
                                                    </Button>
                                                )}
                                                <Switch
                                                    checked={variant.is_available}
                                                    onCheckedChange={() =>
                                                        handleToggleAvailability(variant.id, variant.is_available)
                                                    }
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </PosAppLayout>
    );
}
