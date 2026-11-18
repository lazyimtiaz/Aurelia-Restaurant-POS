<?php

declare(strict_types=1);

use App\Models\User;
use App\Modules\Audit\Models\AuditLog;
use App\Modules\Identity\Enums\StaffRole;
use App\Modules\Menu\Actions\SetBranchPriceOverrideAction;
use App\Modules\Menu\Actions\ToggleBranchItemAvailabilityAction;
use App\Modules\Menu\Enums\PrepStation;
use App\Modules\Menu\Events\ItemAvailabilityChanged;
use App\Modules\Menu\Models\MenuCategory;
use App\Modules\Menu\Models\MenuItem;
use App\Modules\Menu\Models\MenuItemVariant;
use App\Modules\Menu\Models\ModifierGroup;
use App\Modules\Menu\Models\ModifierOption;
use App\Modules\Menu\Queries\GetBranchCatalogQuery;
use App\Modules\Restaurant\Models\Branch;
use Illuminate\Support\Facades\Event;

it('isolates branch 86 availability and price overrides per branch and broadcasts ItemAvailabilityChanged after commit', function (): void {
    Event::fake([ItemAvailabilityChanged::class]);

    $branch1 = Branch::create(['code' => 'DTF', 'name' => 'Downtown Flagship']);
    $branch2 = Branch::create(['code' => 'APX', 'name' => 'Airport Express']);

    $manager = User::factory()->create([
        'branch_id' => $branch2->id,
        'role' => StaffRole::BranchManager,
    ]);

    $category = MenuCategory::create(['name' => 'Mains', 'slug' => 'mains', 'sort_order' => 1]);
    $item = MenuItem::create([
        'menu_category_id' => $category->id,
        'name' => 'Charred Ribeye',
        'slug' => 'charred-ribeye',
        'prep_station' => PrepStation::Grill,
        'allergen_tags' => ['dairy'],
    ]);
    $variant = MenuItemVariant::create([
        'menu_item_id' => $item->id,
        'name' => '300g',
        'sku' => 'RIB-300',
        'base_price_cents' => 1900,
    ]);

    $tempGroup = ModifierGroup::create(['name' => 'Doneness', 'min_select' => 1, 'max_select' => 1, 'is_required' => true]);
    ModifierOption::create(['modifier_group_id' => $tempGroup->id, 'name' => 'Medium Rare', 'price_delta_cents' => 0]);
    $item->modifierGroups()->attach($tempGroup->id);

    app(ToggleBranchItemAvailabilityAction::class)->execute(
        branchId: $branch2->id,
        variantId: $variant->id,
        isAvailable: false,
        reason: 'Out of prime ribeye',
        actorUserId: $manager->id,
    );

    app(SetBranchPriceOverrideAction::class)->execute(
        branchId: $branch2->id,
        variantId: $variant->id,
        priceOverrideCents: 2400,
        actorUserId: $manager->id,
    );

    Event::assertDispatched(ItemAvailabilityChanged::class, function (ItemAvailabilityChanged $event) use ($branch2, $variant): bool {
        return $event->branchId === $branch2->id
            && $event->variantId === $variant->id
            && $event->isAvailable === false
            && $event->reason === 'Out of prime ribeye';
    });

    expect(AuditLog::query()->where('branch_id', $branch2->id)->where('event_type', 'item_86_toggled')->exists())->toBeTrue();

    $catalogBranch1 = app(GetBranchCatalogQuery::class)->execute($branch1->id);
    $catalogBranch2 = app(GetBranchCatalogQuery::class)->execute($branch2->id);

    $v1 = $catalogBranch1->first()['items'][0]['variants'][0];
    $v2 = $catalogBranch2->first()['items'][0]['variants'][0];

    expect($v1['effective_price_cents'])->toBe(1900)
        ->and($v1['is_available'])->toBeTrue()
        ->and($v2['effective_price_cents'])->toBe(2400)
        ->and($v2['is_available'])->toBeFalse()
        ->and($v2['eighty_sixed_reason'])->toBe('Out of prime ribeye')
        ->and($catalogBranch1->first()['items'][0]['modifier_groups'])->toHaveCount(1);
});

it('rejects negative branch price overrides', function (): void {
    $branch = Branch::create(['code' => 'DTF', 'name' => 'Downtown Flagship']);
    $manager = User::factory()->create(['branch_id' => $branch->id, 'role' => StaffRole::BranchManager]);
    $category = MenuCategory::create(['name' => 'Bar', 'slug' => 'bar', 'sort_order' => 1]);
    $item = MenuItem::create(['menu_category_id' => $category->id, 'name' => 'Espresso', 'slug' => 'espresso', 'prep_station' => PrepStation::Bar]);
    $variant = MenuItemVariant::create(['menu_item_id' => $item->id, 'name' => 'Double', 'sku' => 'ESP-DBL', 'base_price_cents' => 450]);

    expect(fn () => app(SetBranchPriceOverrideAction::class)->execute(
        branchId: $branch->id,
        variantId: $variant->id,
        priceOverrideCents: -50,
        actorUserId: $manager->id,
    ))->toThrow(InvalidArgumentException::class);
});
