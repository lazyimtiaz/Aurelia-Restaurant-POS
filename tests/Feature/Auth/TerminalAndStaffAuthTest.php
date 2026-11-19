<?php

declare(strict_types=1);

use App\Models\User;
use App\Modules\Audit\Models\AuditLog;
use App\Modules\Identity\Enums\StaffRole;
use App\Modules\Restaurant\Models\Branch;
use Carbon\Carbon;
use Database\Seeders\AureliaEnterpriseSeeder;

it('redirects unauthenticated requests to /login and signed-in-only terminal requests to /lock', function (): void {
    $this->seed(AureliaEnterpriseSeeder::class);

    $this->get('/')->assertRedirect('/login');
    $this->get('/pos')->assertRedirect('/login');
    $this->get('/lock')->assertRedirect('/login');

    $this->post('/login', [
        'email' => 'branch_manager.dtf@aurelia.test',
        'password' => 'password',
    ])->assertRedirect('/lock');

    $this->get('/')->assertRedirect('/lock');
    $this->get('/pos')->assertRedirect('/lock');
    $this->get('/lock')->assertOk();
});

it('allows managers/owners to sign in terminal while blocking non-managers and binds terminal branch', function (): void {
    $this->seed(AureliaEnterpriseSeeder::class);

    // Non-manager blocked from signing in terminal
    $this->from('/login')
        ->post('/login', [
            'email' => 'cashier.dtf@aurelia.test',
            'password' => 'password',
        ])
        ->assertRedirect('/login')
        ->assertSessionHasErrors('email');

    // Owner signs in and picks WFP branch
    $wfp = Branch::query()->where('code', 'WFP')->firstOrFail();

    $this->post('/login', [
        'email' => 'owner@aurelia.test',
        'password' => 'password',
        'branch_id' => $wfp->id,
    ])->assertRedirect('/lock');

    expect(session('terminal_branch_id'))->toBe($wfp->id);
});

it('unlocks branch staff by PIN, redirects to role home, rejects wrong-branch staff, and rate-limits 5 failures', function (): void {
    $this->seed(AureliaEnterpriseSeeder::class);

    $this->post('/login', [
        'email' => 'branch_manager.dtf@aurelia.test',
        'password' => 'password',
    ])->assertRedirect('/lock');

    $dtfCashier = User::query()->where('email', 'cashier.dtf@aurelia.test')->firstOrFail();
    $wfpCashier = User::query()->where('email', 'cashier.wfp@aurelia.test')->firstOrFail();
    $dtfChef = User::query()->where('email', 'chef.dtf@aurelia.test')->firstOrFail();

    // Cross-branch staff cannot unlock on DTF terminal
    $this->from('/lock')
        ->post('/lock/unlock', [
            'user_id' => $wfpCashier->id,
            'pin' => '1111',
        ])
        ->assertRedirect('/lock')
        ->assertSessionHasErrors('pin');

    // 5 failed attempts trigger throttling + critical audit log
    for ($i = 0; $i < 5; $i++) {
        $this->from('/lock')->post('/lock/unlock', [
            'user_id' => $dtfCashier->id,
            'pin' => '9999',
        ])->assertSessionHasErrors('pin');
    }

    // 6th attempt even with valid PIN is locked out
    $this->from('/lock')
        ->post('/lock/unlock', [
            'user_id' => $dtfCashier->id,
            'pin' => '1111',
        ])
        ->assertSessionHasErrors('pin');

    expect(AuditLog::query()->where('event_type', 'staff_pin_failed')->count())->toBeGreaterThanOrEqual(5);

    // Another staff member (Chef) at same terminal unlocks cleanly to /kitchen
    $this->post('/lock/unlock', [
        'user_id' => $dtfChef->id,
        'pin' => '3333',
    ])->assertRedirect('/kitchen');

    // Lock returns cleanly to /lock
    $this->post('/lock')->assertRedirect('/lock');
    $this->get('/kitchen')->assertRedirect('/lock');
});

it('auto-locks staff after idle timeout and gates active branch switching to Owner/Admin', function (): void {
    $this->seed(AureliaEnterpriseSeeder::class);

    $dtf = Branch::query()->where('code', 'DTF')->firstOrFail();
    $wfp = Branch::query()->where('code', 'WFP')->firstOrFail();

    $owner = User::query()->where('role', StaffRole::RestaurantOwner->value)->firstOrFail();
    $managerDtf = User::query()->where('email', 'branch_manager.dtf@aurelia.test')->firstOrFail();

    // Sign in DTF terminal and unlock as Branch Manager
    $this->post('/login', [
        'email' => 'branch_manager.dtf@aurelia.test',
        'password' => 'password',
    ])->assertRedirect('/lock');

    $this->post('/lock/unlock', [
        'user_id' => $managerDtf->id,
        'pin' => '1234',
    ])->assertRedirect('/dashboard');

    // Branch Manager cannot switch active branch via top-bar dropdown
    $this->post('/branch/switch', ['branch_id' => $wfp->id])->assertForbidden();

    // Advance clock past idle timeout -> auto-locked back to /lock
    Carbon::setTestNow(now()->addMinutes(config('pos.idle_lock_minutes') + 1));
    $this->get('/dashboard')->assertRedirect('/lock');
    Carbon::setTestNow();

    // Owner unlocks on DTF terminal and switches active branch to WFP
    $this->post('/lock/unlock', [
        'user_id' => $owner->id,
        'pin' => '1234',
    ])->assertRedirect('/dashboard');

    $this->post('/branch/switch', ['branch_id' => $wfp->id])->assertRedirect();
    expect(session('active_branch_id'))->toBe($wfp->id);

    // Non-manager cannot sign out terminal; Owner can
    $cashierDtf = User::query()->where('email', 'cashier.dtf@aurelia.test')->firstOrFail();
    $this->post('/lock')->assertRedirect('/lock');
    $this->post('/lock/unlock', ['user_id' => $cashierDtf->id, 'pin' => '1111'])->assertRedirect('/pos');
    $this->post('/terminal/sign-out')->assertForbidden();

    // Sign out from lock screen with valid manager PIN
    $this->post('/lock')->assertRedirect('/lock');
    $this->post('/terminal/sign-out', ['manager_pin' => '1234'])->assertRedirect('/login');
    expect(session('terminal_branch_id'))->toBeNull();
});
