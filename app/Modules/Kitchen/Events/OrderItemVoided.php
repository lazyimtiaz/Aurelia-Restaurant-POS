<?php

declare(strict_types=1);

namespace App\Modules\Kitchen\Events;

use App\Modules\Kitchen\Enums\VoidReason;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

final class OrderItemVoided implements ShouldBroadcastNow, ShouldDispatchAfterCommit
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public readonly int $branchId,
        public readonly int $orderId,
        public readonly ?int $kitchenTicketId,
        public readonly int $orderItemId,
        public readonly VoidReason $reason,
        public readonly bool $wasInPrepAtVoid,
    ) {}

    /**
     * @return array<int, PrivateChannel>
     */
    public function broadcastOn(): array
    {
        return [
            new PrivateChannel("branch.{$this->branchId}.kds"),
            new PrivateChannel("branch.{$this->branchId}.pos"),
        ];
    }

    public function broadcastAs(): string
    {
        return 'OrderItemVoided';
    }
}
