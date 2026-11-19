# Bistro Craft Design System & Responsive UI Implementation Plan

> **For agentic workers:** Execute continuously across Tasks 1–6 using `superpowers:executing-plans`. Keep `.superpowers/sdd/2026-11-19-bistro-craft-design-system/progress.md` updated at each milestone.

**Goal:** Implement the approved Bistro Craft Design System (`docs/superpowers/specs/2026-11-19-bistro-craft-design-system-design.md`) across all Aurelia POS & KDS screens with custom SVGs, microinteractions (`motion/react`), zero component clipping, zero horizontal overflow, and verified responsiveness across Desktop (`1440×900`), Tablet (`768×1024`), and Mobile (`375×812`).

**Architecture:** Frontend-only design system, primitives, layout shells, page upgrades, and optional verified dish photo wiring (`AureliaEnterpriseSeeder.php`). All domain logic, Laravel routes, Inertia prop contracts, DB schemas, and 62 Pest tests remain intact.

---

### Task 1: Typography, Surface Tokens & Core Design System Primitives
- **Files:**
  - Modify: `resources/views/app.blade.php` — add Google Fonts preconnect & stylesheet for `Plus Jakarta Sans` (400, 500, 600, 700, 800) and `JetBrains Mono` (500, 600, 700).
  - Modify: `resources/css/app.css` — codify warm 4-tier surface/elevation tokens (`--surface-canvas`, `--surface-card`, `--surface-inset`, `--surface-overlay`, `--shadow-card`, `--shadow-elevated`, `--shadow-floating`), `tabular-nums`, `.dark` KDS tokens (`#0D0F14` / `#161922`), and `ds-*` typographic utilities (`ds-page-title`, `ds-section-title`, `ds-card-title`, `ds-body`, `ds-label`, `ds-caption`, `ds-overline`, `ds-num-lg`, `ds-num-md`, `ds-num-sm`).
  - Modify: `resources/js/components/ui/button.tsx` — fix vertical clipping (`h-9` + `py-5` conflict) with explicit `sm` (`h-8`), `default` (`h-10`), `lg` (`h-11`), `xl` (`h-12`), `icon` (`h-10 w-10`) variants, tactile press feedback (`active:scale-[0.98]`), and optional `loading` spinner prop.
  - Modify: `resources/js/components/ui/card.tsx` — support clean surface elevation variants (`default`, `inset`, `interactive`).
  - Modify: `resources/js/components/ui/badge.tsx` — crisp semantic pill tokens aligned with Bistro Craft.
  - Modify: `resources/js/components/ui/tabs.tsx` — upgrade with `motion.div layoutId` animated active indicator (`AnimatedTabs` / compatible `Tabs` API).
  - Create: `resources/js/design-system/AureliaMark.tsx`, `IconBadge.tsx`, `StatusPill.tsx`, `StatCard.tsx`, `MotionOverlay.tsx` (`MotionModal` & `MotionDrawer`), `FloatingToaster.tsx`, `PinKeypad.tsx`, `DishArtwork.tsx`, and `index.ts`.
- **Verify:** `npm run types`, commit Task 1.

### Task 2: Dish Media, Navigation Shells & Authentication Screens
- **Files:**
  - Media retry: Invoke `image-generator` for `wagyu-smash-burger`, `charred-prime-ribeye`, `lobster-thermidor`, `yuzu-elderflower-spritz`; copy verified JPGs to `public/images/menu/` and update `database/seeders/AureliaEnterpriseSeeder.php` strictly for files verified on disk (zero 404 URLs).
  - Modify: `resources/js/components/menu/DishThumbnail.tsx` — lock `aspect-[16/10]` ratio, smooth image fade-in on load, bespoke multi-layer SVG `DishArtwork` fallback keyed by dish `slug`/`prep_station`.
  - Modify: `resources/js/layouts/PosAppLayout.tsx` — responsive shell: `lg:w-60` desktop sidebar with `layoutId` active indicator, `md` compact `w-20` tablet icon rail, `<md` sticky mobile header + `MotionDrawer` nav, `<FloatingToaster />` replacing top flow flash banners, zero horizontal overflow.
  - Modify: `resources/js/layouts/KitchenLayout.tsx` — `#0D0F14` KDS top bar, `AureliaMark`, live connection/station badges, `<FloatingToaster />`.
  - Modify: `resources/js/pages/Auth/TerminalLoginPage.tsx` — Bistro Craft editorial split card, clean `Button` sizes (zero `py-5`), responsive padding.
  - Modify: `resources/js/pages/Auth/StaffLockPage.tsx` — shared `PinKeypad` with spring dot fills and horizontal error shake, `MotionModal` manager terminal sign-out modal.
  - Modify: `resources/js/modules/pos/ManagerPinModal.tsx` — migrate to `MotionModal` + `PinKeypad`; remove `"Demo Branch Manager PIN: 1234"` hint.
- **Verify:** `npm run types`, commit Task 2.

