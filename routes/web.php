<?php

declare(strict_types=1);

use App\Http\Controllers\EvaluatorDemoController;
use Illuminate\Support\Facades\Route;

Route::get('/', [EvaluatorDemoController::class, 'index'])->name('dashboard');

Route::prefix('evaluator')->name('evaluator.')->group(function (): void {
    Route::post('/switch-role', [EvaluatorDemoController::class, 'switchRole'])->name('switch-role');
    Route::post('/switch-branch', [EvaluatorDemoController::class, 'switchBranch'])->name('switch-branch');
    Route::post('/simulations', [EvaluatorDemoController::class, 'updateSimulations'])->name('simulations');
    Route::post('/catalog/{variantId}/toggle-86', [EvaluatorDemoController::class, 'toggleCatalogItem86'])->name('catalog.toggle-86');
});
