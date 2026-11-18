<?php

declare(strict_types=1);

use App\Modules\Billing\Enums\BillSplitState;
use App\Modules\Billing\Enums\SplitMode;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bill_splits', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('order_id')->constrained('orders')->cascadeOnDelete();
            $table->unsignedInteger('sequence_number');
            $table->string('label', 64);
            $table->string('split_mode', 24)->default(SplitMode::Unified->value);
            $table->string('state', 24)->default(BillSplitState::Pending->value)->index();
            $table->unsignedBigInteger('subtotal_cents');
            $table->unsignedBigInteger('discount_cents')->default(0);
            $table->unsignedBigInteger('service_charge_cents')->default(0);
            $table->unsignedBigInteger('tax_cents')->default(0);
            $table->unsignedBigInteger('tip_cents')->default(0);
            $table->unsignedBigInteger('total_cents');
            $table->timestamps();

            $table->unique(['order_id', 'sequence_number']);
        });

        Schema::create('bill_split_items', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('bill_split_id')->constrained('bill_splits')->cascadeOnDelete();
            $table->foreignId('order_item_id')->constrained('order_items')->cascadeOnDelete();
            $table->unsignedInteger('share_numerator')->default(1);
            $table->unsignedInteger('share_denominator')->default(1);
            $table->unsignedBigInteger('allocated_subtotal_cents');
            $table->timestamps();
        });

        Schema::create('payment_transactions', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('branch_id')->constrained('branches')->cascadeOnDelete();
            $table->foreignId('shift_id')->constrained('shifts')->cascadeOnDelete();
            $table->foreignId('order_id')->constrained('orders')->cascadeOnDelete();
            $table->foreignId('bill_split_id')->constrained('bill_splits')->cascadeOnDelete();
            $table->foreignId('parent_transaction_id')->nullable()->constrained('payment_transactions')->nullOnDelete();
            $table->string('idempotency_key', 100)->unique();
            $table->string('tender_method', 24);
            $table->string('state', 24)->index();
            $table->bigInteger('amount_cents');
            $table->unsignedBigInteger('tip_cents')->default(0);
            $table->unsignedBigInteger('tendered_cents')->default(0);
            $table->unsignedBigInteger('change_cents')->default(0);
            $table->string('failure_reason')->nullable();
            $table->string('gateway_reference', 96)->nullable();
            $table->foreignId('processed_by_user_id')->constrained('users');
            $table->boolean('refunded_with_wastage')->default(false);
            $table->timestamps();

            $table->index(['branch_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payment_transactions');
        Schema::dropIfExists('bill_split_items');
        Schema::dropIfExists('bill_splits');
    }
};