### Task 3: Dashboard & Architectural Floor Plan
- **Files:**
  - Modify: `resources/js/pages/Dashboard/DashboardPage.tsx` — `StatCard` KPI row, smooth cubic-bezier Daily Sales SVG curve with gradient fill and interactive hover/focus tooltip, animated SVG ring donuts (Total Income & Table Status), Trending & Out-of-Stock editorial cards, responsive grid spacing (`p-6 lg:p-8`, `space-y-6`, `gap-5`), zero overflow at `375px`.
  - Modify: `resources/js/pages/Tables/TablesPage.tsx` — architectural zone filter tabs (`layoutId`), geometric square/round/banquet table tiles with perimeter seat capsules, `StatusPill`, `MotionModal` table inspection panel, custom empty state SVG.
  - Modify: `resources/js/modules/pos/TableTransferDialog.tsx` — migrate onto `MotionModal` + consistent `Button` sizing.
- **Verify:** `npm run types`, commit Task 3.

### Task 4: POS Terminal, Payment Experience & Orders Board
- **Files:**
  - Modify: `resources/js/modules/pos/NewOrderModal.tsx` — `MotionModal`, segmented Dine-in / Takeaway tabs, stepper controls, `size="lg"` CTA button.
  - Modify: `resources/js/modules/pos/ModifierSheet.tsx` — `MotionModal`, tactile variant/modifier option tiles, clean total CTA.
  - Modify: `resources/js/modules/billing/ThermalReceiptDialog.tsx` — `MotionModal` with crisp 80mm thermal paper presentation and print action.
  - Modify: `resources/js/modules/billing/RefundModal.tsx` — `MotionModal` + consistent buttons/inputs.
  - Modify: `resources/js/modules/billing/UnifiedPaymentModal.tsx` — `MotionModal`, serrated thermal receipt edge preview, tactile spring cash keypad buttons (`active:scale-[0.95]`), contactless Card Reader SVG with animated pulse rings, crisp QR frame, mobile-friendly vertical scroll.
  - Modify: `resources/js/pages/Pos/PosPage.tsx` — `md+` sticky right Order Detail rail with `AnimatePresence` line items & animated total; `<md` fixed floating mobile Order Bar + `MotionDrawer` full cart drawer so mobile checkout works seamlessly without endless scrolling.
  - Modify: `resources/js/pages/Orders/OrdersPage.tsx` — `AnimatedTabs` status filters, responsive `1/2/3`-column Bitepoint cards, `MotionDrawer` ticket inspection & actions.
- **Verify:** `npm run types`, commit Task 4.

### Task 5: Kitchen Display System & Back-Office Management Screens
- **Files:**
  - Modify: `resources/js/modules/kds/TicketCard.tsx`, `resources/js/modules/kds/KdsPanel.tsx`, `resources/js/pages/Kitchen/KitchenPage.tsx` — dark `#161922` / `#1D212B` KDS cards, SLA timer pills, bump microinteractions, mobile station pill horizontal scroll.
  - Modify: `resources/js/pages/Menu/MenuPage.tsx` — clean item grid with `DishThumbnail`, toggle switches (`86`'d vs active), `MotionModal` add/edit item form.
  - Modify: `resources/js/pages/Inventory/InventoryPage.tsx`, `resources/js/modules/inventory/InventoryStockDrawer.tsx` — `StatCard` alerts, `overflow-x-auto` responsive stock ledger, `MotionDrawer` restock/waste drawer.
  - Modify: `resources/js/pages/Reports/ReportsPage.tsx`, `resources/js/modules/reports/{BranchComparisonCards.tsx,RevenueAndPeakHoursChart.tsx,AuditTrailTable.tsx}` — custom animated SVG charts, `StatCard` summaries, `overflow-x-auto` audit trail.
  - Modify: `resources/js/pages/Shifts/ShiftsPage.tsx`, `resources/js/pages/Settings/SettingsPage.tsx` — uniform card spacing, `ds-*` typography, `MotionModal` dialogs, responsive forms & tables.
- **Verify:** `npm run types`, `npm run build`, `php vendor/bin/pest` (with `BypassSandbox: true`), commit Task 5.

### Task 6: Full Multi-Device Verification & Walkthrough
- Run `php artisan migrate:fresh --seed --no-interaction`.
- Ensure local Laravel server on `127.0.0.1:8000` is running.
- Run automated browser verification across Desktop (`1440×900`), Tablet (`768×1024`), and Mobile (`375×812`) covering `/login`, `/lock`, `/dashboard`, `/pos`, `/orders`, `/tables`, `/kitchen`, `/menu`, `/inventory`, `/reports`, `/shifts`, `/settings`:
  - Assert Google Fonts (`Plus Jakarta Sans`, `JetBrains Mono`) active.
  - Assert zero horizontal overflow (`document.documentElement.scrollWidth <= window.innerWidth`).
  - Assert zero vertically clipped buttons or missing images (`naturalWidth > 0`).
  - Test microinteractions (PIN shake, floating toast, modals, mobile POS drawer, UnifiedPaymentModal).
- Fix any defects found, re-run full `php vendor/bin/pest`, `npm run types`, `npm run build`, update SDD ledger, and commit final verification fixes.
