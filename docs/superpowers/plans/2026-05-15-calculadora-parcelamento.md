# Calculadora De Parcelamento Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an authenticated `Calculadora` menu and page that ports the installment simulator from `warrantyguard-hdi`.

**Architecture:** The feature is isolated in a new `pages/Calculator.tsx` route, wired through the existing `App.tsx`, `components/Layout.tsx`, and `lib/permissions.ts` patterns. Rates remain local to the browser through `localStorage`; no Supabase schema changes are needed.

**Tech Stack:** React 19, TypeScript, React Router, Tailwind CSS, lucide-react, Vitest, Testing Library.

---

## File Structure

- Create `pages/Calculator.tsx`: Ported calculator UI, calculation behavior, local rate config, and sharing actions.
- Create `pages/Calculator.test.tsx`: Focused behavior tests for rendering, calculation, band switching, and invalid sharing feedback.
- Modify `App.tsx`: Add lazy import and protected `/calculator` route.
- Modify `components/Layout.tsx`: Add the `Calculadora` navigation item using the `Calculator` icon.
- Modify `lib/permissions.ts`: Add `calculator` permission and default visibility for all roles.
- Modify `tests/smoke/smokeInventory.ts`: Add calculator menu path, role menu entries, and route anchor.
- Modify `components/Layout.permissions.test.tsx`: Assert calculator visibility follows permission state.

## Task 1: Add Calculator Tests First

**Files:**
- Create: `pages/Calculator.test.tsx`
- Create later: `pages/Calculator.tsx`

- [x] **Step 1: Write the failing tests**

Create `pages/Calculator.test.tsx` with tests that import `./Calculator`, render inside `ToastProvider`, enter `1000`, assert the `1x` total for `Visa / Master`, switch to `Elo / Hiper`, and assert invalid sharing shows the existing toast text.

- [x] **Step 2: Run calculator tests to verify RED**

Run: `npm run test:run -- pages/Calculator.test.tsx`

Expected: FAIL because `pages/Calculator.tsx` does not exist.

- [x] **Step 3: Port the calculator implementation**

Create `pages/Calculator.tsx` from `/Volumes/DEV/projetos/warrantyguard-hdi/src/pages/admin/Calculator.tsx`, adapting toast calls to `useToast()` from `../components/ui/ToastProvider`, adding defensive `localStorage` parsing, and adding dark-mode classes where needed.

- [x] **Step 4: Run calculator tests to verify GREEN**

Run: `npm run test:run -- pages/Calculator.test.tsx`

Expected: PASS.

## Task 2: Wire Route, Menu, And Permissions

**Files:**
- Modify: `App.tsx`
- Modify: `components/Layout.tsx`
- Modify: `lib/permissions.ts`
- Modify: `tests/smoke/smokeInventory.ts`
- Modify: `components/Layout.permissions.test.tsx`

- [x] **Step 1: Write/update failing navigation-permission tests**

Add expectations in `components/Layout.permissions.test.tsx` that `nav-link-calculator` is visible when the permission is visible and hidden when denied.

- [x] **Step 2: Run layout permission tests to verify RED**

Run: `npm run test:run -- components/Layout.permissions.test.tsx`

Expected: FAIL because no calculator nav item exists.

- [x] **Step 3: Add permission key and route**

Add `calculator` to `PermissionKey`, `PERMISSION_DEFINITIONS`, and `commonVisible` in `lib/permissions.ts`. Add lazy import and `/calculator` protected route in `App.tsx`.

- [x] **Step 4: Add menu item and smoke inventory**

Import `Calculator` icon in `components/Layout.tsx` and add the nav item in the `operation` group. Add `calculator: '/#/calculator'` to `menuPathByKey`, add it to all role menu key lists, and add a smoke route with heading anchor `Calculadora de Taxas`.

- [x] **Step 5: Run layout permission tests to verify GREEN**

Run: `npm run test:run -- components/Layout.permissions.test.tsx`

Expected: PASS.

## Task 3: Final Verification

**Files:**
- All files changed above.

- [x] **Step 1: Run focused tests**

Run: `npm run test:run -- pages/Calculator.test.tsx components/Layout.permissions.test.tsx`

Expected: PASS.

- [x] **Step 2: Run typecheck**

Run: `npm run typecheck`

Expected: PASS.

- [x] **Step 3: Review diff**

Run: `git diff -- pages/Calculator.tsx pages/Calculator.test.tsx App.tsx components/Layout.tsx lib/permissions.ts tests/smoke/smokeInventory.ts components/Layout.permissions.test.tsx docs/superpowers/plans/2026-05-15-calculadora-parcelamento.md`

Expected: Diff only covers calculator feature, plan, and tests.
