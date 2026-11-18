<?php

declare(strict_types=1);

use App\Models\User;
use App\Modules\Audit\Events\CriticalAuditLogged;
use App\Modules\Audit\Models\AuditLog;
use App\Modules\Identity\Actions\VerifyManagerPinAction;
use App\Modules\Identity\Enums\StaffRole;
use App\Modules\Identity\Exceptions\InvalidManagerPinException;
use App\Modules\Restaurant\Models\Branch;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Hash;

it('verifies a valid 4-digit manager PIN for the same branch, writes an audit log, and broadcasts CriticalAuditLogged after commit', function (): void {
    Event::fake([CriticalAuditLogged::class]);

    $branch = Branch::create(['code' => 'DTF', 'name' => 'Downtown Flagship']);

    $manager = User::factory()->create([
        'branch_id' => $branch->id,
        'role' => StaffRole::BranchManager,
        'pin_hash' => Hash::make('1234'),
    ]);

    $cashier = User::factory()->create([
        'branch_id' => $branch->id,
        'role' => StaffRole::Cashier,
    ]);

    $approver = app(VerifyManagerPinAction::class)->execute(
        branchId: $branch->id,
        pin: '1234',
        actorUserId: $cashier->id,
        actionType: 'high_discount',
        context: ['discount_bps' => 2000],
    );

    expect($approver->id)->toBe($manager->id);

    $audit = AuditLog::query()->where('event_type', 'manager_pin_verified')->first();

    expect($audit)->not->toBeNull()
        ->and($audit->branch_id)->toBe($branch->id)
        ->and($audit->actor_user_id)->toBe($cashier->id)
        ->and($audit->approver_user_id)->toBe($manager->id)
        ->and($audit->is_critical)->toBeTrue();

    Event::assertDispatched(CriticalAuditLogged::class, function (CriticalAuditLogged $event) use ($branch): bool {
        return $event->branchId === $branch->id
            && $event->eventType === 'manager_pin_verified';
    });
});

it('rejects a valid manager PIN belonging to a different branch', function (): void {
    $branch1 = Branch::create(['code' => 'DTF', 'name' => 'Downtown Flagship']);
    $branch2 = Branch::create(['code' => 'WFP', 'name' => 'Waterfront Patio']);

    User::factory()->create([
        'branch_id' => $branch2->id,
        'role' => StaffRole::BranchManager,
        'pin_hash' => Hash::make('9999'),
    ]);

    $cashier = User::factory()->create([
        'branch_id' => $branch1->id,
        'role' => StaffRole::Cashier,
    ]);

    expect(fn () => app(VerifyManagerPinAction::class)->execute(
        branchId: $branch1->id,
        pin: '9999',
        actorUserId: $cashier->id,
        actionType: 'post_fire_void',
    ))->toThrow(InvalidManagerPinException::class);
});

it('rejects a PIN belonging to a non-manager role and invalid PIN formats', function (): void {
    $branch = Branch::create(['code' => 'DTF', 'name' => 'Downtown Flagship']);

    $cashier = User::factory()->create([
        'branch_id' => $branch->id,
        'role' => StaffRole::Cashier,
        'pin_hash' => Hash::make('4321'),
    ]);

    expect(fn () => app(VerifyManagerPinAction::class)->execute(
        branchId: $branch->id,
        pin: '4321',
        actorUserId: $cashier->id,
        actionType: 'refund',
    ))->toThrow(InvalidManagerPinException::class);

    expect(fn () => app(VerifyManagerPinAction::class)->execute(
        branchId: $branch->id,
        pin: '12ab',
        actorUserId: $cashier->id,
        actionType: 'refund',
    ))->toThrow(InvalidManagerPinException::class);
});

it('allows a corporate owner (branch_id = null) PIN across branches', function (): void {
    $branch = Branch::create(['code' => 'APX', 'name' => 'Airport Express']);

    $owner = User::factory()->create([
        'branch_id' => null,
        'role' => StaffRole::RestaurantOwner,
        'pin_hash' => Hash::make('7777'),
    ]);

    $cashier = User::factory()->create([
        'branch_id' => $branch->id,
        'role' => StaffRole::Cashier,
    ]);

    $approver = app(VerifyManagerPinAction::class)->execute(
        branchId: $branch->id,
        pin: '7777',
        actorUserId: $cashier->id,
        actionType: 'refund',
    );

    expect($approver->id)->toBe($owner->id);
});
