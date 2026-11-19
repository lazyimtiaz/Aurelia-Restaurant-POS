# Bistro Craft Design System & Microinteractions Specification

## 1. Intent & Why
An audit of the redesigned POS frontend identified several systemic visual and UX flaws that make the interface feel unfinished:
- **Missing Web Fonts & Numeric Alignment:** `app.blade.php` loads no font stylesheets, causing typography to fall back to generic system fonts without consistent weights or `tabular-nums` alignment for currency and timers.
- **Component Overflow & Spacing Drift:** `Button` hardcodes `h-9` (36px) while screens pass `py-5` (40px vertical padding), clipping controls. Card padding, grid gaps, and section margins drift inconsistently across pages, and circular/wide floor-plan tables risk overflowing narrow cells.
- **Flat Card Hierarchy & Empty Placeholders:** 4 of 6 menu cards display tiny icons inside empty pastel rectangles beside real studio photos; surfaces lack warm layered elevation; flash alerts render as full-width strips that shift the layout downward.
- **Missing Motion & Tactile Feedback:** `motion` v14 (`motion/react`) is installed, yet modals and drawers snap in abruptly without `AnimatePresence`, navigation links and tabs lack sliding indicators, invalid PIN entry lacks a shake cue, and cart updates lack tactile feedback.

Approach **A ("Bistro Craft")** establishes a unified warm hospitality design system across tokens, typography, icons, dish visuals, primitives, motion, and every POS/back-office workspace (keeping KDS intentionally dark and high-contrast).

---

## 2. Design System Foundations

### 2.1 Typography & Web Fonts (`resources/views/app.blade.php`, `resources/css/app.css`)
- **Primary Sans:** `Plus Jakarta Sans` (weights `400`, `500`, `600`, `700`, `800`) loaded cleanly via Google Fonts with `display=swap` fallback stack.
- **Monospace Numerals:** `JetBrains Mono` (weights `500`, `600`, `700`) with `font-variant-numeric: tabular-nums` enforced on all prices, counts, SKUs, and live SLA timers (`ds-num-lg`, `ds-num-md`, `ds-num-sm`).
- **Strict Type Scale (zero arbitrary `text-[10px]` / `text-[11px]` drift):**
  - `ds-page-title`: `1.375rem` (22px), `700`, `-0.02em`
  - `ds-section-title`: `1rem` (16px), `700`, `-0.01em`
  - `ds-card-title`: `0.9375rem` (15px), `600`
  - `ds-body`: `0.875rem` (14px), `400/500`, `1.45` leading
  - `ds-label`: `0.8125rem` (13px), `600`
  - `ds-caption`: `0.75rem` (12px), `500`
  - `ds-overline`: `0.6875rem` (11px), `700`, uppercase, `0.06em` tracking

### 2.2 Warm Surface, Border & Elevation Tokens
- **Light Canvas & Surfaces:**
  - Page canvas: `#F7F4EF` (warm linen neutral)
  - Elevated card (`--card`): `#FFFFFF` with `#EAE4DB` hairline border and layered warm shadow (`0 1px 2px rgba(28,25,23,0.04), 0 4px 12px rgba(28,25,23,0.03)`)
  - Inset tray / soft well: `#FBF9F6` with `#EEE8DE` border
  - Hover / interactive lift: `0 6px 20px rgba(28,25,23,0.06)` + `-1px` translate
  - Modal / floating toast overlay: `0 18px 48px rgba(28,25,23,0.16)` with backdrop blur
- **Dark KDS Surface (`.dark` preserved exclusively for `/kitchen`):**
  - Canvas `#0D0F14`, ticket card `#161922`, hairline border `#262B38`, warm amber active focus `#FB923C`.
- **Primary & Semantic Palette:**
  - Primary Terracotta-Orange `#EA580C` (hover `#C2410C`, tint `#FFF4ED`, border `#FED7AA`)
  - Emerald Ready/Available (`#15803D` / `#ECFDF5` / `#BBF7D0`)
  - Amber In-Progress/Warning (`#B45309` / `#FFFBEB` / `#FDE68A`)
  - Rose Urgent/Declined/Occupied-Alert (`#BE123C` / `#FFF1F2` / `#FECDD3`)
  - Stone Cleaning/Neutral (`#57534E` / `#F5F2EC` / `#E7E2DA`)

### 2.3 Strict Spacing & Control Sizing Rules
- **Layout Rhythm:** Page shell padding `p-6 lg:p-8`; vertical section stack `space-y-6`; card grid gap `gap-5`; internal card padding `p-5` (compact) or `p-6` (standard).
- **Zero-Overflow Controls:** `Button` variants cleanly enforce non-colliding heights (`sm: h-8 px-3`, `default: h-10 px-4`, `lg: h-12 px-6`, `xl: h-13 px-6 text-base`) — banning conflicting `h-*` + `py-*` overrides across every page.
- **Text & Container Guards:** Mandatory `min-w-0` + `truncate` on flex text children, explicit responsive `aspect-[16/10]` thumbnails, and `overflow-x-auto` / fluid min-widths for tables and floor-plan grids so nothing clips at `1024×768`, `1280×800`, or `1440×900`.

---

