<?php

declare(strict_types=1);

use App\Modules\Identity\Enums\StaffRole;
use App\Modules\Menu\Events\ItemAvailabilityChanged;
use App\Modules\Menu\Models\BranchMenuOverride;
use App\Modules\Menu\Models\MenuItemVariant;
use Database\Seeders\AureliaEnterpriseSeeder;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Event;
use Inertia\Testing\AssertableInertia as Assert;

it('auto-seeds and authenticates the Downtown Flagship cashier on root visit with zero setup', function (): void {
    $this->withoutVite();

    $response = $this->get('/');

    $response->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('WelcomeDashboard')
            ->has('evaluator.branches', 3)
            ->has('evaluator.roles', 8)
            ->where('evaluator.activeBranch.code', 'DTF')
            ->where('evaluator.activeUser.role', StaffRole::Cashier->value)
            ->where('evaluator.activeShift.state', 'open')
            ->where('evaluator.simulations.simulateCardDecline', false)
            ->where('evaluator.simulations.triggerLowStockAuto86', false)
            ->has('catalog')
        );
});

it('switches authenticated persona across all 8 roles at the active branch', function (): void {
    $this->seed(AureliaEnterpriseSeeder::class);
    $this->withoutVite();

    $this->get('/')->assertOk();

    foreach (StaffRole::cases() as $role) {
        $this->post('/evaluator/switch-role', ['role' => $role->value])
            ->assertRedirect();

        expect(Auth::user()->role)->toBe($role);
    }
});

it('switches active branch and re-binds the corresponding branch staff persona', function (): void {
    $this->seed(AureliaEnterpriseSeeder::class);
    $this->withoutVite();

    $this->get('/')->assertOk();
    $this->post('/evaluator/switch-role', ['role' => StaffRole::BranchManager->value])->assertRedirect();

    $this->post('/evaluator/switch-branch', ['branch_code' => 'WFP'])->assertRedirect();

    $this->get('/')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('evaluator.activeBranch.code', 'WFP')
            ->where('evaluator.activeUser.role', StaffRole::BranchManager->value)
        );

    expect(Auth::user()->branch?->code)->toBe('WFP');
});

it('toggles evaluator failure simulation flags in session', function (): void {
    $this->seed(AureliaEnterpriseSeeder::class);
    $this->withoutVite();

    $this->get('/')->assertOk();

    $this->post('/evaluator/simulations', [
        'simulate_card_decline' => true,
        'trigger_low_stock_auto_86' => true,
    ])->assertRedirect();

    $this->get('/')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('evaluator.simulations.simulateCardDecline', true)
            ->where('evaluator.simulations.triggerLowStockAuto86', true)
        );
});

it('toggles branch 86 item availability from the Phase 1 control center', function (): void {
    Event::fake([ItemAvailabilityChanged::class]);
    $this->seed(AureliaEnterpriseSeeder::class);
    $this->withoutVite();

    $this->get('/')->assertOk();
    $variant = MenuItemVariant::query()->firstOrFail();

    $this->post("/evaluator/catalog/{$variant->id}/toggle-86", [
        'is_available' => false,
        'reason' => 'Sold out during dinner rush',
    ])->assertRedirect();

    $override = BranchMenuOverride::query()
        ->where('menu_item_variant_id', $variant->id)
        ->first();

    expect($override)->not->toBeNull()
        ->and($override->is_available)->toBeFalse()
        ->and($override->eighty_sixed_reason)->toBe('Sold out during dinner rush');

    Event::assertDispatched(ItemAvailabilityChanged::class);
});
