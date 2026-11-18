<?php

declare(strict_types=1);

namespace App\Modules\Menu\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

final class ItemAvailabilityChanged implements ShouldBroadcastNow, ShouldDispatchAfterCommit
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public readonly int $branchId,
        public readonly int $variantId,
        public readonly bool $isAvailable,
        public readonly ?string $reason,
    ) {}

    /**
     * @return array<int, PrivateChannel>
     */
    public function broadcastOn(): array
    {
        return [
            new PrivateChannel("branch.{$this->branchId}.pos"),
            new PrivateChannel("branch.{$this->branchId}.manager"),
        ];
    }

    public function broadcastAs(): string
    {
        return 'ItemAvailabilityChanged';
    }
}
