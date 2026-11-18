<?php

declare(strict_types=1);

use App\Modules\Kitchen\Enums\ItemPrepState;
use App\Modules\Orders\Enums\OrderState;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('orders', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('branch_id')->constrained('branches')->cascadeOnDelete();
            $table->foreignId('shift_id')->constrained('shifts')->cascadeOnDelete();
            $table->foreignId('table_id')->nullable()->constrained('dining_tables')->nullOnDelete();
            $table->foreignId('server_id')->constrained('users')->cascadeOnDelete();
            $table->string('order_number', 32);
            $table->string('service_type', 24);
            $table->string('state', 32)->default(OrderState::Draft->value)->index();
            $table->unsignedInteger('guest_count')->default(1);
            $table->string('customer_name')->nullable();
            $table->unsignedBigInteger('subtotal_cents')->default(0);
            $table->unsignedInteger('discount_bps')->default(0);
            $table->unsignedBigInteger('discount_cents')->default(0);
            $table->unsignedBigInteger('service_charge_cents')->default(0);
            $table->unsignedBigInteger('tax_cents')->default(0);
            $table->unsignedBigInteger('total_cents')->default(0);
            $table->timestamp('opened_at');
            $table->timestamp('closed_at')->nullable();
            $table->timestamps();

            $table->unique(['branch_id', 'order_number']);
            $table->index(['branch_id', 'state']);
        });

        Schema::create('order_items', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('order_id')->constrained('orders')->cascadeOnDelete();
            $table->unsignedBigInteger('kitchen_ticket_id')->nullable()->index();
            $table->foreignId('menu_item_variant_id')->constrained('menu_item_variants');
            $table->string('item_name_snapshot');
            $table->string('variant_name_snapshot');
            $table->string('prep_station', 32)->index();
            $table->string('prep_state', 32)->default(ItemPrepState::Draft->value)->index();
            $table->unsignedInteger('quantity');
            $table->unsignedInteger('unit_price_cents');
            $table->integer('modifiers_total_cents')->default(0);
            $table->unsignedBigInteger('line_total_cents');
            $table->unsignedInteger('seat_number')->nullable();
            $table->string('special_instructions')->nullable();
            $table->string('void_reason', 64)->nullable();
            $table->boolean('was_in_prep_at_void')->default(false);
            $table->timestamps();
        });

        Schema::create('order_item_modifiers', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('order_item_id')->constrained('order_items')->cascadeOnDelete();
            $table->foreignId('modifier_option_id')->constrained('modifier_options');
            $table->string('option_name_snapshot');
            $table->integer('price_delta_cents');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('order_item_modifiers');
        Schema::dropIfExists('order_items');
        Schema::dropIfExists('orders');
    }
};
