import { useEffect, useState } from 'react';
import { Printer, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCents } from '@/lib/money';
import type { ThermalReceiptPayload } from '@/types/billing';

interface ThermalReceiptDialogProps {
    billSplitId: number | null;
    onClose: () => void;
}

export function ThermalReceiptDialog({ billSplitId, onClose }: ThermalReceiptDialogProps) {
    const [receipt, setReceipt] = useState<ThermalReceiptPayload | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!billSplitId) {
            setReceipt(null);
            return;
        }

        let cancelled = false;
        setLoading(true);

        fetch(`/billing/splits/${billSplitId}/receipt`, {
            headers: { Accept: 'application/json' },
        })
            .then((res) => res.json())
            .then((data: ThermalReceiptPayload) => {
                if (!cancelled) {
                    setReceipt(data);
                    setLoading(false);
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [billSplitId]);

    if (!billSplitId) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
            <div className="w-full max-w-sm rounded-2xl border border-border bg-white p-5 text-zinc-900 shadow-2xl">
                <div className="mb-3 flex items-center justify-between print:hidden">
                    <span className="text-xs font-bold tracking-wider text-zinc-500 uppercase">80mm Thermal Receipt</span>
                    <button type="button" onClick={onClose} className="rounded p-1 hover:bg-zinc-100 cursor-pointer">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {loading || !receipt ? (
                    <div className="py-12 text-center font-mono text-xs text-zinc-500">Generating receipt...</div>
                ) : (
                    <div className="space-y-3 border border-dashed border-zinc-300 bg-zinc-50 p-4 font-mono text-xs">
                        <div className="text-center">
                            <div className="text-sm font-bold">AURELIA DINING GROUP</div>
                            <div>{receipt.branchName} ({receipt.branchCode})</div>
                            <div className="mt-1 text-[11px] text-zinc-500">
                                Order {receipt.orderNumber} · {receipt.checkLabel}
                            </div>
                            <div className="text-[11px] text-zinc-500">
                                {receipt.tableCode ? `Table ${receipt.tableCode}` : `Takeaway · ${receipt.customerName || 'Guest'}`}
                            </div>
                        </div>

                        <div className="border-y border-dashed border-zinc-300 py-2 space-y-1">
                            {receipt.lineItems.map((line, idx) => (
                                <div key={idx} className="flex justify-between gap-2">
                                    <span>
                                        {line.quantity}x {line.name}
                                        {line.share ? ` [${line.share}]` : ''}
                                    </span>
                                    <span>{formatCents(line.amount_cents)}</span>
                                </div>
                            ))}
                        </div>

                        <div className="space-y-1">
                            <div className="flex justify-between">
                                <span>Subtotal</span>
                                <span>{formatCents(receipt.subtotalCents)}</span>
                            </div>
                            {receipt.discountCents > 0 && (
                                <div className="flex justify-between">
                                    <span>Discount</span>
                                    <span>-{formatCents(receipt.discountCents)}</span>
                                </div>
                            )}
                            <div className="flex justify-between">
                                <span>Service Charge</span>
                                <span>{formatCents(receipt.serviceChargeCents)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Tax</span>
                                <span>{formatCents(receipt.taxCents)}</span>
                            </div>
                            {receipt.tipCents > 0 && (
                                <div className="flex justify-between">
                                    <span>Tip</span>
                                    <span>{formatCents(receipt.tipCents)}</span>
                                </div>
                            )}
                            <div className="flex justify-between border-t border-zinc-300 pt-1 text-sm font-bold">
                                <span>TOTAL PAID</span>
                                <span>{formatCents(receipt.totalCents + receipt.tipCents)}</span>
                            </div>
                        </div>

                        {receipt.payments.length > 0 && (
                            <div className="border-t border-dashed border-zinc-300 pt-2 space-y-0.5 text-[11px] text-zinc-600">
                                {receipt.payments.map((p) => (
                                    <div key={p.id} className="flex justify-between">
                                        <span>{p.tender_method.toUpperCase()} ({p.state})</span>
                                        <span>{formatCents(p.amount_cents)}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="pt-2 text-center text-[10px] text-zinc-500">
                            Thank you for dining with Aurelia!
                        </div>
                    </div>
                )}

                <div className="mt-4 flex justify-end gap-2 print:hidden">
                    <Button type="button" variant="outline" onClick={onClose}>
                        Close
                    </Button>
                    <Button type="button" onClick={() => window.print()}>
                        <Printer className="h-4 w-4" /> Print Receipt
                    </Button>
                </div>
            </div>
        </div>
    );
}
