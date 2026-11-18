import { useEffect, useRef, useState } from 'react';
import { Filter, ShieldAlert, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
            if (nextEventType) {
                params.set('event_type', nextEventType);
            }
            if (nextCritical) {
                params.set('critical_only', '1');
            }
            if (nextSearch.trim()) {
                params.set('search', nextSearch.trim());
            }

            const response = await fetch(`/audit-logs?${params.toString()}`, {
                headers: { Accept: 'application/json' },
                signal: controller.signal,
            });
            if (response.ok) {
                const payload = (await response.json()) as { logs: AuditLogRowData[] };
                setLogs(payload.logs);
            }
        } catch (err) {
            if (err instanceof DOMException && err.name === 'AbortError') {
                return;
            }
            throw err;
        } finally {
            if (abortRef.current === controller) {
                setLoading(false);
            }
        }
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <ShieldCheck className="h-4 w-4 text-primary" />
                            Immutable Governance &amp; Loss-Prevention Audit Trail
                        </CardTitle>
                        <CardDescription>
                            Inspect Manager PIN overrides, refunds, kitchen voids, 86 toggles, manual wastage, and cash variance approvals.
                        </CardDescription>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                        <div className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5">
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
                            className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs focus:border-primary focus:outline-none"
                        />

                        <label className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={criticalOnly}
                                onChange={(e) => {
                                    const next = e.target.checked;
                                    setCriticalOnly(next);
                                    void applyFilters(selectedEventType, next, search);
                                }}
                            />
                            <ShieldAlert className="h-3.5 w-3.5 text-rose-500" />
                            <span>Critical Only</span>
                        </label>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {loading && (
                    <p className="mb-2 text-xs text-muted-foreground">Refreshing audit records...</p>
                )}

                {logs.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                        No audit trail entries match the active filters.
                    </p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left text-xs">
                            <thead>
                                <tr className="border-b border-border font-semibold text-muted-foreground uppercase">
                                    <th className="py-2.5 pr-3">Event</th>
                                    <th className="py-2.5 pr-3">Branch</th>
                                    <th className="py-2.5 pr-3">Entity</th>
                                    <th className="py-2.5 pr-3">Actor</th>
                                    <th className="py-2.5 pr-3">Approver (PIN)</th>
                                    <th className="py-2.5 text-right">Payload</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/70">
                                {logs.map((log) => {
                                    const isExpanded = expandedId === log.id;
                                    return (
                                        <tr key={log.id} className="align-top">
                                            <td className="py-2.5 pr-3">
                                                <div className="flex items-center gap-1.5">
                                                    <Badge variant={log.is_critical ? 'destructive' : 'outline'}>
                                                        {log.event_type}
                                                    </Badge>
                                                </div>
                                                <div className="mt-1 font-mono text-[10px] text-muted-foreground">
                                                    {log.created_at_iso ?? '—'}
                                                </div>
                                            </td>
                                            <td className="py-2.5 pr-3 font-mono font-semibold">{log.branch_code}</td>
                                            <td className="py-2.5 pr-3 font-mono text-muted-foreground">
                                                {log.auditable_type}#{log.auditable_id}
                                            </td>
                                            <td className="py-2.5 pr-3">
                                                <div className="font-medium">{log.actor_name}</div>
                                                <div className="text-[11px] text-muted-foreground">{log.actor_role}</div>
                                            </td>
                                            <td className="py-2.5 pr-3">
                                                {log.approver_name ?? <span className="text-muted-foreground">—</span>}
                                            </td>
                                            <td className="py-2.5 text-right">
                                                <button
                                                    type="button"
                                                    onClick={() => setExpandedId(isExpanded ? null : log.id)}
                                                    className="font-mono text-[11px] text-primary hover:underline cursor-pointer"
                                                >
                                                    {isExpanded ? 'Hide JSON' : 'Inspect JSON'}
                                                </button>
                                                {isExpanded && (
                                                    <pre className="mt-2 max-w-md overflow-x-auto rounded-md border border-border bg-muted/50 p-2 text-left font-mono text-[11px]">
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
