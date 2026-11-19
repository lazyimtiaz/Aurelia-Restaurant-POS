<?php

declare(strict_types=1);

it('redirects unauthenticated root requests to terminal login and renders login screen', function (): void {
    $this->withoutVite();

    $this->get('/')->assertRedirect('/login');
    $this->get('/login')->assertOk();
});
