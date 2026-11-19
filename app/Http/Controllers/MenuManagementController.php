<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Modules\Identity\Services\CurrentStaffContext;
use App\Modules\Menu\Actions\CreateMenuItemAction;
use App\Modules\Menu\Actions\SetBranchPriceOverrideAction;
use App\Modules\Menu\Actions\ToggleBranchItemAvailabilityAction;
use App\Modules\Menu\Enums\PrepStation;
use App\Modules\Menu\Queries\GetBranchCatalogQuery;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use InvalidArgumentException;

final class MenuManagementController extends Controller
{
    public function index(
        Request $request,
        CurrentStaffContext $staffContext,
        GetBranchCatalogQuery $getBranchCatalog,
    ): Response {
        $branch = $staffContext->requireActiveBranch($request);

        return Inertia::render('Menu/MenuPage', [
            'catalog' => $getBranchCatalog->execute($branch->id)->values()->all(),
            'stations' => array_map(
                static fn (PrepStation $s): array => [
                    'value' => $s->value,
                    'label' => $s->label(),
                ],
                PrepStation::cases(),
            ),
        ]);
    }

    public function storeItem(
        Request $request,
        CurrentStaffContext $staffContext,
        CreateMenuItemAction $createMenuItem,
    ): RedirectResponse {
        $validated = $request->validate([
            'menu_category_id' => ['required', 'integer', 'exists:menu_categories,id'],
            'name' => ['required', 'string', 'max:120'],
            'description' => ['nullable', 'string', 'max:280'],
            'prep_station' => ['required', Rule::enum(PrepStation::class)],
            'variant_name' => ['nullable', 'string', 'max:80'],
            'sku' => ['required', 'string', 'max:64', 'unique:menu_item_variants,sku'],
            'base_price_cents' => ['required', 'integer', 'min:0'],
        ]);

        $staff = $staffContext->requireStaff($request);
        $branch = $staffContext->requireActiveBranch($request);

        try {
            $item = $createMenuItem->execute(
                branchId: $branch->id,
                menuCategoryId: (int) $validated['menu_category_id'],
                name: (string) $validated['name'],
                description: $validated['description'] ?? null,
                prepStation: PrepStation::from($validated['prep_station']),
                variantName: (string) ($validated['variant_name'] ?: 'Standard'),
                sku: (string) $validated['sku'],
                basePriceCents: (int) $validated['base_price_cents'],
                actorUserId: $staff->id,
            );
        } catch (InvalidArgumentException $e) {
            return back()->with('error', $e->getMessage());
        }

        return back()->with('success', "Added '{$item->name}' to the menu catalog.");
    }

    public function toggleAvailability(
        Request $request,
        int $variantId,
        CurrentStaffContext $staffContext,
        ToggleBranchItemAvailabilityAction $toggleAvailability,
    ): RedirectResponse {
        $validated = $request->validate([
            'is_available' => ['required', 'boolean'],
            'reason' => ['nullable', 'string', 'max:180'],
        ]);

        $staff = $staffContext->requireStaff($request);
        $branch = $staffContext->requireActiveBranch($request);

        $toggleAvailability->execute(
            branchId: $branch->id,
            variantId: $variantId,
            isAvailable: (bool) $validated['is_available'],
            reason: $validated['reason'] ?? null,
            actorUserId: $staff->id,
        );

        return back()->with('success', 'Item availability updated.');
    }

    public function setPriceOverride(
        Request $request,
        int $variantId,
        CurrentStaffContext $staffContext,
        SetBranchPriceOverrideAction $setPriceOverride,
    ): RedirectResponse {
        $validated = $request->validate([
            'price_override_cents' => ['nullable', 'integer', 'min:0'],
        ]);

        $staff = $staffContext->requireStaff($request);
        $branch = $staffContext->requireActiveBranch($request);

        try {
            $setPriceOverride->execute(
                branchId: $branch->id,
                variantId: $variantId,
                priceOverrideCents: isset($validated['price_override_cents'])
                    ? (int) $validated['price_override_cents']
                    : null,
                actorUserId: $staff->id,
            );
        } catch (InvalidArgumentException $e) {
            return back()->with('error', $e->getMessage());
        }

        return back()->with('success', 'Branch price override saved.');
    }
}
