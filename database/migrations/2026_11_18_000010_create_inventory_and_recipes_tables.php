<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ingredients', function (Blueprint $table): void {
            $table->id();
            $table->string('code', 40)->unique();
            $table->string('name', 120);
            $table->string('unit', 24);
            $table->unsignedInteger('default_unit_cost_cents')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('branch_ingredient_stocks', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('branch_id')->constrained('branches')->cascadeOnDelete();
            $table->foreignId('ingredient_id')->constrained('ingredients')->cascadeOnDelete();
            $table->bigInteger('quantity_on_hand')->default(0);
            $table->unsignedBigInteger('auto_86_threshold')->default(0);
            $table->unsignedInteger('unit_cost_cents')->default(0);
            $table->timestamps();

            $table->unique(['branch_id', 'ingredient_id'], 'branch_ingredient_stocks_unique');
        });

        Schema::create('recipe_items', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('menu_item_variant_id')->constrained('menu_item_variants')->cascadeOnDelete();
            $table->foreignId('ingredient_id')->constrained('ingredients')->cascadeOnDelete();
            $table->unsignedInteger('quantity_required');
            $table->timestamps();

            $table->unique(['menu_item_variant_id', 'ingredient_id'], 'recipe_items_variant_ingredient_unique');
        });

        Schema::create('stock_movements', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('branch_id')->constrained('branches')->cascadeOnDelete();
            $table->foreignId('ingredient_id')->constrained('ingredients')->cascadeOnDelete();
            $table->string('movement_type', 32)->index();
            $table->string('reference_type', 64);
            $table->string('reference_id', 64);
            $table->bigInteger('quantity_delta');
            $table->unsignedInteger('unit_cost_cents')->default(0);
            $table->unsignedBigInteger('total_cost_cents')->default(0);
            $table->foreignId('actor_user_id')->constrained('users');
            $table->string('notes', 255)->nullable();
            $table->timestamps();

            $table->unique(
                ['branch_id', 'reference_type', 'reference_id', 'ingredient_id'],
                'stock_movements_idempotency_unique',
            );
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_movements');
        Schema::dropIfExists('recipe_items');
        Schema::dropIfExists('branch_ingredient_stocks');
        Schema::dropIfExists('ingredients');
    }
};
