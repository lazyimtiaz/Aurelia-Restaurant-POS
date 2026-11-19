<?php

declare(strict_types=1);

namespace App\Modules\Identity\Enums;

enum StaffRole: string
{
    case EnterpriseSystemAdmin = 'enterprise_system_admin';
    case RestaurantOwner = 'restaurant_owner';
    case BranchManager = 'branch_manager';
    case Cashier = 'cashier';
    case Waiter = 'waiter';
    case Chef = 'chef';
    case KitchenExpediter = 'kitchen_expediter';
    case InventoryManager = 'inventory_manager';

    public function canAuthorizeManagerPin(): bool
    {
        return match ($this) {
            self::EnterpriseSystemAdmin,
            self::RestaurantOwner,
            self::BranchManager => true,
            default => false,
        };
    }

    public function canAccessExecutiveWorkspace(): bool
    {
        return match ($this) {
            self::EnterpriseSystemAdmin,
            self::RestaurantOwner,
            self::BranchManager,
            self::InventoryManager => true,
            default => false,
        };
    }

    public function canSignInTerminal(): bool
    {
        return match ($this) {
            self::EnterpriseSystemAdmin,
            self::RestaurantOwner,
            self::BranchManager => true,
            default => false,
        };
    }

    public function canSwitchActiveBranch(): bool
    {
        return match ($this) {
            self::EnterpriseSystemAdmin,
            self::RestaurantOwner => true,
            default => false,
        };
    }

    public function homeRoute(): string
    {
        return match ($this) {
            self::EnterpriseSystemAdmin,
            self::RestaurantOwner,
            self::BranchManager => '/dashboard',
            self::Cashier => '/pos',
            self::Waiter => '/tables',
            self::Chef,
            self::KitchenExpediter => '/kitchen',
            self::InventoryManager => '/inventory',
        };
    }

    /**
     * @return list<string>
     */
    public function allowedSections(): array
    {
        return match ($this) {
            self::EnterpriseSystemAdmin,
            self::RestaurantOwner,
            self::BranchManager => [
                'dashboard',
                'pos',
                'orders',
                'tables',
                'kitchen',
                'menu',
                'inventory',
                'reports',
                'shifts',
                'settings',
            ],
            self::Cashier => ['pos', 'orders', 'tables', 'shifts'],
            self::Waiter => ['tables', 'pos', 'orders'],
            self::Chef,
            self::KitchenExpediter => ['kitchen'],
            self::InventoryManager => ['inventory', 'menu', 'reports'],
        };
    }

    public function canAccessSection(string $section): bool
    {
        return in_array($section, $this->allowedSections(), true);
    }

    public function label(): string
    {
        return match ($this) {
            self::EnterpriseSystemAdmin => 'Enterprise System Admin',
            self::RestaurantOwner => 'Restaurant Owner',
            self::BranchManager => 'Branch Manager',
            self::Cashier => 'Cashier',
            self::Waiter => 'Waiter / Server',
            self::Chef => 'Chef / Kitchen Staff',
            self::KitchenExpediter => 'Kitchen Expediter (Expo)',
            self::InventoryManager => 'Inventory Manager',
        };
    }

    /**
     * @return list<self>
     */
    public static function managerPinRoles(): array
    {
        return [
            self::EnterpriseSystemAdmin,
            self::RestaurantOwner,
            self::BranchManager,
        ];
    }
}
