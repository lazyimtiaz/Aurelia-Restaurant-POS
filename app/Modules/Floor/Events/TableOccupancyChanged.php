<?php

declare(strict_types=1);

namespace App\Modules\Floor\Events;

use App\Modules\Floor\Enums\TableState;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

final class TableOccupancyChanged implements ShouldBroadcastNow, ShouldDispatchAfterCommit
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public readonly int $branchId,
        public readonly int $tableId,
        public readonly string $tableCode,
        public readonly TableState $state,
        public readonly int $guestCount,
    ) {}

    /**
     * @return array<int, PrivateChannel>
     */
    public function broadcastOn(): array
    {
        return [
            new PrivateChannel("branch.{$this->branchId}.floor"),
            new PrivateChannel("branch.{$this->branchId}.pos"),
        ];
    }

    public function broadcastAs(): string
    {
        return 'TableOccupancyChanged';
    }
}
