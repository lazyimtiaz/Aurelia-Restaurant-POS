<?php

declare(strict_types=1);

use App\Modules\Identity\Enums\StaffRole;
use App\Modules\Kitchen\Enums\ItemPrepState;
use App\Modules\Kitchen\Enums\TicketState;
use App\Modules\Kitchen\Models\KitchenTicket;
use App\Modules\Menu\Models\BranchMenuOverride;
use App\Modules\Menu\Models\MenuItemVariant;
use App\Modules\Restaurant\Models\Branch;
use Database\Seeders\AureliaEnterpriseSeeder;
use Inertia\Testing\AssertableInertia as Assert;

it('renders KitchenPage, gates unauthorized roles, bumps items, and serves Expo ticket over HTTP', function (): void {
    $this->seed(AureliaEnterpriseSeeder::class);
    $this->withoutVite();

    // Cashier blocked from /kitchen and /menu
    signInAndUnlockAs($this, StaffRole::Cashier, '1111');
    $this->get('/kitchen')->assertForbidden();
    $this->get('/menu')->assertForbidden();

    // Chef unlocks and bumps kitchen ticket items to Ready
    signInAndUnlockAs($this, StaffRole::Chef, '3333');

    $this->get('/kitchen')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Kitchen/KitchenPage')
            ->has('tickets', 1)
            ->has('stations', 4)
        );

    $ticket = KitchenTicket::query()->with('items')->firstOrFail();
    foreach ($ticket->items as $item) {
        $this->post("/kitchen/items/{$item->id}/bump", ['target_state' => ItemPrepState::InPrep->value])
            ->assertRedirect();
        $this->post("/kitchen/items/{$item->id}/bump", ['target_state' => ItemPrepState::Ready->value])
            ->assertRedirect();
    }

    expect($ticket->refresh()->state)->toBe(TicketState::Ready);

    // Expediter unlocks and serves finished Expo ticket
    signInAndUnlockAs($this, StaffRole::KitchenExpediter, '4444');
    $this->post("/kitchen/tickets/{$ticket->id}/serve")->assertRedirect();

    expect($ticket->refresh()->state)->toBe(TicketState::Served);
});

it('manages branch menu availability and price overrides on /menu', function (): void {
    $this->seed(AureliaEnterpriseSeeder::class);
    $this->withoutVite();

    signInAndUnlockAs($this, StaffRole::BranchManager, '1234');

    $this->get('/menu')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Menu/MenuPage')
            ->has('catalog')
        );

    $variant = MenuItemVariant::query()->where('sku', 'GRL-WAG-SGL')->firstOrFail();

    $this->post("/menu/{$variant->id}/availability", [
        'is_available' => false,
        'reason' => 'Short on brioche buns',
    ])->assertRedirect();

    $this->post("/menu/{$variant->id}/price-override", [
        'price_override_cents' => 2350,
    ])->assertRedirect();

    $dtf = Branch::query()->where('code', 'DTF')->firstOrFail();

    $override = BranchMenuOverride::query()
        ->where('branch_id', $dtf->id)
        ->where('menu_item_variant_id', $variant->id)
        ->firstOrFail();

    expect($override->is_available)->toBeFalse()
        ->and($override->price_override_cents)->toBe(2350);
});
