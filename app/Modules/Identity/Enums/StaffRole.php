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
