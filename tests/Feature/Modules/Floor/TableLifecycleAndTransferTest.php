<?php

declare(strict_types=1);

use App\Models\User;
use App\Modules\Floor\Actions\RequestTableServiceAction;
use App\Modules\Floor\Actions\UpdateTableStateAction;
use App\Modules\Floor\Enums\TableState;
use App\Modules\Floor\Events\ServiceRequested;
use App\Modules\Floor\Events\TableOccupancyChanged;
use App\Modules\Floor\Exceptions\TableNotAvailableException;
use App\Modules\Floor\Models\DiningTable;
use App\Modules\Floor\Models\FloorZone;
use App\Modules\Identity\Enums\StaffRole;
use App\Modules\Restaurant\Models\Branch;
use Illuminate\Support\Facades\Event;

it('rejects occupying an already occupied table under pessimistic locking and broadcasts occupancy updates', function (): void {
    Event::fake([TableOccupancyChanged::class]);

    $branch = Branch::create(['code' => 'DTF', 'name' => 'Downtown Flagship']);
    $zone = FloorZone::create(['branch_id' => $branch->id, 'name' => 'Main Dining', 'sort_order' => 1]);
    $table = DiningTable::create([
        'branch_id' => $branch->id,
        'floor_zone_id' => $zone->id,
        'code' => 'T1',
        'capacity' => 4,
        'state' => TableState::Available,
    ]);

    $occupied = app(UpdateTableStateAction::class)->execute($table->id, TableState::Occupied, guestCount: 3);

    expect($occupied->state)->toBe(TableState::Occupied)
        ->and($occupied->current_guest_count)->toBe(3);

    Event::assertDispatched(TableOccupancyChanged::class, function (TableOccupancyChanged $event) use ($branch, $table): bool {
        return $event->branchId === $branch->id
            && $event->tableId === $table->id
            && $event->state === TableState::Occupied;
    });

    expect(fn () => app(UpdateTableStateAction::class)->execute($table->id, TableState::Occupied, guestCount: 2))
        ->toThrow(TableNotAvailableException::class);
});

it('transitions dining tables cleanly through billing, dirty, and available states and dispatches ServiceRequested', function (): void {
    Event::fake([ServiceRequested::class, TableOccupancyChanged::class]);

    $branch = Branch::create(['code' => 'DTF', 'name' => 'Downtown Flagship']);
    $zone = FloorZone::create(['branch_id' => $branch->id, 'name' => 'Patio', 'sort_order' => 2]);
    $waiter = User::factory()->create(['branch_id' => $branch->id, 'role' => StaffRole::Waiter]);
    $table = DiningTable::create([
        'branch_id' => $branch->id,
        'floor_zone_id' => $zone->id,
        'code' => 'P1',
        'capacity' => 2,
        'state' => TableState::Reserved,
    ]);

    $update = app(UpdateTableStateAction::class);

    $occupied = $update->execute($table->id, TableState::Occupied, guestCount: 2);
    expect($occupied->state)->toBe(TableState::Occupied);

    app(RequestTableServiceAction::class)->execute($table->id, 'water_refill', $waiter->id);
    Event::assertDispatched(ServiceRequested::class, function (ServiceRequested $event) use ($branch, $table): bool {
        return $event->branchId === $branch->id
            && $event->tableId === $table->id
            && $event->requestType === 'water_refill';
    });

    $dirty = $update->execute($table->id, TableState::Dirty);
    expect($dirty->state)->toBe(TableState::Dirty)
        ->and($dirty->current_guest_count)->toBe(0);

    $clean = $update->execute($table->id, TableState::Available);
    expect($clean->state)->toBe(TableState::Available);
});
