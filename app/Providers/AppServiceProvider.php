<?php

declare(strict_types=1);

namespace App\Providers;

use App\Modules\Billing\Contracts\PaymentGatewayInterface;
use App\Modules\Billing\Gateways\SimulatedPaymentGateway;
use Illuminate\Database\SQLiteConnection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(PaymentGatewayInterface::class, SimulatedPaymentGateway::class);
    }

    public function boot(): void
    {
        if ($this->app->isProduction() || str_starts_with((string) config('app.url'), 'https://')) {
            URL::forceScheme('https');
        }

        $connection = DB::connection();

        if ($connection instanceof SQLiteConnection) {
            $database = $connection->getDatabaseName();

            if ($database === ':memory:' || (is_string($database) && $database !== '' && file_exists($database))) {
                $connection->statement('PRAGMA foreign_keys = ON');

                if ($database !== ':memory:') {
                    $connection->statement('PRAGMA journal_mode = WAL');
                    $connection->statement('PRAGMA synchronous = NORMAL');
                    $connection->statement('PRAGMA busy_timeout = 5000');
                }
            }
        }
    }
}
