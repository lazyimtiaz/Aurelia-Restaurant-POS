<?php

declare(strict_types=1);

use App\Modules\Floor\Enums\TableState;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('floor_zones', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('branch_id')->constrained('branches')->cascadeOnDelete();
            $table->string('name');
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::create('dining_tables', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('branch_id')->constrained('branches')->cascadeOnDelete();
            $table->foreignId('floor_zone_id')->constrained('floor_zones')->cascadeOnDelete();
            $table->string('code', 16);
            $table->unsignedInteger('capacity')->default(4);
            $table->string('state', 32)->default(TableState::Available->value)->index();
            $table->unsignedInteger('current_guest_count')->default(0);
            $table->timestamp('occupied_since')->nullable();
            $table->timestamps();

            $table->unique(['branch_id', 'code']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('dining_tables');
        Schema::dropIfExists('floor_zones');
    }
};
