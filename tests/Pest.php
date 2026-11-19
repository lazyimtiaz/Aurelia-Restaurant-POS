<?php

use App\Models\User;
use App\Modules\Identity\Enums\StaffRole;
use App\Modules\Restaurant\Models\Branch;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

pest()->extend(TestCase::class)
    ->use(RefreshDatabase::class)
    ->in('Feature');

pest()->extend(TestCase::class)
    ->in('Unit');

function signInAndUnlockAs(
    TestCase $test,
    StaffRole $role,
    string $pin,
    string $branchCode = 'DTF',
): User {
    $branch = Branch::query()->where('code', $branchCode)->firstOrFail();

    $test->post('/login', [
        'email' => 'owner@aurelia.test',
        'password' => 'password',
        'branch_id' => $branch->id,
    ])->assertRedirect('/lock');

    $user = $role === StaffRole::RestaurantOwner || $role === StaffRole::EnterpriseSystemAdmin
        ? User::query()->where('role', $role->value)->firstOrFail()
        : User::query()->where('branch_id', $branch->id)->where('role', $role->value)->firstOrFail();

    $test->post('/lock/unlock', [
        'user_id' => $user->id,
        'pin' => $pin,
    ])->assertRedirect($role->homeRoute());

    return $user;
}
