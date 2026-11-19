import { useEffect, useState } from 'react';
import { router, usePage } from '@inertiajs/react';
import { AlertTriangle, ArrowDownRight, ArrowUpRight, PackagePlus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MotionDrawer, StatusPill } from '@/design-system';
import { formatCents } from '@/lib/money';
import type { BranchInventoryLedgerData, BranchStockRowData } from '@/types/executive';

interface InventoryStockDrawerProps {
    inventory: BranchInventoryLedgerData;
    inventoryBranchId: number;
    branchLabel: string;
}

type DrawerMode = 'receive' | 'wastage';

export function InventoryStockDrawer({
    inventory,
    inventoryBranchId,
    branchLabel,
}: InventoryStockDrawerProps) {
    const { errors } = usePage<{ errors?: Record<string, string> }>().props;
    const [activeMode, setActiveMode] = useState<DrawerMode | null>(null);
    const [selectedStock, setSelectedStock] = useState<BranchStockRowData | null>(null);
    const [quantity, setQuantity] = useState('500');
    const [unitCostCents, setUnitCostCents] = useState('0');
    const [referenceOrReason, setReferenceOrReason] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (!selectedStock || !activeMode) return;
        setQuantity(activeMode === 'receive' ? '500' : '100');
        setUnitCostCents(String(selectedStock.unit_cost_cents));
        setReferenceOrReason(
            activeMode === 'receive'
                ? `PO-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`
                : 'Walk-in spoilage / trim variance',
        );
    }, [selectedStock?.ingredient_id, activeMode]);

    const openDrawer = (stock: BranchStockRowData, mode: DrawerMode) => {
        setSelectedStock(stock);
        setActiveMode(mode);
    };

    const closeDrawer = () => {
        setActiveMode(null);
        setSelectedStock(null);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedStock || !activeMode) return;

        const parsedQty = Number.parseInt(quantity, 10);
        if (!Number.isFinite(parsedQty) || parsedQty <= 0) return;

        setSubmitting(true);

        if (activeMode === 'receive') {
            router.post(
                '/inventory/receive',
                {
                    branch_id: inventoryBranchId,
                    ingredient_id: selectedStock.ingredient_id,
                    quantity: parsedQty,
                    unit_cost_cents: Number.parseInt(unitCostCents, 10) || 0,
                    supplier_ref: referenceOrReason,
                },
                {
                    preserveScroll: true,
                    onSuccess: () => closeDrawer(),
                    onFinish: () => setSubmitting(false),
                },
            );
        } else {
            router.post(
                '/inventory/wastage',
                {
                    branch_id: inventoryBranchId,
                    ingredient_id: selectedStock.ingredient_id,
                    quantity: parsedQty,
                    reason: referenceOrReason || 'Manual kitchen wastage',
                },
                {
                    preserveScroll: true,
                    onSuccess: () => closeDrawer(),
                    onFinish: () => setSubmitting(false),
                },
            );
        }
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader className="border-b border-border/60 bg-[var(--surface-inset)]/60">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                            <CardTitle>Recipe Ingredient Stock &amp; Auto-86 Thresholds — {branchLabel}</CardTitle>
                            <CardDescription>
                                Receiving stock above threshold automatically restores 86&apos;d menu items across POS registers.
                            </CardDescription>
                        </div>
                        <StatusPill
                            tone="neutral"
                            dot={false}
                            label={`${inventory.stocks.length} Ingredients Tracked`}
                        />
                    </div>
                </CardHeader>

                <CardContent className="p-0 sm:p-6">
                    <div className="overflow-x-auto px-4 py-3 sm:p-0">
                        <table className="w-full min-w-[740px] border-collapse text-left text-sm">
                            <thead>
                                <tr className="border-b border-border text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                    <th className="py-3 pr-4">Ingredient</th>
                                    <th className="py-3 pr-4">On Hand</th>
                                    <th className="py-3 pr-4">Auto-86 Threshold</th>
                                    <th className="py-3 pr-4">Unit Cost</th>
                                    <th className="py-3 pr-4">Linked Menu Variants</th>
                                    <th className="py-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/70">
                                {inventory.stocks.map((stock) => (
                                    <tr key={stock.id} className={stock.is_low_stock ? 'bg-rose-500/5' : undefined}>
                                        <td className="py-3.5 pr-4">
                                            <div className="font-semibold text-foreground">{stock.name}</div>
                                            <div className="font-mono text-xs text-muted-foreground">{stock.code}</div>
                                        </td>
                                        <td className="py-3.5 pr-4">
                                            <div className="flex flex-wrap items-center gap-2 font-mono font-semibold">
                                                <span>
                                                    {stock.quantity_on_hand.toLocaleString()} {stock.unit_short}
                                                </span>
                                                {stock.is_low_stock && (
                                                    <StatusPill
                                                        tone="danger"
                                                        pulse
                                                        icon={<AlertTriangle className="h-3 w-3" />}
                                                        label="Low / 86"
                                                    />
                                                )}
                                            </div>
                                        </td>
                                        <td className="py-3.5 pr-4 font-mono text-muted-foreground">
                                            {stock.auto_86_threshold.toLocaleString()} {stock.unit_short}
                                        </td>
                                        <td className="py-3.5 pr-4 font-mono">
                                            {formatCents(stock.unit_cost_cents)} / {stock.unit_short}
                                        </td>
                                        <td className="py-3.5 pr-4">
                                            <div className="flex flex-wrap gap-1.5">
                                                {stock.affected_variants.map((variant) => (
                                                    <StatusPill
                                                        key={variant.variant_id}
                                                        tone={variant.is_available ? 'neutral' : 'danger'}
                                                        dot={false}
                                                        label={`${variant.sku} · ${variant.is_available ? 'Available' : '86’d'}`}
                                                    />
                                                ))}
                                            </div>
                                        </td>
                                        <td className="py-3.5 text-right">
                                            <div className="inline-flex items-center gap-2">
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => openDrawer(stock, 'receive')}
                                                >
                                                    <PackagePlus className="h-3.5 w-3.5 text-emerald-600" />
                                                    <span>Receive</span>
                                                </Button>
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => openDrawer(stock, 'wastage')}
                                                >
                                                    <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                                                    <span>Wastage</span>
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="border-b border-border/60 bg-[var(--surface-inset)]/60">
                    <CardTitle>Recent Stock Movements &amp; Recipe COGS Ledger</CardTitle>
                    <CardDescription>
                        Idempotent recipe deductions on served kitchen orders, supplier deliveries, and wastage snapshots.
                    </CardDescription>
                </CardHeader>

                <CardContent className="p-0 sm:p-6">
                    {inventory.recentMovements.length === 0 ? (
                        <p className="py-8 text-center text-sm text-muted-foreground">
                            No stock movements recorded yet for this branch.
                        </p>
                    ) : (
                        <div className="overflow-x-auto px-4 py-3 sm:p-0">
                            <table className="w-full min-w-[680px] border-collapse text-left text-xs">
                                <thead>
                                    <tr className="border-b border-border font-semibold uppercase tracking-wider text-muted-foreground">
                                        <th className="py-2.5 pr-3">Ingredient</th>
                                        <th className="py-2.5 pr-3">Type</th>
                                        <th className="py-2.5 pr-3">Reference</th>
                                        <th className="py-2.5 pr-3">Delta</th>
                                        <th className="py-2.5 pr-3">COGS / Value</th>
                                        <th className="py-2.5 pr-3">Notes</th>
                                        <th className="py-2.5">Actor</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/60">
                                    {inventory.recentMovements.map((move) => {
                                        const isPositive = move.quantity_delta >= 0;
                                        return (
                                            <tr key={move.id}>
                                                <td className="py-2.5 pr-3 font-medium">
                                                    {move.ingredient_name}{' '}
                                                    <span className="font-mono text-muted-foreground">
                                                        ({move.ingredient_code})
                                                    </span>
                                                </td>
                                                <td className="py-2.5 pr-3">
                                                    <StatusPill
                                                        tone={isPositive ? 'success' : 'neutral'}
                                                        dot={false}
                                                        label={move.movement_label}
                                                    />
                                                </td>
                                                <td className="py-2.5 pr-3 font-mono text-muted-foreground">
                                                    {move.reference_type}#{move.reference_id}
                                                </td>
                                                <td className="py-2.5 pr-3 font-mono font-semibold">
                                                    <span
                                                        className={`inline-flex items-center gap-0.5 ${
                                                            isPositive ? 'text-emerald-600' : 'text-rose-600'
                                                        }`}
                                                    >
                                                        {isPositive ? (
                                                            <ArrowUpRight className="h-3.5 w-3.5" />
                                                        ) : (
                                                            <ArrowDownRight className="h-3.5 w-3.5" />
                                                        )}
                                                        {isPositive ? '+' : ''}
                                                        {move.quantity_delta.toLocaleString()} {move.unit_short}
                                                    </span>
                                                </td>
                                                <td className="py-2.5 pr-3 font-mono">
                                                    {formatCents(move.total_cost_cents)}
                                                </td>
                                                <td className="py-2.5 pr-3 text-muted-foreground">
                                                    {move.notes ?? '—'}
                                                </td>
                                                <td className="py-2.5">{move.actor_name}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            <MotionDrawer
                open={activeMode !== null && selectedStock !== null}
                onClose={closeDrawer}
                side="right"
                title={
                    activeMode === 'receive' ? 'Receive Supplier Delivery' : 'Record Manual Wastage'
                }
                description={
                    selectedStock
                        ? `${selectedStock.name} (${selectedStock.code}) · On hand: ${selectedStock.quantity_on_hand.toLocaleString()} ${selectedStock.unit_short}`
                        : undefined
                }
            >
                {selectedStock && activeMode && (
                    <form
                        onSubmit={handleSubmit}
                        className="flex h-full flex-col justify-between space-y-5 p-5 sm:p-6"
                    >
                        <div className="space-y-4">
                            {errors?.inventory && (
                                <div className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-3.5 py-2.5 text-xs font-medium text-rose-700">
                                    {errors.inventory}
                                </div>
                            )}

                            <div>
                                <label className="ds-label mb-1.5 block">
                                    Quantity ({selectedStock.unit_label})
                                </label>
                                <input
                                    type="number"
                                    min={1}
                                    required
                                    value={quantity}
                                    onChange={(e) => setQuantity(e.target.value)}
                                    className="h-11 w-full rounded-xl border border-input bg-[var(--surface-inset)] px-3.5 font-mono text-sm focus:border-primary focus:bg-card focus:outline-none"
                                />
                            </div>

                            {activeMode === 'receive' && (
                                <div>
                                    <label className="ds-label mb-1.5 block">
                                        Unit Cost (cents per {selectedStock.unit_short})
                                    </label>
                                    <input
                                        type="number"
                                        min={0}
                                        required
                                        value={unitCostCents}
                                        onChange={(e) => setUnitCostCents(e.target.value)}
                                        className="h-11 w-full rounded-xl border border-input bg-[var(--surface-inset)] px-3.5 font-mono text-sm focus:border-primary focus:bg-card focus:outline-none"
                                    />
                                </div>
                            )}

                            <div>
                                <label className="ds-label mb-1.5 block">
                                    {activeMode === 'receive' ? 'Supplier / PO Reference' : 'Wastage Reason'}
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={referenceOrReason}
                                    onChange={(e) => setReferenceOrReason(e.target.value)}
                                    className="h-11 w-full rounded-xl border border-input bg-[var(--surface-inset)] px-3.5 text-sm focus:border-primary focus:bg-card focus:outline-none"
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2.5 border-t border-border pt-4">
                            <Button type="button" variant="outline" onClick={closeDrawer}>
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                variant={activeMode === 'wastage' ? 'destructive' : 'default'}
                                loading={submitting}
                            >
                                {activeMode === 'receive' ? 'Confirm Stock Receipt' : 'Record Wastage'}
                            </Button>
                        </div>
                    </form>
                )}
            </MotionDrawer>
        </div>
    );
}
