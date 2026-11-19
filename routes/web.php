<?php

declare(strict_types=1);

use App\Http\Controllers\AuditLogController;
use App\Http\Controllers\Auth\BranchContextController;
use App\Http\Controllers\Auth\StaffLockController;
use App\Http\Controllers\Auth\TerminalAuthController;
use App\Http\Controllers\BillingController;
use App\Http\Controllers\EvaluatorDemoController;
use App\Http\Controllers\ExecutiveDashboardController;
use App\Http\Controllers\FloorController;
use App\Http\Controllers\InventoryController;
use App\Http\Controllers\KdsController;
use App\Http\Controllers\PosController;
use App\Http\Controllers\ShiftReconciliationController;
use App\Http\Controllers\SplitScreenDemoController;
use App\Http\Middleware\RequireOpenShiftMiddleware;
use App\Modules\Identity\Services\CurrentStaffContext;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::get('/login', [TerminalAuthController::class, 'show'])->name('login');
Route::post('/login', [TerminalAuthController::class, 'store'])->name('terminal.login');

Route::middleware('terminal')->group(function (): void {
    Route::get('/lock', [StaffLockController::class, 'show'])->name('lock.show');
    Route::post('/lock/unlock', [StaffLockController::class, 'unlock'])->name('lock.unlock');
    Route::post('/terminal/sign-out', [TerminalAuthController::class, 'signOut'])->name('terminal.sign-out');
});

Route::middleware(['terminal', 'staff'])->group(function (): void {
    Route::get('/', function (Request $request, CurrentStaffContext $staffContext) {
        return redirect($staffContext->requireStaff($request)->role->homeRoute());
    })->name('home');

    Route::post('/lock', [StaffLockController::class, 'lock'])->name('lock');
    Route::post('/branch/switch', [BranchContextController::class, 'switch'])->name('branch.switch');
});

Route::prefix('evaluator')->name('evaluator.')->group(function (): void {
    Route::post('/switch-role', [EvaluatorDemoController::class, 'switchRole'])->name('switch-role');
    Route::post('/switch-branch', [EvaluatorDemoController::class, 'switchBranch'])->name('switch-branch');
    Route::post('/simulations', [EvaluatorDemoController::class, 'updateSimulations'])->name('simulations');
    Route::post('/catalog/{variantId}/toggle-86', [EvaluatorDemoController::class, 'toggleCatalogItem86'])->name('catalog.toggle-86');
});

Route::prefix('floor')->name('floor.')->group(function (): void {
    Route::get('/', [FloorController::class, 'index'])->name('index');
    Route::post('/tables/{tableId}/state', [FloorController::class, 'updateState'])->name('tables.state');
    Route::post('/tables/{tableId}/service-request', [FloorController::class, 'requestService'])->name('tables.service-request');
    Route::post('/orders/{orderId}/transfer', [FloorController::class, 'transferOrder'])->name('orders.transfer');
});

Route::prefix('pos')->name('pos.')->group(function (): void {
    Route::get('/', [PosController::class, 'index'])->name('index');

    Route::middleware(RequireOpenShiftMiddleware::class)->group(function (): void {
        Route::post('/orders', [PosController::class, 'storeOrder'])->name('orders.store');
        Route::post('/orders/{orderId}/items', [PosController::class, 'addItem'])->name('orders.items.add');
        Route::delete('/order-items/{itemId}', [PosController::class, 'removeItem'])->name('orders.items.remove');
        Route::post('/orders/{orderId}/fire', [PosController::class, 'fireRound'])->name('orders.fire');
        Route::post('/orders/{orderId}/discount', [PosController::class, 'applyDiscount'])->name('orders.discount');
        Route::post('/order-items/{itemId}/void', [PosController::class, 'voidItem'])->name('orders.items.void');
    });
});

Route::prefix('billing')->name('billing.')->group(function (): void {
    Route::get('/splits/{billSplitId}/receipt', [BillingController::class, 'showReceipt'])->name('splits.receipt');
    Route::post('/orders/{orderId}/request-bill', [BillingController::class, 'requestBill'])->name('orders.request-bill');
    Route::post('/orders/{orderId}/reopen', [BillingController::class, 'reopenOrder'])->name('orders.reopen');
    Route::post('/orders/{orderId}/split', [BillingController::class, 'splitOrder'])->name('orders.split');

    Route::middleware(RequireOpenShiftMiddleware::class)->group(function (): void {
        Route::post('/splits/{billSplitId}/pay', [BillingController::class, 'paySplit'])->name('splits.pay');
        Route::post('/payments/{paymentId}/refund', [BillingController::class, 'refundPayment'])->name('payments.refund');
    });
});

Route::prefix('shifts')->name('shifts.')->group(function (): void {
    Route::get('/', [ShiftReconciliationController::class, 'index'])->name('index');
    Route::post('/open', [ShiftReconciliationController::class, 'openShift'])->name('open');
    Route::post('/{shiftId}/close', [ShiftReconciliationController::class, 'closeShift'])->name('close');
    Route::post('/{shiftId}/approve-variance', [ShiftReconciliationController::class, 'approveVariance'])->name('approve-variance');
});

Route::prefix('kds')->name('kds.')->group(function (): void {
    Route::get('/', [KdsController::class, 'index'])->name('index');
    Route::post('/items/{itemId}/bump', [KdsController::class, 'bumpItem'])->name('items.bump');
    Route::post('/tickets/{ticketId}/serve', [KdsController::class, 'serveTicket'])->name('tickets.serve');
});

Route::get('/demo/split-screen', [SplitScreenDemoController::class, 'index'])->name('demo.split-screen');

Route::get('/executive', ExecutiveDashboardController::class)->name('executive.index');

Route::prefix('inventory')->name('inventory.')->group(function (): void {
    Route::post('/receive', [InventoryController::class, 'receive'])->name('receive');
    Route::post('/wastage', [InventoryController::class, 'wastage'])->name('wastage');
});

Route::get('/audit-logs', [AuditLogController::class, 'index'])->name('audit-logs.index');
