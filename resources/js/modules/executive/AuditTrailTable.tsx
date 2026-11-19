import { useEffect, useRef, useState } from 'react';
import { Filter, ShieldAlert, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusPill } from '@/design-system';
import type { AuditLogRowData } from '@/types/executive';

interface AuditTrailTableProps {
    initialLogs: AuditLogRowData[];
    eventTypes: string[];
    branchId: number | null;
}

export function AuditTrailTable({ initialLogs, eventTypes, branchId }: AuditTrailTableProps) {
    const [logs, setLogs] = useState<AuditLogRowData[]>(initialLogs);
    const [selectedEventType, setSelectedEventType] = useState('');
    const [criticalOnly, setCriticalOnly] = useState(false);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);
    const [expandedId, setExpandedId] = useState<number | null>(null);
    const abortRef = useRef<AbortController | null>(null);

    useEffect(() => {
        setLogs(initialLogs);
    }, [initialLogs]);

    useEffect(() => {
        return () => abortRef.current?.abort();
    }, []);

    const applyFilters = async (
        nextEventType: string,
        nextCritical: boolean,
        nextSearch: string,
    ) => {
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;
        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.set('branch_id', branchId === null ? 'all' : String(branchId));
            if (nextEventType) params.set('event_type', nextEventType);
            if (nextCritical) params.set('critical_only', '1');
            if (nextSearch.trim()) params.set('search', nextSearch.trim());

            const response = await fetch(`/audit-logs?${params.toString()}`, {
                headers: { Accept: 'application/json' },
                signal: controller.signal,
            });
            if (response.ok) {
                const payload = (await response.json()) as { logs: AuditLogRowData[] };
                setLogs(payload.logs);
            }
        } catch (err) {
            if (err instanceof DOMException && err.name === 'AbortError') return;
            throw err;
        } finally {
            if (abortRef.current === controller) {
                setLoading(false);
            }
        }
    };

    return (
        <Card>
            <CardHeader className="border-b border-border/60 bg-[var(--surface-inset)]/60">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                    <div className="min-w-0">
                        <CardTitle className="flex items-center gap-2">
                            <ShieldCheck className="h-4 w-4 text-primary" />
                            <span>Immutable Governance &amp; Loss-Prevention Audit Trail</span>
                        </CardTitle>
                        <CardDescription>
                            Inspect Manager PIN overrides, refunds, kitchen voids, 86 toggles, wastage, and variance approvals.
                        </CardDescription>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                        <div className="flex h-9 items-center gap-1.5 rounded-xl border border-input bg-card px-3">
                            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                            <select
                                aria-label="Filter by audit event type"
                                value={selectedEventType}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setSelectedEventType(val);
                                    void applyFilters(val, criticalOnly, search);
                                }}
                                className="bg-transparent text-xs font-medium focus:outline-none"
                            >
                                <option value="">All Event Types</option>
                                {eventTypes.map((type) => (
                                    <option key={type} value={type}>
                                        {type}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <input
                            type="search"
                            placeholder="Search event or entity..."
                            value={search}
                            onChange={(e) => {
                                const val = e.target.value;
                                setSearch(val);
                                void applyFilters(selectedEventType, criticalOnly, val);
                            }}
                            className="h-9 rounded-xl border border-input bg-card px-3 text-xs focus:border-primary focus:outline-none"
                        />

                        <label className="flex h-9 items-center gap-1.5 rounded-xl border border-input bg-card px-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={criticalOnly}
                                onChange={(e) => {
                                    const next = e.target.checked;
                                    setCriticalOnly(next);
                                    void applyFilters(selectedEventType, next, search);
                                }}
                                className="accent-[#E11D48]"
                            />
                            <ShieldAlert className="h-3.5 w-3.5 text-rose-500" />
                            <span className="font-medium">Critical Only</span>
                        </label>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-0 sm:p-6">
                {loading && (
                    <p className="px-5 pt-3 text-xs text-muted-foreground sm:px-0">
                        Refreshing audit records...
                    </p>
                )}

                {logs.length === 0 ? (
                    <p className="py-10 text-center text-sm text-muted-foreground">
                        No audit trail entries match the active filters.
                    </p>
                ) : (
                    <div className="overflow-x-auto px-4 py-3 sm:p-0">
                        <table className="w-full min-w-[700px] border-collapse text-left text-xs">
                            <thead>
                                <tr className="border-b border-border font-semibold uppercase tracking-wider text-muted-foreground">
                                    <th className="py-3 pr-3">Event</th>
                                    <th className="py-3 pr-3">Branch</th>
                                    <th className="py-3 pr-3">Entity</th>
                                    <th className="py-3 pr-3">Actor</th>
                                    <th className="py-3 pr-3">Approver (PIN)</th>
                                    <th className="py-3 text-right">Payload</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/70">
                                {logs.map((log) => {
                                    const isExpanded = expandedId === log.id;
                                    return (
                                        <tr key={log.id} className="align-top">
                                            <td className="py-3 pr-3">
                                                <StatusPill
                                                    tone={log.is_critical ? 'danger' : 'neutral'}
                                                    dot={log.is_critical}
                                                    label={log.event_type}
                                                />
                                                <div className="mt-1 font-mono text-[10px] text-muted-foreground">
                                                    {log.created_at_iso ?? '—'}
                                                </div>
                                            </td>
                                            <td className="py-3 pr-3 font-mono font-semibold">
                                                {log.branch_code}
                                            </td>
                                            <td className="py-3 pr-3 font-mono text-muted-foreground">
                                                {log.auditable_type}#{log.auditable_id}
                                            </td>
                                            <td className="py-3 pr-3">
                                                <div className="font-semibold text-foreground">
                                                    {log.actor_name}
                                                </div>
                                                <div className="text-[11px] text-muted-foreground">
                                                    {log.actor_role}
                                                </div>
                                            </td>
                                            <td className="py-3 pr-3">
                                                {log.approver_name ?? (
                                                    <span className="text-muted-foreground">—</span>
                                                )}
                                            </td>
                                            <td className="py-3 text-right">
                                                <button
                                                    type="button"
                                                    onClick={() => setExpandedId(isExpanded ? null : log.id)}
                                                    className="font-mono text-[11px] font-semibold text-primary hover:underline cursor-pointer"
                                                >
                                                    {isExpanded ? 'Hide JSON' : 'Inspect JSON'}
                                                </button>
                                                {isExpanded && (
                                                    <pre className="mt-2 max-w-md overflow-x-auto rounded-xl border border-border bg-[var(--surface-inset)] p-3 text-left font-mono text-[11px]">
                                                        {JSON.stringify(log.payload, null, 2)}
                                                    </pre>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
