import { useEffect, useState } from 'react';
import { router, usePage } from '@inertiajs/react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, ArrowDownRight, ArrowUpRight, PackagePlus, Trash2, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
        if (!selectedStock || !activeMode) {
            return;
        }
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
        if (!selectedStock || !activeMode) {
            return;
        }

        const parsedQty = Number.parseInt(quantity, 10);
        if (!Number.isFinite(parsedQty) || parsedQty <= 0) {
            return;
        }

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
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                            <CardTitle>Recipe Ingredient Stock &amp; Auto-86 Thresholds — {branchLabel}</CardTitle>
                            <CardDescription>
                                Receiving stock above threshold automatically restores 86&apos;d POS variants and broadcasts{' '}
                                <code className="font-mono text-xs">ItemAvailabilityChanged</code>.
                            </CardDescription>
                        </div>
                        <Badge variant="outline">{inventory.stocks.length} Ingredients Tracked</Badge>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left text-sm">
                            <thead>
                                <tr className="border-b border-border text-xs font-semibold text-muted-foreground uppercase">
                                    <th className="py-2.5 pr-4">Ingredient</th>
                                    <th className="py-2.5 pr-4">On Hand</th>
                                    <th className="py-2.5 pr-4">Auto-86 Threshold</th>
                                    <th className="py-2.5 pr-4">Unit Cost</th>
                                    <th className="py-2.5 pr-4">Linked Menu Variants</th>
                                    <th className="py-2.5 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/70">
                                {inventory.stocks.map((stock) => (
                                    <tr key={stock.id} className={stock.is_low_stock ? 'bg-rose-500/5' : undefined}>
                                        <td className="py-3 pr-4">
                                            <div className="font-medium">{stock.name}</div>
                                            <div className="font-mono text-xs text-muted-foreground">{stock.code}</div>
                                        </td>
                                        <td className="py-3 pr-4">
                                            <div className="flex items-center gap-2 font-mono font-semibold">
                                                <span>
                                                    {stock.quantity_on_hand.toLocaleString()} {stock.unit_short}
                                                </span>
                                                {stock.is_low_stock && (
                                                    <Badge variant="destructive" className="text-[10px]">
                                                        <AlertTriangle className="h-3 w-3" />
                                                        Low / 86 Triggered
                                                    </Badge>
                                                )}
                                            </div>
                                        </td>
                                        <td className="py-3 pr-4 font-mono text-muted-foreground">
                                            {stock.auto_86_threshold.toLocaleString()} {stock.unit_short}
                                        </td>
                                        <td className="py-3 pr-4 font-mono">
                                            {formatCents(stock.unit_cost_cents)} / {stock.unit_short}
                                        </td>
                                        <td className="py-3 pr-4">
                                            <div className="flex flex-wrap gap-1.5">
                                                {stock.affected_variants.map((variant) => (
                                                    <Badge
                                                        key={variant.variant_id}
                                                        variant={variant.is_available ? 'outline' : 'destructive'}
                                                        className="text-[11px]"
                                                        title={variant.eighty_sixed_reason ?? undefined}
                                                    >
                                                        {variant.sku} · {variant.is_available ? 'Available' : '86’d'}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="py-3 text-right">
                                            <div className="inline-flex items-center gap-2">
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => openDrawer(stock, 'receive')}
                                                >
                                                    <PackagePlus className="h-3.5 w-3.5 text-emerald-600" />
                                                    Receive
                                                </Button>
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => openDrawer(stock, 'wastage')}
                                                >
                                                    <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                                                    Wastage
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
                <CardHeader>
                    <CardTitle>Recent Stock Movements &amp; Recipe COGS Ledger</CardTitle>
                    <CardDescription>
                        Idempotent Horizon <code className="font-mono text-xs">inventory</code> queue deductions, supplier deliveries, and wastage snapshots.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {inventory.recentMovements.length === 0 ? (
                        <p className="py-6 text-center text-sm text-muted-foreground">
                            No stock movements recorded yet for this branch. Serve a KDS ticket or receive stock above.
                        </p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse text-left text-xs">
                                <thead>
                                    <tr className="border-b border-border font-semibold text-muted-foreground uppercase">
                                        <th className="py-2 pr-3">Ingredient</th>
                                        <th className="py-2 pr-3">Type</th>
                                        <th className="py-2 pr-3">Reference</th>
                                        <th className="py-2 pr-3">Delta</th>
                                        <th className="py-2 pr-3">COGS / Value</th>
                                        <th className="py-2 pr-3">Notes</th>
                                        <th className="py-2">Actor</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/60">
                                    {inventory.recentMovements.map((move) => {
                                        const isPositive = move.quantity_delta >= 0;
                                        return (
                                            <tr key={move.id}>
                                                <td className="py-2 pr-3 font-medium">
                                                    {move.ingredient_name}{' '}
                                                    <span className="font-mono text-muted-foreground">({move.ingredient_code})</span>
                                                </td>
                                                <td className="py-2 pr-3">
                                                    <Badge variant={isPositive ? 'success' : 'secondary'}>
                                                        {move.movement_label}
                                                    </Badge>
                                                </td>
                                                <td className="py-2 pr-3 font-mono text-muted-foreground">
                                                    {move.reference_type}#{move.reference_id}
                                                </td>
                                                <td className="py-2 pr-3 font-mono font-semibold">
                                                    <span className={`inline-flex items-center gap-0.5 ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                        {isPositive ? (
                                                            <ArrowUpRight className="h-3.5 w-3.5" />
                                                        ) : (
                                                            <ArrowDownRight className="h-3.5 w-3.5" />
                                                        )}
                                                        {isPositive ? '+' : ''}
                                                        {move.quantity_delta.toLocaleString()} {move.unit_short}
                                                    </span>
                                                </td>
                                                <td className="py-2 pr-3 font-mono">{formatCents(move.total_cost_cents)}</td>
                                                <td className="py-2 pr-3 text-muted-foreground">{move.notes ?? '—'}</td>
                                                <td className="py-2">{move.actor_name}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            <AnimatePresence>
                {activeMode && selectedStock && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs"
                    >
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                            className="flex h-full w-full max-w-md flex-col border-l border-border bg-card p-6 shadow-2xl"
                        >
                            <div className="flex items-start justify-between border-b border-border pb-4">
                                <div>
                                    <h3 className="text-lg font-bold">
                                        {activeMode === 'receive' ? 'Receive Supplier Delivery' : 'Record Manual Wastage'}
                                    </h3>
                                    <p className="text-xs text-muted-foreground">
                                        {selectedStock.name} ({selectedStock.code}) · On hand:{' '}
                                        {selectedStock.quantity_on_hand.toLocaleString()} {selectedStock.unit_short}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={closeDrawer}
                                    className="rounded-md p-1 text-muted-foreground hover:bg-muted cursor-pointer"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="mt-5 flex flex-1 flex-col justify-between space-y-4">
                                <div className="space-y-4">
                                    {errors?.inventory && (
                                        <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-700">
                                            {errors.inventory}
                                        </div>
                                    )}
                                    <div>
                                        <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
                                            Quantity ({selectedStock.unit_label})
                                        </label>
                                        <input
                                            type="number"
                                            min={1}
                                            required
                                            value={quantity}
                                            onChange={(e) => setQuantity(e.target.value)}
                                            className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm focus:border-primary focus:outline-none"
                                        />
                                    </div>

                                    {activeMode === 'receive' && (
                                        <div>
                                            <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
                                                Unit Cost (cents per {selectedStock.unit_short})
                                            </label>
                                            <input
                                                type="number"
                                                min={0}
                                                required
                                                value={unitCostCents}
                                                onChange={(e) => setUnitCostCents(e.target.value)}
                                                className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm focus:border-primary focus:outline-none"
                                            />
                                        </div>
                                    )}

                                    <div>
                                        <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
                                            {activeMode === 'receive' ? 'Supplier / PO Reference' : 'Wastage Reason'}
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={referenceOrReason}
                                            onChange={(e) => setReferenceOrReason(e.target.value)}
                                            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                                        />
                                    </div>
                                </div>

                                <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
                                    <Button type="button" variant="outline" onClick={closeDrawer}>
                                        Cancel
                                    </Button>
                                    <Button
                                        type="submit"
                                        variant={activeMode === 'wastage' ? 'destructive' : 'default'}
                                        disabled={submitting}
                                    >
                                        {submitting
                                            ? 'Saving...'
                                            : activeMode === 'receive'
                                              ? 'Confirm Stock Receipt'
                                              : 'Record Wastage'}
                                    </Button>
                                </div>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
