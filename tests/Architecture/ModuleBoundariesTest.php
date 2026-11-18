<?php

declare(strict_types=1);

arch('domain modules enforce strict types')
    ->expect('App\Modules')
    ->toUseStrictTypes();

arch('support helpers enforce strict types')
    ->expect('App\Support')
    ->toUseStrictTypes();

arch('controllers do not bypass actions via DB facade')
    ->expect('App\Http\Controllers')
    ->not->toUse(['Illuminate\Support\Facades\DB']);

arch('domain modules do not depend on http layer')
    ->expect('App\Modules')
    ->not->toUse(['App\Http']);
