# Regular Restaurant POS Auth & UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or subagent-driven-development) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the app from an evaluator demo into an authentic two-layer Restaurant POS (Terminal Sign-In + Staff PIN Lock Screen, real role-based workspaces and 403 guards) with a warm-light hospitality UI (dark KDS preserved).

**Architecture:** Replaces `GetEvaluatorContextQuery` and `EvaluatorControlBar` with `CurrentStaffContext` backed by session-bound terminal credentials (`terminal_user_id`, `terminal_branch_id`) and active staff PIN session (`staff_user_id`, `staff_last_activity_at`, `active_branch_id`). Preserves all existing domain modules, integer-cent calculations, state machines, Reverb broadcasts, and Horizon inventory jobs while rebuilding controllers and React/Inertia screens to match real hospitality workflows.

**Tech Stack:** Laravel 13, PHP 8.3+, Inertia.js 2, React 19, TypeScript, Tailwind CSS v4, `shadcn/ui`, `motion.dev`, SQLite (WAL) / MySQL 8.4, Reverb, Horizon, Pest 4.

**Spec:** [2026-11-19-regular-pos-auth-and-ui-redesign-design.md](file:///c:/Users/DELL/Desktop/Laravel%20Portfolio/Restaurant%20POS/docs/superpowers/specs/2026-11-19-regular-pos-auth-and-ui-redesign-design.md)

## Global Constraints
- `declare(strict_types=1);` in all `app/Modules/` and `app/Support/` files; `ModuleBoundariesTest` must pass (`Controllers` never import `DB`, `Modules` never import `App\Http`).
- All money in `*_cents`, rates in `*_bps`, zero floats; SQLite + MySQL 8.4 parity.
- Zero demo/evaluator chrome anywhere in UI (no Evaluator Bar, no global simulation toggles, no PIN hints in UI, no Split-Screen demo page). Credentials live in `README.md` only.
- Protected routes enforce `403` server-side via `EnsureRole`, not just hidden navigation links.
- Dark theme preserved exclusively on Kitchen KDS (`/kitchen`); warm-light theme across all other screens.

## Review Focus
1. **Unauthenticated & Lock State Transitions:** Visiting any POS route without a signed-in terminal redirects to `/login`; visiting with a signed-in terminal before PIN unlock (or after 10 min idle timeout) redirects to `/lock`.
2. **Terminal Branch Binding & Cross-Branch Staff Guard:** Non-manager roles cannot sign in `/login`. Only staff belonging to the terminal's branch (or company-wide Owner/Admin) can unlock on `/lock`.
3. **PIN Brute-Force Lockout & Audit:** 5 failed PIN attempts rate-limit further attempts for that terminal+staff pair and record critical `AuditLog` events.
4. **Role Route Enforcement (`403`):** Every protected section (`dashboard`, `pos`, `orders`, `tables`, `kitchen`, `menu`, `inventory`, `reports`, `shifts`, `settings`) denies unauthorized roles with HTTP `403`.
5. **Simulated Card Terminal Decline Recovery:** Card tender exercises `BillSplitState::Failed` via an explicit `simulate_decline` flag on `/billing/splits/{id}/pay`, preserving `OrderState::PartiallyPaid` and allowing Cash/QR/Approved Card retry.

---

## Tasks
1. **Task 1:** Two-layer Terminal Auth & Staff PIN Lock backend (`StaffRole` capabilities, `SignInTerminalAction`, `UnlockStaffByPinAction`, `CurrentStaffContext`, `EnsureTerminalSignedIn`/`EnsureStaffUnlocked`/`EnsureRole`, controllers, seeder PINs & sample historical sales, `TerminalAndStaffAuthTest`).
2. **Task 2:** Menu photo migration + generated food images, `GetDashboardOverviewQuery`, `Orders` board query, refactor all controllers off evaluator context & wire new clean routes.
3. **Task 3:** Warm-light CSS tokens, `PosAppLayout` (left sidebar + Owner/Admin branch dropdown), dark `KitchenLayout`, `TerminalLoginPage`, `StaffLockPage` (with 4-digit PIN pad).
4. **Task 4:** `DashboardPage` (`/dashboard`) & floor-plan `TablesPage` (`/tables`).
5. **Task 5:** `PosPage` (`/pos`) + `NewOrderModal`, `OrdersPage` (`/orders`), `UnifiedPaymentModal` (with Cash keypad + Simulated Card Reader step).
6. **Task 6:** `KitchenPage` (`/kitchen`), `MenuPage` (`/menu`), `InventoryPage` (`/inventory`), `ReportsPage` (`/reports`), `ShiftsPage` (`/shifts`), `SettingsPage` (`/settings`) + clean removal of old evaluator TSX files.
7. **Task 7:** Rewrite all HTTP Inertia tests for real terminal login → PIN unlock + role 403 assertions; update `README.md`.
8. **Task 8:** Full Pest suite + `npm run types` + `npm run build` + `migrate:fresh --seed` + live browser walkthrough across every workspace.