## 3. Custom Brand SVG, Icons & Dish Visuals
- **Brand Crest (`AureliaMark`):** Bespoke geometric dome/fork-and-ember SVG emblem in terracotta-orange replacing generic `UtensilsCrossed` icons in sidebar, terminal login, and lock screen.
- **Iconography Grammar:** Uniform `1.75` stroke weight across Lucide icons inside duotone `IconBadge` containers (rounded-xl/full warm tinted backgrounds).
- **Dish Imagery:** Attempt generating the 4 missing studio dish photos (`wagyu-smash-burger`, `charred-prime-ribeye`, `lobster-thermidor`, `yuzu-elderflower-spritz`) staggered sequentially with backoff to avoid rate-limiting; pair with `DishArtwork.tsx` custom multi-layer SVG culinary illustrations as zero-404 editorial fallback so every dish card looks cohesive and appetite-appealing.

---

## 4. Core Design System & Microinteraction Primitives (`resources/js/design-system/` + `resources/js/components/ui/`)
1. **Primitives:**
   - `Button` (non-clipping height tokens, spinner loading state, `active:scale-[0.98]` press feel)
   - `Card` (`default`, `interactive` hover-lift, `inset` variants)
   - `StatusPill` (consistent rounded-full status chips with optional live pulse dot)
   - `StatCard` (KPI metric tile with `IconBadge`, `ds-num-lg`, subtitle trend/context)
   - `AureliaMark` & `IconBadge`
   - `DishArtwork` & `DishThumbnail` (aspect-locked image frame + custom vector fallback)
2. **Motion & Overlay Primitives (`motion/react`):**
   - `MotionModal` & `MotionDrawer` (`AnimatePresence` backdrop fade + spring `scale(0.96)->1` / slide-over, Escape key close, strict `max-h-[90vh]` internal scrolling)
   - `FloatingToaster` (fixed top-right animated toast replacing full-width layout-shifting flash banners; auto-dismisses cleanly with manual close)
   - `AnimatedTabs` (shared `motion.div layoutId` active pill across Dashboard/Reports/Orders/Menu)
   - `PinKeypad` (shared tactile PIN pad with spring-scaled PIN dots and horizontal `[-8, 8, -5, 5, 0]` shake on error; replaces duplicated PIN pad code in `StaffLockPage` and `ManagerPinModal`, and removes the leftover `"Demo Branch Manager PIN: 1234"` hint from `ManagerPinModal.tsx`).

---

## 5. Screen-by-Screen Design Upgrades & Anti-Overflow Fixes
- **`PosAppLayout`:** Smooth sliding `layoutId` sidebar nav highlight, `AureliaMark`, consistent top bar spacing, `FloatingToaster` for flash notices, fixed `md:flex` tablet+ sidebar + responsive mobile nav strip.
- **`TerminalLoginPage` & `StaffLockPage`:** Editorial centered terminal sign-in card with `AureliaMark`; lock screen with role-tinted staff cards, shared `PinKeypad`, error shake, and `MotionModal` sign-out confirmation.
- **`DashboardPage`:** 4 balanced `StatCard` KPIs, smooth cubic-bezier SVG Daily Sales area chart with interactive point hover tooltip, clean SVG donut charts with centered `ds-num-lg` metrics, Live Orders rows, Trending Dishes with `DishThumbnail`, Out-of-Stock cards.
- **`TablesPage`:** Architectural floor-plan table geometry with perimeter seat capsules around round (`capacity <= 2`), square (`3–4`), and rectangular (`6+`) tables, minimum grid width guarantees preventing collision, `StatusPill`, running `$` tab + elapsed timer, and `MotionModal` action panel.
- **`PosPage` & `OrdersPage` & `UnifiedPaymentModal`:** Uniform `16:10` menu grid with quantity/option feedback pulse, right sticky Order Detail column with animated draft/fired item insertion/removal (`AnimatePresence`), smooth `total_cents` highlight pulse; Bitepoint-style 3-column `/orders` board with `MotionDrawer` details; two-column `UnifiedPaymentModal` inside `MotionModal` featuring tactile Cash keypad + live change and Simulated Card Reader contactless wave animation.
- **Back-Office & Dark KDS (`KitchenPage`, `MenuPage`, `InventoryPage`, `ReportsPage`, `ShiftsPage`, `SettingsPage`):** Unified spacing tokens, `AnimatedTabs`, `MotionDrawer` forms, crisp `tabular-nums` alignment, and dark `#0D0F14` KDS ticket cards with live SLA urgency pulses.

---

## 6. Non-Goals, Constraints & Verification
- **Non-Goals:** No backend domain, schema, billing math, or auth policy rewrites (`MenuItem.image_path` updates only if the 4 dish photos generate cleanly).
- **Constraints:** Zero demo/evaluator hints anywhere in the UI (including removing `"Demo Branch Manager PIN: 1234"` from `ManagerPinModal.tsx`).
- **Verification Gate:** All 62 Pest tests (`php vendor/bin/pest`), `npm run types`, `npm run build`, and live browser inspection across both `1440×900` and `1024×768` viewports must pass with zero clipped buttons, zero horizontal overflow, loaded `Plus Jakarta Sans` + `JetBrains Mono` fonts, working microinteractions, and zero console/network errors.
