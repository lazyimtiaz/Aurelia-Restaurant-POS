<?php

declare(strict_types=1);

namespace App\Modules\Inventory\Enums;

enum StockMovementType: string
{
    case SupplierReceipt = 'supplier_receipt';
    case OrderSale = 'order_sale';
    case Wastage = 'wastage';
    case Restock = 'restock';
    case ManualAdjustment = 'manual_adjustment';

    public function label(): string
    {
        return match ($this) {
            self::SupplierReceipt => 'Supplier Receipt',
            self::OrderSale => 'Order Sale Deduction',
            self::Wastage => 'Wastage / Spoilage',
            self::Restock => 'Restock Return',
            self::ManualAdjustment => 'Manual Adjustment',
        };
    }
}
