<?php

declare(strict_types=1);

namespace App\Modules\Audit\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

final class CriticalAuditLogged implements ShouldBroadcastNow, ShouldDispatchAfterCommit
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    /**
     * @param  array<string, mixed>  $payload
     */
    public function __construct(
        public readonly int $auditLogId,
        public readonly int $branchId,
        public readonly string $eventType,
        public readonly int $actorUserId,
        public readonly ?int $approverUserId,
        public readonly array $payload,
    ) {}

    /**
     * @return array<int, PrivateChannel>
     */
    public function broadcastOn(): array
    {
        return [
            new PrivateChannel("branch.{$this->branchId}.manager"),
        ];
    }

    public function broadcastAs(): string
    {
        return 'CriticalAuditLogged';
    }
}
