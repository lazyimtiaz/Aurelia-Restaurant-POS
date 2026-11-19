<?php

declare(strict_types=1);

use App\Http\Controllers\AuditLogController;
use App\Http\Controllers\Auth\BranchContextController;
use App\Http\Controllers\Auth\StaffLockController;
use App\Http\Controllers\Auth\TerminalAuthController;
use App\Http\Controllers\BillingController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\FloorController;
use App\Http\Controllers\InventoryController;
use App\Http\Controllers\KdsController;
use App\Http\Controllers\MenuManagementController;
use App\Http\Controllers\OrdersController;
use App\Http\Controllers\PosController;
use App\Http\Controllers\ReportsController;
use App\Http\Controllers\SettingsController;
use App\Http\Controllers\ShiftReconciliationController;
use App\Http\Middleware\RequireOpenShiftMiddleware;
use Illuminate\Support\Facades\Route;

Route::get('/login', [TerminalAuthController::class, 'show'])->name('login');
Route::post('/login', [TerminalAuthController::class, 'store'])->name('terminal.login');

Route::middleware('terminal')->group(function (): void {
    Route::get('/lock', [StaffLockController::class, 'show'])->name('lock.show');
    Route::post('/lock/unlock', [StaffLockController::class, 'unlock'])->name('lock.unlock');
    Route::post('/terminal/sign-out', [TerminalAuthController::class, 'signOut'])->name('terminal.sign-out');
});

Route::middleware(['terminal', 'staff'])->group(function (): void {
    Route::get('/', [StaffLockController::class, 'home'])->name('home');

    Route::post('/lock', [StaffLockController::class, 'lock'])->name('lock');
    Route::post('/branch/switch', [BranchContextController::class, 'switch'])->name('branch.switch');

    Route::get('/dashboard', DashboardController::class)
        ->middleware('role:dashboard')
        ->name('dashboard');

    Route::prefix('tables')->name('tables.')->middleware('role:tables')->group(function (): void {
        Route::get('/', [FloorController::class, 'index'])->name('index');
        Route::post('/{tableId}/state', [FloorController::class, 'updateState'])->name('state');
        Route::post('/{tableId}/service-request', [FloorController::class, 'requestService'])->name('service-request');
        Route::post('/orders/{orderId}/transfer', [FloorController::class, 'transferOrder'])->name('orders.transfer');
    });

    Route::prefix('pos')->name('pos.')->middleware('role:pos')->group(function (): void {
        Route::get('/', [PosController::class, 'index'])->name('index');

        Route::middleware(RequireOpenShiftMiddleware::class)->group(function (): void {
            Route::post('/orders', [PosController::class, 'storeOrder'])->name('orders.store');
            Route::delete('/orders/{orderId}', [PosController::class, 'cancelOrder'])->name('orders.cancel');
            Route::post('/orders/{orderId}/items', [PosController::class, 'addItem'])->name('orders.items.add');
            Route::patch('/order-items/{itemId}', [PosController::class, 'updateItemQuantity'])->name('orders.items.update');
            Route::delete('/order-items/{itemId}', [PosController::class, 'removeItem'])->name('orders.items.remove');
            Route::post('/orders/{orderId}/fire', [PosController::class, 'fireRound'])->name('orders.fire');
            Route::post('/orders/{orderId}/discount', [PosController::class, 'applyDiscount'])->name('orders.discount');
            Route::post('/order-items/{itemId}/void', [PosController::class, 'voidItem'])->name('orders.items.void');
        });
    });

    Route::get('/orders', [OrdersController::class, 'index'])
        ->middleware('role:orders')
        ->name('orders.index');

    Route::prefix('billing')->name('billing.')->middleware('role:pos,orders')->group(function (): void {
        Route::get('/splits/{billSplitId}/receipt', [BillingController::class, 'showReceipt'])->name('splits.receipt');
        Route::post('/orders/{orderId}/request-bill', [BillingController::class, 'requestBill'])->name('orders.request-bill');
        Route::post('/orders/{orderId}/reopen', [BillingController::class, 'reopenOrder'])->name('orders.reopen');
        Route::post('/orders/{orderId}/split', [BillingController::class, 'splitOrder'])->name('orders.split');

        Route::middleware(RequireOpenShiftMiddleware::class)->group(function (): void {
            Route::post('/splits/{billSplitId}/pay', [BillingController::class, 'paySplit'])->name('splits.pay');
            Route::post('/payments/{paymentId}/refund', [BillingController::class, 'refundPayment'])->name('payments.refund');
        });
    });

    Route::prefix('kitchen')->name('kitchen.')->middleware('role:kitchen')->group(function (): void {
        Route::get('/', [KdsController::class, 'index'])->name('index');
        Route::post('/items/{itemId}/bump', [KdsController::class, 'bumpItem'])->name('items.bump');
        Route::post('/tickets/{ticketId}/serve', [KdsController::class, 'serveTicket'])->name('tickets.serve');
    });

    Route::prefix('menu')->name('menu.')->middleware('role:menu')->group(function (): void {
        Route::get('/', [MenuManagementController::class, 'index'])->name('index');
        Route::post('/items', [MenuManagementController::class, 'storeItem'])->name('items.store');
        Route::post('/{variantId}/availability', [MenuManagementController::class, 'toggleAvailability'])->name('availability');
        Route::post('/{variantId}/price-override', [MenuManagementController::class, 'setPriceOverride'])->name('price-override');
    });

    Route::prefix('inventory')->name('inventory.')->middleware('role:inventory')->group(function (): void {
        Route::get('/', [InventoryController::class, 'index'])->name('index');
        Route::post('/receive', [InventoryController::class, 'receive'])->name('receive');
        Route::post('/wastage', [InventoryController::class, 'wastage'])->name('wastage');
    });

    Route::middleware('role:reports')->group(function (): void {
        Route::get('/reports', [ReportsController::class, 'index'])->name('reports.index');
        Route::get('/audit-logs', [AuditLogController::class, 'index'])->name('audit-logs.index');
    });

    Route::prefix('shifts')->name('shifts.')->middleware('role:shifts')->group(function (): void {
        Route::get('/', [ShiftReconciliationController::class, 'index'])->name('index');
        Route::post('/open', [ShiftReconciliationController::class, 'openShift'])->name('open');
        Route::post('/{shiftId}/close', [ShiftReconciliationController::class, 'closeShift'])->name('close');
        Route::post('/{shiftId}/approve-variance', [ShiftReconciliationController::class, 'approveVariance'])->name('approve-variance');
    });

    Route::prefix('settings')->name('settings.')->middleware('role:settings')->group(function (): void {
        Route::get('/', [SettingsController::class, 'index'])->name('index');
        Route::put('/branch', [SettingsController::class, 'updateBranch'])->name('branch.update');
    });
});
