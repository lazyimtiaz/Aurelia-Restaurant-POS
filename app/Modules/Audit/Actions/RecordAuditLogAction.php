<?php

declare(strict_types=1);

namespace App\Modules\Audit\Actions;

use App\Modules\Audit\Events\CriticalAuditLogged;
use App\Modules\Audit\Models\AuditLog;

final class RecordAuditLogAction
{
    /**
     * @param  array<string, mixed>  $payload
     */
    public function execute(
        int $branchId,
        int $actorUserId,
        ?int $approverUserId,
        string $eventType,
        string $auditableType,
        int|string $auditableId,
        array $payload = [],
        bool $isCritical = false,
    ): AuditLog {
        $auditLog = AuditLog::create([
            'branch_id' => $branchId,
            'actor_user_id' => $actorUserId,
            'approver_user_id' => $approverUserId,
            'event_type' => $eventType,
            'auditable_type' => $auditableType,
            'auditable_id' => (string) $auditableId,
            'payload' => $payload,
            'is_critical' => $isCritical,
        ]);

        if ($isCritical) {
            CriticalAuditLogged::dispatch(
                auditLogId: $auditLog->id,
                branchId: $branchId,
                eventType: $eventType,
                actorUserId: $actorUserId,
                approverUserId: $approverUserId,
                payload: $payload,
            );
        }

        return $auditLog;
    }
}
