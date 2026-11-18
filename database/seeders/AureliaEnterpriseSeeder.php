<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\User;
use App\Modules\Floor\Enums\TableState;
use App\Modules\Floor\Models\DiningTable;
use App\Modules\Floor\Models\FloorZone;
use App\Modules\Identity\Enums\StaffRole;
use App\Modules\Menu\Enums\PrepStation;
use App\Modules\Menu\Models\BranchMenuOverride;
use App\Modules\Menu\Models\MenuCategory;
use App\Modules\Menu\Models\MenuItem;
use App\Modules\Menu\Models\MenuItemVariant;
use App\Modules\Menu\Models\ModifierGroup;
use App\Modules\Menu\Models\ModifierOption;
use App\Modules\Orders\Actions\AddDraftOrderItemAction;
use App\Modules\Orders\Actions\FireOrderRoundAction;
use App\Modules\Orders\Actions\OpenOrderTabAction;
use App\Modules\Orders\DTOs\OrderItemInputData;
use App\Modules\Orders\Enums\ServiceType;
use App\Modules\Orders\Models\Order;
use App\Modules\Restaurant\Models\Branch;
use App\Modules\Shifts\Actions\OpenShiftAction;
use App\Modules\Shifts\Enums\ShiftState;
use App\Modules\Shifts\Models\Shift;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class AureliaEnterpriseSeeder extends Seeder
{
    public function run(): void
    {
        $branches = $this->seedBranches();
        $this->seedStaff($branches);
        $variants = $this->seedCatalog();
        $this->seedBranchOverrides($branches, $variants);
        $this->seedFloorZonesAndTables($branches);
        $this->seedOpenShifts($branches);
        $this->seedDemoLiveService($branches, $variants);
    }

    /**
     * @return array<string, Branch>
     */
    private function seedBranches(): array
    {
        $definitions = [
            [
                'code' => 'DTF',
                'name' => 'Downtown Flagship',
                'timezone' => 'America/New_York',
                'tax_rate_bps' => 825,
                'service_charge_bps' => 500,
                'discount_pin_threshold_bps' => 1500,
                'cash_variance_tolerance_cents' => 500,
                'operating_hours' => ['mon-sun' => '11:00-23:30'],
                'is_active' => true,
            ],
            [
                'code' => 'WFP',
                'name' => 'Waterfront Patio',
                'timezone' => 'America/New_York',
                'tax_rate_bps' => 850,
                'service_charge_bps' => 600,
                'discount_pin_threshold_bps' => 1500,
                'cash_variance_tolerance_cents' => 500,
                'operating_hours' => ['mon-sun' => '11:30-23:00'],
                'is_active' => true,
            ],
            [
                'code' => 'APX',
                'name' => 'Airport Express',
                'timezone' => 'America/Chicago',
                'tax_rate_bps' => 925,
                'service_charge_bps' => 0,
                'discount_pin_threshold_bps' => 1000,
                'cash_variance_tolerance_cents' => 300,
                'operating_hours' => ['mon-sun' => '06:00-22:30'],
                'is_active' => true,
            ],
        ];

        $seeded = [];
        foreach ($definitions as $data) {
            $seeded[$data['code']] = Branch::query()->updateOrCreate(
                ['code' => $data['code']],
                $data,
            );
        }

        return $seeded;
    }

    /**
     * @param  array<string, Branch>  $branches
     */
    private function seedStaff(array $branches): void
    {
        $password = Hash::make('password');
        $managerPin = Hash::make('1234');

        User::query()->updateOrCreate(
            ['email' => 'sysadmin@aurelia.test'],
            [
                'branch_id' => null,
                'name' => 'Alex Mercer (Enterprise Admin)',
                'role' => StaffRole::EnterpriseSystemAdmin,
                'password' => $password,
                'pin_hash' => $managerPin,
            ],
        );

        User::query()->updateOrCreate(
            ['email' => 'owner@aurelia.test'],
            [
                'branch_id' => null,
                'name' => 'Elena Vance (Restaurant Owner)',
                'role' => StaffRole::RestaurantOwner,
                'password' => $password,
                'pin_hash' => $managerPin,
            ],
        );

        $branchRoles = [
            StaffRole::BranchManager,
            StaffRole::Cashier,
            StaffRole::Waiter,
            StaffRole::Chef,
            StaffRole::KitchenExpediter,
            StaffRole::InventoryManager,
        ];

        foreach ($branches as $code => $branch) {
            foreach ($branchRoles as $role) {
                $email = strtolower($role->value).'.'.strtolower($code).'@aurelia.test';

                User::query()->updateOrCreate(
                    ['email' => $email],
                    [
                        'branch_id' => $branch->id,
                        'name' => "{$role->label()} ({$code})",
                        'role' => $role,
                        'password' => $password,
                        'pin_hash' => $role->canAuthorizeManagerPin() ? $managerPin : null,
                        'assigned_station' => $role === StaffRole::Chef ? PrepStation::Grill->value : null,
                    ],
                );
            }
        }
    }

    /**
     * @return array<string, MenuItemVariant>
     */
    private function seedCatalog(): array
    {
        $doneness = ModifierGroup::query()->updateOrCreate(
            ['name' => 'Steak Doneness'],
            ['min_select' => 1, 'max_select' => 1, 'is_required' => true],
        );
        foreach (['Rare' => 0, 'Medium Rare' => 0, 'Medium' => 0, 'Medium Well' => 0, 'Truffle Butter' => 350] as $opt => $delta) {
            ModifierOption::query()->updateOrCreate(
                ['modifier_group_id' => $doneness->id, 'name' => $opt],
                ['price_delta_cents' => $delta, 'is_active' => true],
            );
        }

        $addons = ModifierGroup::query()->updateOrCreate(
            ['name' => 'Dietary & Toppings'],
            ['min_select' => 0, 'max_select' => 3, 'is_required' => false],
        );
        foreach (['Gluten-Free Bun' => 200, 'Extra Aged Cheddar' => 250, 'No Onions (Allergy)' => 0] as $opt => $delta) {
            ModifierOption::query()->updateOrCreate(
                ['modifier_group_id' => $addons->id, 'name' => $opt],
                ['price_delta_cents' => $delta, 'is_active' => true],
            );
        }

        $barMods = ModifierGroup::query()->updateOrCreate(
            ['name' => 'Beverage Preparation'],
            ['min_select' => 0, 'max_select' => 2, 'is_required' => false],
        );
        foreach (['Zero Ice' => 0, 'Oat Milk' => 125, 'Extra Espresso Shot' => 175] as $opt => $delta) {
            ModifierOption::query()->updateOrCreate(
                ['modifier_group_id' => $barMods->id, 'name' => $opt],
                ['price_delta_cents' => $delta, 'is_active' => true],
            );
        }

        $categories = [
            ['slug' => 'starters-salads', 'name' => 'Starters & Salads', 'sort_order' => 1],
            ['slug' => 'woodfire-mains', 'name' => 'Woodfire & Grill', 'sort_order' => 2],
            ['slug' => 'artisan-pastry', 'name' => 'Pastry & Desserts', 'sort_order' => 3],
            ['slug' => 'craft-bar', 'name' => 'Craft Bar & Coffee', 'sort_order' => 4],
        ];

        $categoryModels = [];
        foreach ($categories as $cat) {
            $categoryModels[$cat['slug']] = MenuCategory::query()->updateOrCreate(['slug' => $cat['slug']], $cat);
        }

        $itemsSpec = [
            [
                'category' => 'starters-salads',
                'slug' => 'burrata-heirloom-salad',
                'name' => 'Burrata & Heirloom Tomato',
                'description' => 'Creamy Pugliese burrata, charred sourdough, aged balsamic.',
                'prep_station' => PrepStation::ColdSalad,
                'allergen_tags' => ['dairy', 'gluten'],
                'modifier_groups' => [$addons->id],
                'variants' => [
                    ['sku' => 'SAL-BUR-REG', 'name' => 'Share Plate', 'base_price_cents' => 1650],
                ],
            ],
            [
                'category' => 'woodfire-mains',
                'slug' => 'wagyu-smash-burger',
                'name' => 'Aurelia Wagyu Smash Burger',
                'description' => 'Double dry-aged Wagyu patty, caramelized shallots, brioche.',
                'prep_station' => PrepStation::Grill,
                'allergen_tags' => ['gluten', 'dairy', 'sesame'],
                'modifier_groups' => [$addons->id],
                'variants' => [
                    ['sku' => 'GRL-WAG-SGL', 'name' => 'Single', 'base_price_cents' => 1900],
                    ['sku' => 'GRL-WAG-DBL', 'name' => 'Double', 'base_price_cents' => 2450],
                ],
            ],
            [
                'category' => 'woodfire-mains',
                'slug' => 'charred-prime-ribeye',
                'name' => 'Charred Prime Ribeye',
                'description' => 'Oak-grilled prime cut finished with rosemary bone marrow jus.',
                'prep_station' => PrepStation::Grill,
                'allergen_tags' => ['dairy'],
                'modifier_groups' => [$doneness->id],
                'variants' => [
                    ['sku' => 'GRL-RIB-300', 'name' => '300g Cut', 'base_price_cents' => 4200],
                    ['sku' => 'GRL-RIB-450', 'name' => '450g Reserve', 'base_price_cents' => 5800],
                ],
            ],
            [
                'category' => 'woodfire-mains',
                'slug' => 'lobster-thermidor',
                'name' => 'Butter-Poached Lobster Thermidor',
                'description' => 'Maine lobster tail, cognac mustard cream, gruyère crust.',
                'prep_station' => PrepStation::Grill,
                'allergen_tags' => ['shellfish', 'dairy'],
                'modifier_groups' => [],
                'variants' => [
                    ['sku' => 'GRL-LOB-STD', 'name' => 'Whole Tail', 'base_price_cents' => 5400],
                ],
            ],
            [
                'category' => 'artisan-pastry',
                'slug' => 'valrhona-lava-torte',
                'name' => 'Valrhona Dark Chocolate Torte',
                'description' => 'Warm 70% ganache center,Tahitian vanilla bean gelato.',
                'prep_station' => PrepStation::Pastry,
                'allergen_tags' => ['dairy', 'eggs', 'gluten'],
                'modifier_groups' => [],
                'variants' => [
                    ['sku' => 'PAS-TOR-IND', 'name' => 'Individual', 'base_price_cents' => 1400],
                ],
            ],
            [
                'category' => 'craft-bar',
                'slug' => 'yuzu-elderflower-spritz',
                'name' => 'Yuzu & Elderflower Spritz',
                'description' => 'Zero-proof botanical spritz with fresh yuzu zest and prosecco essence.',
                'prep_station' => PrepStation::Bar,
                'allergen_tags' => [],
                'modifier_groups' => [$barMods->id],
                'variants' => [
                    ['sku' => 'BAR-YUZ-GLS', 'name' => 'Glass', 'base_price_cents' => 1250],
                    ['sku' => 'BAR-YUZ-CAR', 'name' => 'Table Carafe', 'base_price_cents' => 3800],
                ],
            ],
        ];

        $variants = [];
        foreach ($itemsSpec as $spec) {
            $item = MenuItem::query()->updateOrCreate(
                ['slug' => $spec['slug']],
                [
                    'menu_category_id' => $categoryModels[$spec['category']]->id,
                    'name' => $spec['name'],
                    'description' => $spec['description'],
                    'prep_station' => $spec['prep_station'],
                    'allergen_tags' => $spec['allergen_tags'],
                    'is_active' => true,
                ],
            );

            $item->modifierGroups()->sync($spec['modifier_groups']);

            foreach ($spec['variants'] as $variantData) {
                $variant = MenuItemVariant::query()->updateOrCreate(
                    ['sku' => $variantData['sku']],
                    [
                        'menu_item_id' => $item->id,
                        'name' => $variantData['name'],
                        'base_price_cents' => $variantData['base_price_cents'],
                        'is_active' => true,
                    ],
                );
                $variants[$variantData['sku']] = $variant;
            }
        }

        return $variants;
    }

    /**
     * @param  array<string, Branch>  $branches
     * @param  array<string, MenuItemVariant>  $variants
     */
    private function seedBranchOverrides(array $branches, array $variants): void
    {
        if (isset($branches['DTF'], $variants['GRL-LOB-STD'])) {
            BranchMenuOverride::query()->updateOrCreate(
                [
                    'branch_id' => $branches['DTF']->id,
                    'menu_item_variant_id' => $variants['GRL-LOB-STD']->id,
                ],
                [
                    'is_available' => false,
                    'eighty_sixed_reason' => 'Evening lobster delivery pending',
                ],
            );
        }

        if (isset($branches['APX'], $variants['GRL-WAG-SGL'])) {
            BranchMenuOverride::query()->updateOrCreate(
                [
                    'branch_id' => $branches['APX']->id,
                    'menu_item_variant_id' => $variants['GRL-WAG-SGL']->id,
                ],
                [
                    'price_override_cents' => 2200,
                    'is_available' => true,
                ],
            );
        }
    }

    /**
     * @param  array<string, Branch>  $branches
     */
    private function seedFloorZonesAndTables(array $branches): void
    {
        foreach ($branches as $branch) {
            $main = FloorZone::query()->updateOrCreate(
                ['branch_id' => $branch->id, 'name' => 'Main Dining'],
                ['sort_order' => 1],
            );
            $patio = FloorZone::query()->updateOrCreate(
                ['branch_id' => $branch->id, 'name' => 'Patio'],
                ['sort_order' => 2],
            );
            $bar = FloorZone::query()->updateOrCreate(
                ['branch_id' => $branch->id, 'name' => 'Bar Counter'],
                ['sort_order' => 3],
            );

            $tables = [
                [$main->id, 'M1', 4],
                [$main->id, 'M2', 4],
                [$main->id, 'M3', 6],
                [$main->id, 'M4', 2],
                [$main->id, 'M5', 4],
                [$patio->id, 'P1', 4],
                [$patio->id, 'P2', 6],
                [$patio->id, 'P3', 2],
                [$bar->id, 'B1', 2],
                [$bar->id, 'B2', 2],
            ];

            foreach ($tables as [$zoneId, $code, $capacity]) {
                DiningTable::query()->firstOrCreate(
                    ['branch_id' => $branch->id, 'code' => $code],
                    [
                        'floor_zone_id' => $zoneId,
                        'capacity' => $capacity,
                        'state' => TableState::Available,
                        'current_guest_count' => 0,
                    ],
                );
            }
        }
    }

    /**
     * @param  array<string, Branch>  $branches
     */
    private function seedOpenShifts(array $branches): void
    {
        $openShiftAction = app(OpenShiftAction::class);

        foreach ($branches as $code => $branch) {
            $cashier = User::query()
                ->where('branch_id', $branch->id)
                ->where('role', StaffRole::Cashier->value)
                ->first();

            if ($cashier === null) {
                continue;
            }

            $alreadyOpen = Shift::query()
                ->where('branch_id', $branch->id)
                ->where('user_id', $cashier->id)
                ->where('state', ShiftState::Open->value)
                ->exists();

            if (! $alreadyOpen) {
                $openShiftAction->execute(
                    branchId: $branch->id,
                    userId: $cashier->id,
                    openingCashCents: $code === 'DTF' ? 25000 : 20000,
                );
            }
        }
    }

    /**
     * @param  array<string, Branch>  $branches
     * @param  array<string, MenuItemVariant>  $variants
     */
    private function seedDemoLiveService(array $branches, array $variants): void
    {
        $dtf = $branches['DTF'] ?? null;
        if ($dtf === null || Order::query()->where('branch_id', $dtf->id)->exists()) {
            return;
        }

        $shift = Shift::query()
            ->where('branch_id', $dtf->id)
            ->where('state', ShiftState::Open->value)
            ->first();

        $waiter = User::query()
            ->where('branch_id', $dtf->id)
            ->where('role', StaffRole::Waiter->value)
            ->first();

        $tableM3 = DiningTable::query()
            ->where('branch_id', $dtf->id)
            ->where('code', 'M3')
            ->where('state', TableState::Available->value)
            ->first();

        if ($shift === null || $waiter === null || $tableM3 === null) {
            return;
        }

        $order = app(OpenOrderTabAction::class)->execute(
            branchId: $dtf->id,
            shiftId: $shift->id,
            serverId: $waiter->id,
            serviceType: ServiceType::DineIn,
            tableId: $tableM3->id,
            guestCount: 4,
        );

        if (isset($variants['GRL-WAG-DBL'])) {
            app(AddDraftOrderItemAction::class)->execute($order->id, new OrderItemInputData(
                menuItemVariantId: $variants['GRL-WAG-DBL']->id,
                quantity: 2,
                seatNumber: 1,
                specialInstructions: 'Extra crispy shallots',
            ));
        }

        if (isset($variants['BAR-YUZ-GLS'])) {
            app(AddDraftOrderItemAction::class)->execute($order->id, new OrderItemInputData(
                menuItemVariantId: $variants['BAR-YUZ-GLS']->id,
                quantity: 2,
                seatNumber: 2,
            ));
        }

        app(FireOrderRoundAction::class)->execute($order->id, $waiter->id);
    }
}
