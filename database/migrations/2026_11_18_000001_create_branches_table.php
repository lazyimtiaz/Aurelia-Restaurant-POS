<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('branches', function (Blueprint $table): void {
            $table->id();
            $table->string('code', 16)->unique();
            $table->string('name');
            $table->string('timezone', 64)->default('UTC');
            $table->unsignedInteger('tax_rate_bps')->default(825);
            $table->unsignedInteger('service_charge_bps')->default(500);
            $table->unsignedInteger('discount_pin_threshold_bps')->default(1500);
            $table->unsignedInteger('cash_variance_tolerance_cents')->default(500);
            $table->json('operating_hours')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('branches');
    }
};
