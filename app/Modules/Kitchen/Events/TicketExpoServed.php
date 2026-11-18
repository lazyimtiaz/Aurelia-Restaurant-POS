<?php

declare(strict_types=1);

namespace App\Modules\Kitchen\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

final class TicketExpoServed implements ShouldBroadcastNow, ShouldDispatchAfterCommit
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public readonly int $branchId,
        public readonly int $orderId,
        public readonly int $kitchenTicketId,
        public readonly ?int $tableId,
        public readonly int $roundNumber,
    ) {}

    /**
     * @return array<int, PrivateChannel>
     */
    public function broadcastOn(): array
    {
        return [
            new PrivateChannel("branch.{$this->branchId}.kds"),
            new PrivateChannel("branch.{$this->branchId}.pos"),
            new PrivateChannel("branch.{$this->branchId}.floor"),
        ];
    }

    public function broadcastAs(): string
    {
        return 'TicketExpoServed';
    }
}
