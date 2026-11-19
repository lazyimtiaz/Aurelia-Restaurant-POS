import { useMemo, useState } from 'react';
import { Head, router, usePage } from '@inertiajs/react';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { AnimatedTabs, StatusPill } from '@/design-system';
import { PosAppLayout } from '@/layouts/PosAppLayout';
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

    const categoryTabs = useMemo(
        () => [
            {
                id: 'all',
                label: 'All Categories',
                count: catalog.reduce((sum, cat) => sum + cat.items.length, 0),
            },
            ...catalog.map((cat) => ({
                id: cat.slug,
                label: cat.name,
                count: cat.items.length,
            })),
        ],
        [catalog],
    );

    const items = useMemo(() => {
        const needle = search.trim().toLowerCase();
        return catalog
            .filter((cat) => activeCategory === 'all' || cat.slug === activeCategory)
            .flatMap((cat) =>
                cat.items
                    .filter((item) => {
                        if (!needle) return true;
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
            router.post(
                `/menu/${variantId}/price-override`,
                { price_override_cents: null },
                { preserveScroll: true },
            );
            return;
        }
        const rawDollars = Number.parseFloat(priceInputs[variantId] ?? '');
        if (!Number.isFinite(rawDollars) || rawDollars < 0) return;
        router.post(
            `/menu/${variantId}/price-override`,
            { price_override_cents: Math.round(rawDollars * 100) },
            { preserveScroll: true },
        );
    };

    return (
        <PosAppLayout
            title={`Menu Management — ${auth?.activeBranch.name ?? ''}`}
            subtitle="Control real-time 86 availability and local branch pricing overrides."
        >
            <Head title="Menu — Aurelia POS" />

            <div className="space-y-6">
                <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-3.5 shadow-bistro-card lg:flex-row lg:items-center lg:justify-between">
                    <AnimatedTabs
                        layoutId="menu-catalog-categories"
                        value={activeCategory}
                        onChange={setActiveCategory}
                        items={categoryTabs}
                    />

                    <div className="relative w-full lg:w-64 shrink-0">
                        <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                        <input
                            type="search"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search menu or SKU..."
                            className="h-10 w-full rounded-xl border border-input bg-[var(--surface-inset)] pr-3 pl-9 text-xs focus:border-primary focus:bg-card focus:outline-none"
                        />
                    </div>
                </div>

                <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
                    {items.map((item) => (
                        <Card key={item.id} className="p-4 sm:p-5 space-y-4">
                            <div className="flex gap-4">
                                <DishThumbnail
                                    imagePath={item.image_path}
                                    name={item.name}
                                    station={item.prep_station}
                                    slug={item.slug}
                                    className="h-20 w-28 shrink-0"
                                />
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-start justify-between gap-2">
                                        <h3 className="ds-card-title truncate">{item.name}</h3>
                                        <StatusPill
                                            tone="neutral"
                                            dot={false}
                                            label={item.prep_station_label}
                                        />
                                    </div>
                                    <p className="ds-caption mt-1 line-clamp-2">{item.description}</p>
                                </div>
                            </div>

                            <div className="space-y-2 border-t border-border pt-3.5">
                                {item.variants.map((variant) => {
                                    const currentOverrideDollars =
                                        priceInputs[variant.id] ??
                                        (variant.price_override_cents !== null
                                            ? (variant.price_override_cents / 100).toFixed(2)
                                            : '');

                                    return (
                                        <div
                                            key={variant.id}
                                            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/80 bg-[var(--surface-inset)] px-3.5 py-2.5 text-xs"
                                        >
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-2 font-semibold text-foreground">
                                                    <span>{variant.name}</span>
                                                    <span className="font-mono text-muted-foreground">
                                                        ({variant.sku})
                                                    </span>
                                                    {!variant.is_available && (
                                                        <StatusPill tone="danger" dot={false} label="86'd" />
                                                    )}
                                                </div>
                                                <div className="mt-0.5 text-[11px] text-muted-foreground">
                                                    Base {formatCents(variant.base_price_cents)} · Effective{' '}
                                                    <span className="font-mono font-bold text-foreground">
                                                        {formatCents(variant.effective_price_cents)}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="flex flex-wrap items-center gap-2">
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
                                                    className="h-8 w-24 rounded-lg border border-input bg-card px-2 font-mono text-xs focus:border-primary focus:outline-none"
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
                        </Card>
                    ))}
                </div>
            </div>
        </PosAppLayout>
    );
}
