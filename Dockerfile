# syntax=docker/dockerfile:1

FROM node:22-alpine AS assets
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci
COPY vite.config.ts tsconfig.json ./
COPY resources ./resources
COPY public ./public
RUN npm run build

FROM dunglas/frankenphp:1-php8.4-alpine AS php-base
RUN install-php-extensions \
    pcntl \
    posix \
    pdo_sqlite \
    pdo_mysql \
    bcmath \
    intl \
    opcache \
    zip

FROM php-base AS vendor
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
WORKDIR /app
COPY composer.json composer.lock ./
RUN composer install \
    --no-dev \
    --no-interaction \
    --no-progress \
    --prefer-dist \
    --no-scripts \
    --optimize-autoloader

FROM php-base AS runtime
WORKDIR /app

ENV APP_NAME="Aurelia POS" \
    APP_ENV=production \
    APP_DEBUG=false \
    LOG_CHANNEL=stderr \
    LOG_LEVEL=warning \
    DB_CONNECTION=sqlite \
    DB_DATABASE=/tmp/database.sqlite \
    SESSION_DRIVER=database \
    SESSION_SECURE_COOKIE=true \
    CACHE_STORE=database \
    QUEUE_CONNECTION=database \
    BROADCAST_CONNECTION=log \
    BCRYPT_ROUNDS=10 \
    AUTO_SEED_DEMO=true \
    XDG_CONFIG_HOME=/tmp/caddy/config \
    XDG_DATA_HOME=/tmp/caddy/data \
    PORT=8080

RUN cp "$PHP_INI_DIR/php.ini-production" "$PHP_INI_DIR/php.ini" \
    && apk add --no-cache --virtual .cap-tools libcap \
    && setcap -r /usr/local/bin/frankenphp \
    && apk del .cap-tools
COPY docker/php-production.ini /usr/local/etc/php/conf.d/99-aurelia.ini
COPY docker/Caddyfile /etc/caddy/Caddyfile
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN sed -i 's/\r$//' /usr/local/bin/entrypoint.sh && chmod +x /usr/local/bin/entrypoint.sh

COPY --from=vendor /app/vendor /app/vendor
COPY . /app
COPY --from=assets /app/public/build /app/public/build

RUN mkdir -p \
        storage/framework/cache/data \
        storage/framework/sessions \
        storage/framework/views \
        storage/logs \
        bootstrap/cache \
    && chmod -R 775 storage bootstrap/cache \
    && DB_CONNECTION=sqlite DB_DATABASE=:memory: php artisan package:discover --ansi

EXPOSE 8080

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
