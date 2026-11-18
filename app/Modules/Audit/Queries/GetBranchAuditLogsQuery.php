<?php

declare(strict_types=1);

namespace App\Modules\Audit\Queries;

use App\Modules\Audit\Models\AuditLog;

final class GetBranchAuditLogsQuery
{
    /**
     * @return array{logs: list<array<string, mixed>>, eventTypes: list<string>}
     */
    public function execute(
        ?int $branchId = null,
        ?string $eventType = null,
        bool $criticalOnly = false,
        ?string $search = null,
        int $limit = 60,
    ): array {
        $trimmedEvent = $eventType !== null && trim($eventType) !== '' ? trim($eventType) : null;
        $trimmedSearch = $search !== null && trim($search) !== '' ? trim($search) : null;

        $logs = AuditLog::query()
            ->with(['branch', 'actor', 'approver'])
            ->when($branchId !== null, fn ($q) => $q->where('branch_id', $branchId))
            ->when($trimmedEvent !== null, fn ($q) => $q->where('event_type', $trimmedEvent))
            ->when($criticalOnly, fn ($q) => $q->where('is_critical', true))
            ->when($trimmedSearch !== null, function ($q) use ($trimmedSearch): void {
                $like = '%'.$trimmedSearch.'%';
                $q->where(function ($nested) use ($like): void {
                    $nested->where('event_type', 'like', $like)
                        ->orWhere('auditable_type', 'like', $like)
                        ->orWhere('auditable_id', 'like', $like);
                });
            })
            ->latest('id')
            ->limit(max(1, min($limit, 200)))
            ->get()
            ->map(static fn (AuditLog $log): array => [
                'id' => $log->id,
                'branch_id' => $log->branch_id,
                'branch_code' => $log->branch?->code ?? 'ENT',
                'branch_name' => $log->branch?->name ?? 'Branch',
                'event_type' => $log->event_type,
                'auditable_type' => class_basename($log->auditable_type),
                'auditable_id' => $log->auditable_id,
                'actor_name' => $log->actor?->name ?? 'Staff',
                'actor_role' => $log->actor?->role?->label() ?? '',
                'approver_name' => $log->approver?->name,
                'is_critical' => $log->is_critical,
                'payload' => $log->payload ?? [],
                'created_at_iso' => $log->created_at?->toIso8601String(),
            ])
            ->values()
            ->all();

        $eventTypes = AuditLog::query()
            ->when($branchId !== null, fn ($q) => $q->where('branch_id', $branchId))
            ->distinct()
            ->orderBy('event_type')
            ->pluck('event_type')
            ->map(static fn (mixed $value): string => (string) $value)
            ->values()
            ->all();

        return [
            'logs' => $logs,
            'eventTypes' => $eventTypes,
        ];
    }
}
