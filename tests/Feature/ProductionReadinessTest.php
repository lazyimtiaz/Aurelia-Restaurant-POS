<?php

declare(strict_types=1);

use App\Modules\Identity\Enums\StaffRole;
use Database\Seeders\AureliaEnterpriseSeeder;

it('responds healthy on /up for Cloud Run and keep-warm scheduler checks', function (): void {
    $this->get('/up')->assertOk();
});

it('trusts reverse proxy headers when generating redirect URLs', function (): void {
    $response = $this->withHeaders([
        'X-Forwarded-Proto' => 'https',
        'X-Forwarded-Host' => 'aurelio-pos.imtiazuddin.tech',
        'X-Forwarded-Port' => '443',
    ])->get('/');

    $response->assertRedirect('https://aurelio-pos.imtiazuddin.tech/login');
});

it('redirects an unlocked staff member from root home route to their role home', function (): void {
    $this->seed(AureliaEnterpriseSeeder::class);

    signInAndUnlockAs($this, StaffRole::Cashier, '1111');

    $this->get('/')->assertRedirect('/pos');
});
