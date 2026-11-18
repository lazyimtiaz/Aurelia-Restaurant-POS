<?php

declare(strict_types=1);

it('returns a successful response on root visit', function (): void {
    $this->get('/')->assertOk();
});
