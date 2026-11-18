<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Modules\Identity\Queries\GetEvaluatorContextQuery;
use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    protected $rootView = 'app';

    public function __construct(
        private readonly GetEvaluatorContextQuery $getEvaluatorContext,
    ) {}

    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        return [
            ...parent::share($request),
            'evaluator' => fn (): array => $this->getEvaluatorContext->execute($request),
            'flash' => [
                'success' => fn (): mixed => $request->hasSession() ? $request->session()->get('success') : null,
                'error' => fn (): mixed => $request->hasSession() ? $request->session()->get('error') : null,
            ],
        ];
    }
}
