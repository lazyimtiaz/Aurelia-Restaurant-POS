<?php

declare(strict_types=1);

use App\Modules\Identity\Enums\StaffRole;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->foreignId('branch_id')
                ->nullable()
                ->after('id')
                ->constrained('branches')
                ->nullOnDelete();
            $table->string('role', 48)
                ->default(StaffRole::Cashier->value)
                ->after('email')
                ->index();
            $table->string('pin_hash')
                ->nullable()
                ->after('password');
            $table->string('assigned_station', 32)
                ->nullable()
                ->after('pin_hash');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('branch_id');
            $table->dropColumn(['role', 'pin_hash', 'assigned_station']);
        });
    }
};
