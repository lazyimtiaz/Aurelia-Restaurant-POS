<?php

declare(strict_types=1);

namespace App\Modules\Inventory\Jobs;

use App\Modules\Inventory\Actions\DeductRecipeIngredientsAction;
use App\Modules\Inventory\Enums\StockMovementType;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

final class DeductOrderInventoryJob implements ShouldDispatchAfterCommit, ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    /**
     * @param  array<int, int>  $variantQuantities
     */
    public function __construct(
        public readonly int $branchId,
        public readonly string $referenceType,
        public readonly int $referenceId,
        public readonly array $variantQuantities,
        public readonly StockMovementType $movementType,
        public readonly int $actorUserId,
        public readonly bool $forceLowStockSimulation = false,
    ) {
        $this->onQueue('inventory');
        $this->afterCommit();
    }

    public function handle(?DeductRecipeIngredientsAction $deductAction = null): void
    {
        ($deductAction ?? app(DeductRecipeIngredientsAction::class))->execute(
            branchId: $this->branchId,
            referenceType: $this->referenceType,
            referenceId: $this->referenceId,
            variantQuantities: $this->variantQuantities,
            movementType: $this->movementType,
            actorUserId: $this->actorUserId,
            forceLowStockSimulation: $this->forceLowStockSimulation,
        );
    }
}
