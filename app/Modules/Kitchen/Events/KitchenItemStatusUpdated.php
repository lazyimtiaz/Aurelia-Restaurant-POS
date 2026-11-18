<?php

declare(strict_types=1);

namespace App\Modules\Kitchen\Events;

use App\Modules\Kitchen\Enums\ItemPrepState;
use App\Modules\Kitchen\Enums\TicketState;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

final class KitchenItemStatusUpdated implements ShouldBroadcastNow, ShouldDispatchAfterCommit
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public readonly int $branchId,
        public readonly int $kitchenTicketId,
        public readonly int $orderItemId,
        public readonly ItemPrepState $itemState,
        public readonly TicketState $ticketState,
    ) {}

    /**
     * @return array<int, PrivateChannel>
     */
    public function broadcastOn(): array
    {
        return [
            new PrivateChannel("branch.{$this->branchId}.kds"),
        ];
    }

    public function broadcastAs(): string
    {
        return 'KitchenItemStatusUpdated';
    }
}
