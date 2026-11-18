<?php

declare(strict_types=1);

use App\Modules\Kitchen\Enums\TicketState;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('kitchen_tickets', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('branch_id')->constrained('branches')->cascadeOnDelete();
            $table->foreignId('order_id')->constrained('orders')->cascadeOnDelete();
            $table->unsignedInteger('round_number');
            $table->string('state', 32)->default(TicketState::Fired->value)->index();
            $table->foreignId('fired_by_user_id')->constrained('users');
            $table->timestamp('fired_at');
            $table->timestamp('ready_at')->nullable();
            $table->timestamp('served_at')->nullable();
            $table->timestamps();

            $table->unique(['order_id', 'round_number']);
            $table->index(['branch_id', 'state']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('kitchen_tickets');
    }
};
