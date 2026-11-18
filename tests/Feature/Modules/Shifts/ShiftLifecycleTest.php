<?php

declare(strict_types=1);

use App\Http\Middleware\RequireOpenShiftMiddleware;
use App\Models\User;
use App\Modules\Identity\Enums\StaffRole;
use App\Modules\Identity\Exceptions\InvalidManagerPinException;
use App\Modules\Restaurant\Models\Branch;
use App\Modules\Shifts\Actions\ApproveShiftVarianceAction;
use App\Modules\Shifts\Actions\CloseShiftAction;
use App\Modules\Shifts\Actions\OpenShiftAction;
use App\Modules\Shifts\Actions\RecordCashMovementAction;
use App\Modules\Shifts\Enums\CashMovementType;
use App\Modules\Shifts\Enums\ShiftState;
use App\Modules\Shifts\Events\ShiftVarianceFlagged;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Hash;

it('prevents duplicate open shifts for the same staff member at a branch and rejects negative opening cash', function (): void {
    $branch = Branch::create(['code' => 'DTF', 'name' => 'Downtown Flagship']);
    $cashier = User::factory()->create(['branch_id' => $branch->id, 'role' => StaffRole::Cashier]);

    $openShiftAction = app(OpenShiftAction::class);

    expect(fn () => $openShiftAction->execute($branch->id, $cashier->id, -100))
        ->toThrow(InvalidArgumentException::class);

    $shift = $openShiftAction->execute($branch->id, $cashier->id, 20000);

    expect($shift->state)->toBe(ShiftState::Open)
        ->and($shift->expected_cash_cents)->toBe(20000);

    expect(fn () => $openShiftAction->execute($branch->id, $cashier->id, 10000))
        ->toThrow(DomainException::class);
});

it('flags shift variance when blind cash count exceeds branch tolerance and closes cleanly when within tolerance', function (): void {
    Event::fake([ShiftVarianceFlagged::class]);

    $branch = Branch::create([
        'code' => 'DTF',
        'name' => 'Downtown Flagship',
        'cash_variance_tolerance_cents' => 500,
    ]);
    $cashier1 = User::factory()->create(['branch_id' => $branch->id, 'role' => StaffRole::Cashier]);
    $cashier2 = User::factory()->create(['branch_id' => $branch->id, 'role' => StaffRole::Cashier]);

    $shift1 = app(OpenShiftAction::class)->execute($branch->id, $cashier1->id, 20000);
    app(RecordCashMovementAction::class)->execute($shift1->id, CashMovementType::CashSale, 5000, 'ORDER-101');
    app(RecordCashMovementAction::class)->execute($shift1->id, CashMovementType::CashRefund, 0 + 1000, 'REFUND-101'); // expected = 24000
    // Wait: adjust expectation explicitly: 20000 + 5000 - 1000 = 24000, counted 22900 -> variance -1100 (|-1100| > 500)
    $closedFlagged = app(CloseShiftAction::class)->execute($shift1->id, 22900, 'Missing $11 bill');

    expect($closedFlagged->state)->toBe(ShiftState::VarianceFlagged)
        ->and($closedFlagged->expected_cash_cents)->toBe(24000)
        ->and($closedFlagged->counted_cash_cents)->toBe(22900)
        ->and($closedFlagged->variance_cents)->toBe(-1100);

    Event::assertDispatched(ShiftVarianceFlagged::class, function (ShiftVarianceFlagged $event) use ($branch, $shift1): bool {
        return $event->branchId === $branch->id
            && $event->shiftId === $shift1->id
            && $event->varianceCents === -1100;
    });

    $shift2 = app(OpenShiftAction::class)->execute($branch->id, $cashier2->id, 20000);
    app(RecordCashMovementAction::class)->execute($shift2->id, CashMovementType::CashSale, 5000, 'ORDER-102'); // expected = 25000
    $closedClean = app(CloseShiftAction::class)->execute($shift2->id, 24700); // variance = -300, |-300| <= 500

    expect($closedClean->state)->toBe(ShiftState::Closed)
        ->and($closedClean->variance_cents)->toBe(-300);
});

it('requires a valid manager PIN to approve and close a variance-flagged shift', function (): void {
    $branch = Branch::create(['code' => 'DTF', 'name' => 'Downtown Flagship', 'cash_variance_tolerance_cents' => 500]);
    $manager = User::factory()->create([
        'branch_id' => $branch->id,
        'role' => StaffRole::BranchManager,
        'pin_hash' => Hash::make('1234'),
    ]);
    $cashier = User::factory()->create(['branch_id' => $branch->id, 'role' => StaffRole::Cashier]);

    $shift = app(OpenShiftAction::class)->execute($branch->id, $cashier->id, 20000);
    $flagged = app(CloseShiftAction::class)->execute($shift->id, 18000); // -2000 variance

    expect($flagged->state)->toBe(ShiftState::VarianceFlagged);

    expect(fn () => app(ApproveShiftVarianceAction::class)->execute($flagged->id, '0000', $cashier->id, 'Invalid'))
        ->toThrow(InvalidManagerPinException::class);

    $resolved = app(ApproveShiftVarianceAction::class)->execute($flagged->id, '1234', $cashier->id, 'Verified safe drop');

    expect($resolved->state)->toBe(ShiftState::Closed)
        ->and($resolved->approved_by_user_id)->toBe($manager->id)
        ->and($resolved->resolution_note)->toBe('Verified safe drop');
});

it('blocks requests via RequireOpenShiftMiddleware when user has no active open shift', function (): void {
    $branch = Branch::create(['code' => 'DTF', 'name' => 'Downtown Flagship']);
    $cashier = User::factory()->create(['branch_id' => $branch->id, 'role' => StaffRole::Cashier]);

    $middleware = app(RequireOpenShiftMiddleware::class);
    $request = Request::create('/pos/orders', 'POST', [], [], [], ['HTTP_ACCEPT' => 'application/json']);
    $request->setUserResolver(fn () => $cashier);

    $response = $middleware->handle($request, fn () => new Response('OK', 200));
    expect($response->getStatusCode())->toBe(409);

    app(OpenShiftAction::class)->execute($branch->id, $cashier->id, 15000);

    $allowed = $middleware->handle($request, fn () => new Response('OK', 200));
    expect($allowed->getStatusCode())->toBe(200);
});
