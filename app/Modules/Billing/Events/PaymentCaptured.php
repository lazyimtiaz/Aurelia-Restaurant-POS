<?php

declare(strict_types=1);

namespace App\Modules\Billing\Events;

use App\Modules\Billing\Enums\TenderMethod;
use App\Modules\Orders\Enums\OrderState;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

final class PaymentCaptured implements ShouldBroadcastNow, ShouldDispatchAfterCommit
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public readonly int $branchId,
        public readonly int $orderId,
        public readonly int $billSplitId,
        public readonly int $paymentTransactionId,
        public readonly int $amountCents,
        public readonly TenderMethod $tenderMethod,
        public readonly OrderState $orderState,
    ) {}

    /**
     * @return array<int, PrivateChannel>
     */
    public function broadcastOn(): array
    {
        return [
            new PrivateChannel("branch.{$this->branchId}.pos"),
        ];
    }

    public function broadcastAs(): string
    {
        return 'PaymentCaptured';
    }
}
