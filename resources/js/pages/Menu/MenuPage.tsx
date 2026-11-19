import { useMemo, useState } from 'react';
import { Head, router, usePage } from '@inertiajs/react';
import { Plus, Search, UtensilsCrossed } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { AnimatedTabs, IconBadge, MotionModal, StatusPill, dispatchToast } from '@/design-system';
import { PosAppLayout } from '@/layouts/PosAppLayout';
import { formatCents } from '@/lib/money';
import { DishThumbnail } from '@/modules/pos/DishThumbnail';
import type { MenuCategoryData, PosSharedProps } from '@/types/pos-app';

interface StationOption {
    value: string;
    label: string;
}

interface MenuPageProps {
    catalog: MenuCategoryData[];
    stations?: StationOption[];
}

const DEFAULT_STATIONS: StationOption[] = [
    { value: 'grill', label: 'Grill & Hot Line' },
    { value: 'cold_salad', label: 'Cold & Garde Manger' },
    { value: 'pastry', label: 'Pastry & Desserts' },
    { value: 'bar', label: 'Bar & Beverages' },
];

export default function MenuPage({ catalog, stations = DEFAULT_STATIONS }: MenuPageProps) {
    const { auth } = usePage<PosSharedProps>().props;
    const [activeCategory, setActiveCategory] = useState('all');
    const [search, setSearch] = useState('');
    const [priceInputs, setPriceInputs] = useState<Record<number, string>>({});

    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);
    const [newCategoryId, setNewCategoryId] = useState<number>(catalog[0]?.id ?? 0);
    const [newName, setNewName] = useState('');
    const [newDescription, setNewDescription] = useState('');
    const [newStation, setNewStation] = useState<string>(stations[0]?.value ?? 'grill');
    const [newVariantName, setNewVariantName] = useState('Standard');
    const [newSku, setNewSku] = useState('');
    const [newPriceDollars, setNewPriceDollars] = useState('18.00');

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
            {
                preserveScroll: true,
                onError: (errors) =>
                    dispatchToast('error', Object.values(errors)[0] || 'Could not toggle availability.'),
            },
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

    const handleCreateMenuItem = (e: React.FormEvent) => {
        e.preventDefault();
        setCreateError(null);
        const parsedDollars = Number.parseFloat(newPriceDollars);
        if (!Number.isFinite(parsedDollars) || parsedDollars < 0) {
            setCreateError('Enter a valid price in dollars.');
            return;
        }
        setSubmitting(true);

        router.post(
            '/menu/items',
            {
                menu_category_id: newCategoryId || catalog[0]?.id,
                name: newName,
                description: newDescription,
                prep_station: newStation,
                variant_name: newVariantName || 'Standard',
                sku: newSku,
                base_price_cents: Math.round(parsedDollars * 100),
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setCreateModalOpen(false);
                    setNewName('');
                    setNewDescription('');
                    setNewSku('');
                    setNewVariantName('Standard');
                    setNewPriceDollars('18.00');
                },
                onError: (errors) => setCreateError(Object.values(errors)[0] || 'Could not create item.'),
                onFinish: () => setSubmitting(false),
            },
        );
    };

    return (
        <PosAppLayout
            title={`Menu Management — ${auth?.activeBranch.name ?? ''}`}
            subtitle="Create catalog dishes, manage real-time 86 availability, and configure branch price overrides."
        >
            <Head title="Menu — Aurelia POS" />

            <div className="space-y-6">
                <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-3.5 shadow-bistro-card">
                    <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                        <div className="relative w-full sm:w-72">
                            <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                            <input
                                type="search"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search menu or SKU..."
                                className="h-10 w-full rounded-xl border border-input bg-[var(--surface-inset)] pr-3 pl-9 text-xs focus:border-primary focus:bg-card focus:outline-none"
                            />
                        </div>

                        <Button
                            type="button"
                            onClick={() => {
                                setCreateError(null);
                                if (!newCategoryId && catalog[0]) setNewCategoryId(catalog[0].id);
                                setCreateModalOpen(true);
                            }}
                            className="shrink-0"
                        >
                            <Plus className="h-4 w-4" />
                            <span>Add Menu Item</span>
                        </Button>
                    </div>

                    <AnimatedTabs
                        layoutId="menu-catalog-categories"
                        wrap
                        value={activeCategory}
                        onChange={setActiveCategory}
                        items={categoryTabs}
                    />
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

            <MotionModal
                open={createModalOpen}
                onClose={() => setCreateModalOpen(false)}
                title="Add Catalog Dish"
                description="Create a new menu item and default serving variant across branches."
                icon={
                    <IconBadge tone="orange" shape="squircle">
                        <UtensilsCrossed className="h-4.5 w-4.5" />
                    </IconBadge>
                }
                maxWidth="md"
            >
                <form onSubmit={handleCreateMenuItem} className="space-y-4 p-5 sm:p-6">
                    {createError && (
                        <div className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-3.5 py-2.5 text-xs font-medium text-rose-700">
                            {createError}
                        </div>
                    )}

                    <div className="grid gap-3 sm:grid-cols-2">
                        <label className="space-y-1.5 text-xs">
                            <span className="ds-label block">Category</span>
                            <select
                                value={newCategoryId || catalog[0]?.id || ''}
                                onChange={(e) => setNewCategoryId(Number(e.target.value))}
                                className="h-10 w-full rounded-xl border border-input bg-[var(--surface-inset)] px-3 text-sm focus:border-primary focus:bg-card focus:outline-none"
                            >
                                {catalog.map((cat) => (
                                    <option key={cat.id} value={cat.id}>
                                        {cat.name}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className="space-y-1.5 text-xs">
                            <span className="ds-label block">Prep Station</span>
                            <select
                                value={newStation}
                                onChange={(e) => setNewStation(e.target.value)}
                                className="h-10 w-full rounded-xl border border-input bg-[var(--surface-inset)] px-3 text-sm focus:border-primary focus:bg-card focus:outline-none"
                            >
                                {stations.map((st) => (
                                    <option key={st.value} value={st.value}>
                                        {st.label}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>

                    <label className="block space-y-1.5 text-xs">
                        <span className="ds-label block">Dish Name</span>
                        <input
                            type="text"
                            required
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            placeholder="e.g. Truffle Wild Mushroom Risotto"
                            className="h-10 w-full rounded-xl border border-input bg-[var(--surface-inset)] px-3.5 text-sm focus:border-primary focus:bg-card focus:outline-none"
                        />
                    </label>

                    <label className="block space-y-1.5 text-xs">
                        <span className="ds-label block">Description</span>
                        <input
                            type="text"
                            value={newDescription}
                            onChange={(e) => setNewDescription(e.target.value)}
                            placeholder="e.g. Acquerello rice, black truffle butter, aged Parmigiano"
                            className="h-10 w-full rounded-xl border border-input bg-[var(--surface-inset)] px-3.5 text-sm focus:border-primary focus:bg-card focus:outline-none"
                        />
                    </label>

                    <div className="grid gap-3 sm:grid-cols-3">
                        <label className="space-y-1.5 text-xs">
                            <span className="ds-label block">Portion Name</span>
                            <input
                                type="text"
                                required
                                value={newVariantName}
                                onChange={(e) => setNewVariantName(e.target.value)}
                                className="h-10 w-full rounded-xl border border-input bg-[var(--surface-inset)] px-3 text-sm focus:border-primary focus:bg-card focus:outline-none"
                            />
                        </label>

                        <label className="space-y-1.5 text-xs">
                            <span className="ds-label block">SKU</span>
                            <input
                                type="text"
                                required
                                value={newSku}
                                onChange={(e) => setNewSku(e.target.value.toUpperCase())}
                                placeholder="GRL-RIS-STD"
                                className="h-10 w-full rounded-xl border border-input bg-[var(--surface-inset)] px-3 font-mono text-sm uppercase focus:border-primary focus:bg-card focus:outline-none"
                            />
                        </label>

                        <label className="space-y-1.5 text-xs">
                            <span className="ds-label block">Base Price ($)</span>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                required
                                value={newPriceDollars}
                                onChange={(e) => setNewPriceDollars(e.target.value)}
                                className="h-10 w-full rounded-xl border border-input bg-[var(--surface-inset)] px-3 font-mono text-sm focus:border-primary focus:bg-card focus:outline-none"
                            />
                        </label>
                    </div>

                    <div className="flex justify-end gap-2.5 pt-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setCreateModalOpen(false)}
                            disabled={submitting}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" loading={submitting}>
                            Save Dish
                        </Button>
                    </div>
                </form>
            </MotionModal>
        </PosAppLayout>
    );
}
