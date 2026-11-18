<?php

declare(strict_types=1);

namespace App\Providers;

use Illuminate\Database\SQLiteConnection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        $connection = DB::connection();

        if ($connection instanceof SQLiteConnection) {
            $connection->statement('PRAGMA foreign_keys = ON');

            if ($connection->getDatabaseName() !== ':memory:') {
                $connection->statement('PRAGMA journal_mode = WAL');
                $connection->statement('PRAGMA synchronous = NORMAL');
            }
        }
    }
}
