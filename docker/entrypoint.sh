#!/bin/sh
set -eu

mkdir -p \
    storage/framework/cache/data \
    storage/framework/sessions \
    storage/framework/views \
    storage/logs \
    bootstrap/cache

if [ -z "${APP_KEY:-}" ]; then
    APP_KEY="$(php artisan key:generate --show)"
    export APP_KEY
    echo "WARNING: APP_KEY was unset; generated an ephemeral key for this container instance." >&2
fi

if [ "${DB_CONNECTION:-sqlite}" = "sqlite" ]; then
    DB_DATABASE="${DB_DATABASE:-/tmp/database.sqlite}"
    export DB_DATABASE

    if [ ! -f "$DB_DATABASE" ]; then
        mkdir -p "$(dirname "$DB_DATABASE")"
        touch "$DB_DATABASE"
        php artisan migrate --force --no-interaction

        if [ "${AUTO_SEED_DEMO:-true}" = "true" ]; then
            php artisan db:seed --force --no-interaction
        fi
    fi
else
    php artisan migrate --force --no-interaction

    if [ "${AUTO_SEED_DEMO:-false}" = "true" ]; then
        php artisan db:seed --force --no-interaction
    fi
fi

php artisan config:cache
php artisan route:cache
php artisan view:cache

exec frankenphp run --config /etc/caddy/Caddyfile --adapter caddyfile
