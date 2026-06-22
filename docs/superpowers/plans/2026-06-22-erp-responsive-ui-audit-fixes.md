# ERP Responsive UI Audit Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the ERP UI audit into working, testable fixes for desktop, iPhone/iOS, and iPad without changing business behavior.

**Architecture:** Add a small responsive contract that names phone/tablet/desktop decisions, then apply it in the shell, operational lists, modals, feedback, forms, and destructive actions. Keep changes incremental and measurable: 44 px touch targets, repo typography tokens, explicit ARIA, inline field errors, and platform-specific layout cutoffs. Avoid a broad redesign; reuse existing primitives (`Modal`, `ConfirmDialog`, `ToastProvider`, `Banner`, `ios-card`, `ios-button-*`, `hit-target-44`).

**Tech Stack:** React 19, Vite, TypeScript, Tailwind utility classes, custom CSS in `index.css`, Vitest + Testing Library, Playwright smoke checks where authentication is available.

## Global Constraints

- UI copy remains Brazilian Portuguese.
- Do not touch n8n workflow files; this plan is frontend-only.
- Preserve unrelated existing changes in the worktree.
- Use `apply_patch` for file edits.
- Minimum touch target is 44×44 px using `hit-target-44`, `min-h-[44px]`, or `w-11 h-11`.
- Use `text-ios-*` typography tokens; avoid new `text-[10px]` and `text-[11px]` in interactive ERP UI.
- Validation errors for fields are inline, not toast.
- Destructive confirmations use `toast.confirm()` / `ConfirmDialog`, not `window.confirm`.
- Tablet contract: phone `<768px`, tablet `768–1279px`, desktop `>=1280px`.
- Operational content contract: dense tables and desktop two-pane summaries start at `>=1024px`; phone and iPad portrait use card/list layouts.
- Run focused tests after each task and finish with `npm run lint`, `npm run typecheck`, and relevant Vitest/Playwright checks.

---

## File Structure

- Create `lib/erpResponsive.ts`
  - Defines named breakpoints and pure helpers used by hooks, components, and tests.
- Modify `hooks/useIsMobileViewport.ts`
  - Keep the existing generic hook; consumers pass the new constants instead of hardcoded numbers.
- Modify `components/Layout.tsx`
  - Adds the tablet shell: compact/expanded sidebar from `md`, hides phone header/tab bar from `md`, keeps full desktop sidebar at `xl`.
- Modify `index.css`
  - Removes global uppercase, fixes mobile touch target shrinkage, adds tablet shell classes, keeps phone-only compact rules scoped to `<768px`.
- Modify `pages/Inventory.tsx`
  - Uses compact operational layout until `1023px`, improves search ARIA, changes table-only columns to `lg`, fixes card labels.
- Modify `pages/Finance.tsx`
  - Uses compact operational layout until `1023px`, fixes `text-ios-caption-1`, adds search ARIA, and implements CSV export for the false download action.
- Modify `pages/PDV.tsx`
  - Fixes step touch targets/typography and replaces native duplicate deletion confirm.
- Modify `pages/Settings.tsx`
  - Replaces native confirms, fixes small icon controls, keeps tablet grids at two columns before desktop.
- Modify `components/StockFormModal.tsx`
  - Replaces native delete confirm and ensures destructive flow uses the design-system dialog.
- Modify `components/AddCustomerModal.tsx`
  - Moves required-field validation inline.
- Modify `components/AddSellerModal.tsx`
  - Moves required-field/password validation inline and exposes loading semantics.
- Modify `components/ui/Banner.tsx`
  - Makes dismiss button 44×44.
- Modify `components/ui/Modal.tsx`
  - Applies reduced motion to entry/exit variants and makes non-clickable backdrops non-interactive.
- Modify `components/ui/ToastViewport.tsx`
  - Offsets mobile toasts above the phone tab bar.
- Create/modify tests:
  - `lib/erpResponsive.test.ts`
  - `components/ui/Banner.test.tsx`
  - `components/ui/Modal.test.tsx`
  - `components/AddCustomerModal.test.tsx`
  - `components/AddSellerModal.test.tsx`
  - `pages/Inventory.test.tsx`
  - `pages/Finance.test.tsx`
  - `pages/PDV.test.tsx`
  - `pages/Settings.test.tsx`
  - `components/StockFormModal.test.tsx`
  - `tests/smoke/erp-responsive-ui.spec.ts`

---

### Task 1: Responsive Contract

**Files:**
- Create: `lib/erpResponsive.ts`
- Create: `lib/erpResponsive.test.ts`
- Modify: `hooks/useIsMobileViewport.ts`

**Interfaces:**
- Consumes: existing `useIsMobileViewport(maxWidth?: number): boolean`.
- Produces:
  - `ERP_PHONE_MAX_WIDTH: 767`
  - `ERP_TABLET_MIN_WIDTH: 768`
  - `ERP_TABLET_MAX_WIDTH: 1279`
  - `ERP_DESKTOP_MIN_WIDTH: 1280`
  - `ERP_COMPACT_CONTENT_MAX_WIDTH: 1023`
  - `type ErpViewportClass = 'phone' | 'tablet' | 'desktop'`
  - `classifyErpViewport(width: number): ErpViewportClass`
  - `isCompactOperationalViewport(width: number): boolean`

- [ ] **Step 1: Write the failing breakpoint tests**

Create `lib/erpResponsive.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  ERP_COMPACT_CONTENT_MAX_WIDTH,
  ERP_DESKTOP_MIN_WIDTH,
  ERP_PHONE_MAX_WIDTH,
  ERP_TABLET_MAX_WIDTH,
  ERP_TABLET_MIN_WIDTH,
  classifyErpViewport,
  isCompactOperationalViewport,
} from './erpResponsive';

describe('ERP responsive contract', () => {
  it('names the platform breakpoint boundaries', () => {
    expect(ERP_PHONE_MAX_WIDTH).toBe(767);
    expect(ERP_TABLET_MIN_WIDTH).toBe(768);
    expect(ERP_TABLET_MAX_WIDTH).toBe(1279);
    expect(ERP_DESKTOP_MIN_WIDTH).toBe(1280);
    expect(ERP_COMPACT_CONTENT_MAX_WIDTH).toBe(1023);
  });

  it.each([
    [375, 'phone'],
    [767, 'phone'],
    [768, 'tablet'],
    [834, 'tablet'],
    [1024, 'tablet'],
    [1194, 'tablet'],
    [1279, 'tablet'],
    [1280, 'desktop'],
    [1440, 'desktop'],
  ] as const)('classifies %ipx as %s', (width, expected) => {
    expect(classifyErpViewport(width)).toBe(expected);
  });

  it.each([
    [767, true],
    [834, true],
    [1023, true],
    [1024, false],
    [1194, false],
    [1280, false],
  ] as const)('uses compact operational content=%s at %ipx', (width, expected) => {
    expect(isCompactOperationalViewport(width)).toBe(expected);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npx vitest run lib/erpResponsive.test.ts
```

Expected: FAIL because `./erpResponsive` does not exist.

- [ ] **Step 3: Implement the responsive contract**

Create `lib/erpResponsive.ts`:

```ts
export const ERP_PHONE_MAX_WIDTH = 767;
export const ERP_TABLET_MIN_WIDTH = 768;
export const ERP_TABLET_MAX_WIDTH = 1279;
export const ERP_DESKTOP_MIN_WIDTH = 1280;
export const ERP_COMPACT_CONTENT_MAX_WIDTH = 1023;

export type ErpViewportClass = 'phone' | 'tablet' | 'desktop';

export const classifyErpViewport = (width: number): ErpViewportClass => {
  if (width <= ERP_PHONE_MAX_WIDTH) return 'phone';
  if (width <= ERP_TABLET_MAX_WIDTH) return 'tablet';
  return 'desktop';
};

export const isCompactOperationalViewport = (width: number): boolean =>
  width <= ERP_COMPACT_CONTENT_MAX_WIDTH;
```

Keep `hooks/useIsMobileViewport.ts` generic. Add a comment so future callers know where project breakpoints live:

```ts
// ERP-specific breakpoint constants live in lib/erpResponsive.ts.
// Keep this hook generic so callers can opt into phone-only or compact-content behavior.
```

- [ ] **Step 4: Run the focused test**

Run:

```bash
npx vitest run lib/erpResponsive.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/erpResponsive.ts lib/erpResponsive.test.ts hooks/useIsMobileViewport.ts
git commit -m "feat: define ERP responsive contract"
```

---

### Task 2: Tablet Shell Layout

**Files:**
- Modify: `components/Layout.tsx`
- Modify: `index.css`
- Modify: `components/Layout.permissions.test.tsx`

**Interfaces:**
- Consumes: no Task 1 runtime import required; this task uses Tailwind breakpoints (`md`, `lg`, `xl`) directly.
- Produces: a shell where phone uses top header + bottom tab bar, tablet uses sidebar from `md`, and desktop keeps full sidebar at `xl`.

- [ ] **Step 1: Add failing layout tests for tablet shell classes**

In `components/Layout.permissions.test.tsx`, add this test near existing layout tests:

```tsx
it('uses tablet sidebar shell classes instead of phone tab bar classes at md and above', () => {
  renderWithProviders(<Layout><div>Conteúdo</div></Layout>);

  const shell = screen.getByTestId('app-shell');
  expect(shell).toHaveClass('app-shell-bg');

  const sidebar = screen.getByTestId('erp-sidebar');
  expect(sidebar.className).toContain('hidden');
  expect(sidebar.className).toContain('md:flex');
  expect(sidebar.className).toContain('md:w-20');
  expect(sidebar.className).toContain('lg:w-64');
  expect(sidebar.className).toContain('xl:w-72');

  const phoneHeader = screen.getByTestId('erp-phone-header');
  expect(phoneHeader.className).toContain('md:hidden');

  const desktopHeader = screen.getByTestId('erp-desktop-header');
  expect(desktopHeader.className).toContain('hidden');
  expect(desktopHeader.className).toContain('md:flex');

  const bottomNav = screen.getByTestId('erp-bottom-nav');
  expect(bottomNav.className).toContain('md:hidden');
});
```

- [ ] **Step 2: Run the layout test to verify it fails**

Run:

```bash
npx vitest run components/Layout.permissions.test.tsx -t "tablet sidebar shell"
```

Expected: FAIL because the `data-testid` attributes and `md:*` classes are not present.

- [ ] **Step 3: Add semantic test IDs and tablet sidebar classes**

In `components/Layout.tsx`, change the shell root from:

```tsx
<div className="app-shell-bg flex min-h-[100svh] w-full max-w-full overflow-x-clip xl:h-[100dvh] xl:overflow-y-hidden">
```

to:

```tsx
<div data-testid="app-shell" className="app-shell-bg flex min-h-[100svh] w-full max-w-full overflow-x-clip md:h-[100dvh] md:overflow-y-hidden">
```

Change the sidebar from:

```tsx
<aside className="hidden xl:flex flex-col w-72 bg-white dark:bg-surface-dark-100 border-r border-gray-200 dark:border-surface-dark-200 shadow-ios">
```

to:

```tsx
<aside data-testid="erp-sidebar" className="hidden md:flex flex-col md:w-20 lg:w-64 xl:w-72 bg-white dark:bg-surface-dark-100 border-r border-gray-200 dark:border-surface-dark-200 shadow-ios transition-[width] duration-200">
```

In sidebar nav links, change the icon/text block from:

```tsx
<item.icon size={20} className="relative z-10" />
<span className="font-medium relative z-10">{item.label}</span>
```

to:

```tsx
<item.icon size={20} className="relative z-10 shrink-0" />
<span className="hidden lg:inline font-medium relative z-10 truncate">{item.label}</span>
```

Change group headers from:

```tsx
<p className="ios-section-header px-2">{group.label}</p>
```

to:

```tsx
<p className="hidden lg:block ios-section-header px-2">{group.label}</p>
```

Change the mobile header from:

```tsx
<header className="xl:hidden sticky top-0 h-[calc(52px+env(safe-area-inset-top,0px))] liquid-glass-thin border-b border-gray-200/40 dark:border-surface-dark-200/40 flex items-center justify-between px-3 sm:px-4 z-20 safe-area-top">
```

to:

```tsx
<header data-testid="erp-phone-header" className="md:hidden sticky top-0 h-[calc(52px+env(safe-area-inset-top,0px))] liquid-glass-thin border-b border-gray-200/40 dark:border-surface-dark-200/40 flex items-center justify-between px-3 sm:px-4 z-20 safe-area-top">
```

Change the desktop/tablet header from:

```tsx
<header className="hidden xl:flex h-12 liquid-glass-thin border-b border-gray-200/40 dark:border-surface-dark-200/40 items-center justify-between px-6 z-10">
```

to:

```tsx
<header data-testid="erp-desktop-header" className="hidden md:flex h-12 liquid-glass-thin border-b border-gray-200/40 dark:border-surface-dark-200/40 items-center justify-between px-4 lg:px-6 z-10">
```

Change all phone-only “more menu” wrappers from `xl:hidden` to `md:hidden`:

```tsx
className="md:hidden fixed inset-0 z-40 liquid-glass-strong"
className="md:hidden fixed bottom-[calc(env(safe-area-inset-bottom,0px)+84px)] left-4 right-4 z-50"
```

Change the bottom nav from:

```tsx
<nav className="xl:hidden fixed bottom-0 left-0 right-0 z-30 liquid-glass border-t border-gray-200/40 dark:border-surface-dark-200/40 safe-area-bottom">
```

to:

```tsx
<nav data-testid="erp-bottom-nav" className="md:hidden fixed bottom-0 left-0 right-0 z-30 liquid-glass border-t border-gray-200/40 dark:border-surface-dark-200/40 safe-area-bottom">
```

Change main scroll containment from:

```tsx
<main ref={mainRef} className="flex-1 min-w-0 max-w-full overflow-x-clip xl:overflow-y-auto bg-surface-light-100 dark:bg-surface-dark-50 relative" style={{ overscrollBehaviorY: 'contain' }}>
```

to:

```tsx
<main ref={mainRef} className="flex-1 min-w-0 max-w-full overflow-x-clip md:overflow-y-auto bg-surface-light-100 dark:bg-surface-dark-50 relative" style={{ overscrollBehaviorY: 'contain' }}>
```

Change page padding from:

```tsx
<div className="px-4 pt-2 pb-[calc(8rem+env(safe-area-inset-bottom,0px))] md:px-6 md:pt-3 xl:px-8 xl:pt-4 xl:pb-8">
```

to:

```tsx
<div className="px-4 pt-2 pb-[calc(8rem+env(safe-area-inset-bottom,0px))] md:px-6 md:pt-3 md:pb-8 xl:px-8 xl:pt-4">
```

- [ ] **Step 4: Adjust sidebar spacing for tablet**

In `components/Layout.tsx`, change sidebar nav/link spacing so icon-only tablet does not look cramped:

```tsx
<nav className="flex-1 p-3 lg:p-4 space-y-4 lg:space-y-5 overflow-y-auto">
```

and link classes:

```tsx
className={`relative flex items-center justify-center lg:justify-start gap-3 px-3 lg:px-4 py-3 rounded-ios-lg transition-colors duration-200 ${
  active
    ? 'text-white'
    : 'text-gray-600 dark:text-surface-dark-600 hover:bg-gray-100 dark:hover:bg-surface-dark-200 hover:text-gray-900 dark:hover:text-white'
}`}
```

For the CRM Plus button in the sidebar footer, use:

```tsx
className="w-full flex items-center justify-center lg:justify-start gap-3 px-3 lg:px-4 py-3 rounded-ios-lg bg-brand-50 dark:bg-brand-900/25 text-brand-700 dark:text-brand-300 hover:bg-brand-100 dark:hover:bg-brand-900/35 transition-colors"
```

and hide its label on tablet:

```tsx
<span className="hidden lg:inline font-medium">{isOpeningCrm ? 'Abrindo CRM Plus...' : 'Abrir CRM Plus'}</span>
```

- [ ] **Step 5: Run the layout tests**

Run:

```bash
npx vitest run components/Layout.permissions.test.tsx -t "tablet sidebar shell"
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add components/Layout.tsx index.css components/Layout.permissions.test.tsx
git commit -m "feat: add tablet ERP shell"
```

---

### Task 3: Operational Content Breakpoints for Inventory and Finance

**Files:**
- Modify: `pages/Inventory.tsx`
- Modify: `pages/Finance.tsx`
- Modify: `pages/Inventory.test.tsx`
- Modify: `pages/Finance.test.tsx`

**Interfaces:**
- Consumes: `ERP_COMPACT_CONTENT_MAX_WIDTH` from `lib/erpResponsive.ts`.
- Produces: card/list layouts remain active through iPad portrait (`<=1023px`); dense tables start at `>=1024px`.

- [ ] **Step 1: Add failing tests for compact content breakpoint usage**

In `pages/Inventory.test.tsx`, add:

```tsx
it('keeps the compact card layout through iPad portrait widths', async () => {
  mockMatchMediaWidth(834);
  renderInventoryPage();

  expect(await screen.findByTestId('inventory-content')).toBeInTheDocument();
  expect(screen.queryByText('Tabela do Estoque')).not.toBeInTheDocument();
});
```

In `pages/Finance.test.tsx`, add:

```tsx
it('keeps financial movement cards through iPad portrait widths', async () => {
  mockMatchMediaWidth(834);
  renderFinancePage();

  await userEvent.click(screen.getByTestId('finance-tab-bank'));

  expect(screen.queryByRole('table')).not.toBeInTheDocument();
  expect(screen.getByText(/Toque para detalhes/i)).toBeInTheDocument();
});
```

If the helper does not exist in these test files, add it at the top of each file:

```ts
const mockMatchMediaWidth = (width: number) => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: /max-width:\s*(\d+)px/.test(query)
        ? width <= Number(query.match(/max-width:\s*(\d+)px/)?.[1])
        : false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
};
```

- [ ] **Step 2: Run the focused tests to verify they fail**

Run:

```bash
npx vitest run pages/Inventory.test.tsx -t "iPad portrait"
npx vitest run pages/Finance.test.tsx -t "iPad portrait"
```

Expected: FAIL because the pages currently use the default `767px` mobile cutoff.

- [ ] **Step 3: Update Inventory to use compact operational breakpoint**

In `pages/Inventory.tsx`, add the import:

```ts
import { ERP_COMPACT_CONTENT_MAX_WIDTH } from '../lib/erpResponsive';
```

Change:

```ts
const isMobile = useIsMobileViewport();
```

to:

```ts
const isMobile = useIsMobileViewport(ERP_COMPACT_CONTENT_MAX_WIDTH);
```

Change desktop table columns from `md` to `lg`. Replace:

```tsx
<th className="hidden md:table-cell text-left px-4 py-3 font-semibold">Loja</th>
<th className="hidden md:table-cell text-left px-4 py-3 font-semibold">IMEI/Serial</th>
<th className="hidden md:table-cell text-left px-4 py-3 font-semibold">Caixa</th>
```

with:

```tsx
<th className="hidden lg:table-cell text-left px-4 py-3 font-semibold">Loja</th>
<th className="hidden lg:table-cell text-left px-4 py-3 font-semibold">IMEI/Serial</th>
<th className="hidden lg:table-cell text-left px-4 py-3 font-semibold">Caixa</th>
```

Replace the matching `<td className="hidden md:table-cell ...">` occurrences with `hidden lg:table-cell`.

- [ ] **Step 4: Update Finance to use compact operational breakpoint**

In `pages/Finance.tsx`, add:

```ts
import { ERP_COMPACT_CONTENT_MAX_WIDTH } from '../lib/erpResponsive';
```

Change:

```ts
const isMobile = useIsMobileViewport();
```

to:

```ts
const isMobile = useIsMobileViewport(ERP_COMPACT_CONTENT_MAX_WIDTH);
```

Replace invalid typography classes:

```tsx
className="text-ios-caption-1 text-red-500 mt-0.5"
className="text-ios-caption-1 text-gray-400"
```

with:

```tsx
className="text-ios-caption text-red-500 mt-0.5"
className="text-ios-caption text-gray-400"
```

- [ ] **Step 5: Run focused tests**

Run:

```bash
npx vitest run pages/Inventory.test.tsx -t "iPad portrait"
npx vitest run pages/Finance.test.tsx -t "iPad portrait"
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add pages/Inventory.tsx pages/Finance.tsx pages/Inventory.test.tsx pages/Finance.test.tsx
git commit -m "fix: keep operational cards on iPad portrait"
```

---

### Task 4: 44 px Touch Targets and iOS Typography

**Files:**
- Modify: `index.css`
- Modify: `components/Layout.tsx`
- Modify: `components/ui/Banner.tsx`
- Create: `components/ui/Banner.test.tsx`
- Modify: `pages/PDV.tsx`
- Modify: `pages/Settings.tsx`
- Modify: `pages/Inventory.tsx`

**Interfaces:**
- Consumes: existing CSS primitives `hit-target-44`, `ios-segment`, `ios-button-*`.
- Produces: every interactive phone/iPad control audited here has at least 44 px target and no new 10–11 px interactive text.

- [ ] **Step 1: Write failing Banner touch-target test**

Create `components/ui/Banner.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Banner from './Banner';

describe('Banner', () => {
  it('uses a 44px dismiss target when dismissible', () => {
    render(<Banner message="Modo offline" onClose={vi.fn()} />);

    const button = screen.getByRole('button', { name: /dispensar alerta/i });
    expect(button).toHaveClass('hit-target-44');
    expect(button).toHaveClass('w-11');
    expect(button).toHaveClass('h-11');
  });
});
```

- [ ] **Step 2: Run the Banner test to verify it fails**

Run:

```bash
npx vitest run components/ui/Banner.test.tsx
```

Expected: FAIL because Banner uses `w-8 h-8` without `hit-target-44`.

- [ ] **Step 3: Fix Banner dismiss target**

In `components/ui/Banner.tsx`, replace:

```tsx
className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-gray-400 dark:text-surface-dark-400 transition-colors"
```

with:

```tsx
className="shrink-0 w-11 h-11 hit-target-44 flex items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-gray-400 dark:text-surface-dark-400 transition-colors"
```

- [ ] **Step 4: Fix phone-only CSS shrinkage**

In `index.css`, inside the `@media (max-width: 767px)` block, replace:

```css
.inventory-segment-strip .ios-segment {
  flex: 0 0 auto;
  min-height: 2.25rem;
  border: 1px solid var(--ds-color-border);
  border-radius: 999px;
  background: color-mix(in srgb, var(--ds-color-surface) 92%, transparent);
  padding: 0 0.85rem;
  white-space: nowrap;
  box-shadow: none;
}
```

with:

```css
.inventory-segment-strip .ios-segment {
  flex: 0 0 auto;
  min-height: 2.75rem;
  border: 1px solid var(--ds-color-border);
  border-radius: 999px;
  background: color-mix(in srgb, var(--ds-color-surface) 92%, transparent);
  padding: 0 0.85rem;
  white-space: nowrap;
  box-shadow: none;
}
```

Replace:

```css
.inventory-share-actions .ios-button-secondary {
  min-height: 2.35rem;
  border-radius: 0.75rem;
  font-size: 0.84rem;
}
```

with:

```css
.inventory-share-actions .ios-button-secondary {
  min-height: 2.75rem;
  border-radius: 0.75rem;
  font-size: 0.84rem;
}
```

Replace:

```css
.pdv-step-card button {
  min-height: 2.5rem;
  padding-block: 0.45rem;
  font-size: 0.68rem;
}
```

with:

```css
.pdv-step-card button {
  min-height: 2.75rem;
  padding-block: 0.5rem;
  font-size: 0.75rem;
}
```

- [ ] **Step 5: Fix Layout tab labels**

In `components/Layout.tsx`, replace both bottom tab label class strings:

```tsx
text-[10px] mt-0.5 leading-tight relative z-10
```

with:

```tsx
text-ios-caption mt-0.5 leading-tight relative z-10
```

- [ ] **Step 6: Fix PDV step classes**

In `pages/PDV.tsx`, replace the step button class fragment:

```tsx
min-h-[2.5rem] md:min-h-[2.875rem] items-center justify-center px-1.5 py-1.5 md:py-2 rounded-ios-lg text-center text-[11px] leading-tight sm:text-xs md:text-sm
```

with:

```tsx
min-h-[44px] md:min-h-[2.875rem] items-center justify-center px-2 py-2 rounded-ios-lg text-center text-ios-caption md:text-sm
```

Change step titles:

```ts
{ id: 1 as const, title: 'Cliente' },
{ id: 2 as const, title: 'Produtos' },
{ id: 3 as const, title: 'Pagamento' }
```

- [ ] **Step 7: Fix Settings category icon targets**

In `pages/Settings.tsx`, replace every category edit/delete button class:

```tsx
className="p-1.5 text-gray-400 hover:text-brand-500 transition-colors"
className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
```

with:

```tsx
className="w-11 h-11 hit-target-44 inline-flex items-center justify-center rounded-ios text-gray-400 hover:text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors"
className="w-11 h-11 hit-target-44 inline-flex items-center justify-center rounded-ios text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
```

Change default badge text:

```tsx
className="text-[10px] font-bold uppercase text-gray-400 px-1.5 py-0.5 border border-gray-200 rounded"
```

to:

```tsx
className="text-ios-caption font-bold uppercase text-gray-400 px-2 py-1 border border-gray-200 rounded-ios"
```

- [ ] **Step 8: Run focused tests and grep guard**

Run:

```bash
npx vitest run components/ui/Banner.test.tsx
rg -n "text-\\[(10|11)px\\]|min-h-10|w-8 h-8|p-1\\.5 text-gray-400" components/Layout.tsx components/ui/Banner.tsx pages/PDV.tsx pages/Settings.tsx pages/Inventory.tsx index.css
```

Expected: Banner test PASS. The grep should return no matches in the edited interactive areas, except non-interactive print receipt sections in `pages/PDV.tsx` and `pages/PDVHistory.tsx`.

- [ ] **Step 9: Commit**

```bash
git add index.css components/Layout.tsx components/ui/Banner.tsx components/ui/Banner.test.tsx pages/PDV.tsx pages/Settings.tsx pages/Inventory.tsx
git commit -m "fix: normalize ERP touch targets"
```

---

### Task 5: Search and Card Accessibility

**Files:**
- Modify: `pages/Inventory.tsx`
- Modify: `pages/Finance.tsx`
- Modify: `pages/Inventory.test.tsx`
- Modify: `pages/Finance.test.tsx`

**Interfaces:**
- Consumes: existing search inputs and compact layouts.
- Produces: named search fields and correct card action labels.

- [ ] **Step 1: Add failing accessible search tests**

In `pages/Inventory.test.tsx`, add:

```tsx
it('exposes the inventory search with an accessible name', async () => {
  renderInventoryPage();

  expect(await screen.findByRole('searchbox', { name: /buscar no estoque/i })).toBeInTheDocument();
});
```

In `pages/Finance.test.tsx`, add:

```tsx
it('exposes payable debt search with an accessible name', async () => {
  renderFinancePage();

  await userEvent.click(screen.getByTestId('finance-tab-payable_debts'));

  expect(screen.getByRole('searchbox', { name: /buscar dívidas ativas/i })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
npx vitest run pages/Inventory.test.tsx -t "accessible name"
npx vitest run pages/Finance.test.tsx -t "accessible name"
```

Expected: FAIL because inputs are plain text boxes named only by placeholder.

- [ ] **Step 3: Fix Inventory search semantics and normal card label**

In `pages/Inventory.tsx`, change the search input:

```tsx
<input
  type="text"
  placeholder="Buscar por modelo ou IMEI/Serial..."
  value={searchTerm}
  onChange={(e) => setSearchTerm(e.target.value)}
  className="ios-input pl-10 transition-all focus:ring-4 focus:ring-brand-500/15 focus:border-brand-500"
/>
```

to:

```tsx
<input
  type="search"
  aria-label="Buscar no estoque"
  placeholder="Buscar por modelo ou IMEI/Serial..."
  value={searchTerm}
  onChange={(e) => setSearchTerm(e.target.value)}
  className="ios-input pl-10 transition-all focus:ring-4 focus:ring-brand-500/15 focus:border-brand-500"
/>
```

For the mobile card title button, replace:

```tsx
aria-label={`${isSpecialSelected ? 'Remover' : 'Selecionar'} ${item.model}`}
```

with:

```tsx
aria-label={
  isSpecialShareMode
    ? `${isSpecialSelected ? 'Remover' : 'Selecionar'} ${item.model}`
    : `Ver detalhes de ${item.model}`
}
```

- [ ] **Step 4: Fix Finance search semantics**

In `pages/Finance.tsx`, change the payable debt search input:

```tsx
<input
  type="text"
  className="ios-input pl-4"
  placeholder="Buscar por credor ou observação..."
  value={pdSearchTerm}
  onChange={(e) => setPdSearchTerm(e.target.value)}
/>
```

to:

```tsx
<input
  type="search"
  aria-label="Buscar dívidas ativas"
  className="ios-input pl-4"
  placeholder="Buscar por credor ou observação..."
  value={pdSearchTerm}
  onChange={(e) => setPdSearchTerm(e.target.value)}
/>
```

- [ ] **Step 5: Run focused tests**

Run:

```bash
npx vitest run pages/Inventory.test.tsx -t "accessible name"
npx vitest run pages/Finance.test.tsx -t "accessible name"
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add pages/Inventory.tsx pages/Finance.tsx pages/Inventory.test.tsx pages/Finance.test.tsx
git commit -m "fix: name ERP search fields"
```

---

### Task 6: Replace Native Confirms with ConfirmDialog

**Files:**
- Modify: `pages/PDV.tsx`
- Modify: `pages/Settings.tsx`
- Modify: `components/StockFormModal.tsx`
- Modify: `pages/PDV.test.tsx`
- Modify: `pages/Settings.test.tsx`
- Modify: `components/StockFormModal.test.tsx`

**Interfaces:**
- Consumes: `const toast = useToast()` and `toast.confirm({ title, description, confirmLabel, variant })`.
- Produces: no `window.confirm` remains in the audited ERP files.

- [ ] **Step 1: Add a grep check before editing**

Run:

```bash
rg -n "window\\.confirm|confirm\\(" pages/PDV.tsx pages/Settings.tsx components/StockFormModal.tsx
```

Expected current matches:

```text
pages/PDV.tsx:351:    const confirmed = window.confirm(...)
pages/Settings.tsx:547:    const confirmed = window.confirm(...)
pages/Settings.tsx:617:    const confirmed = window.confirm(...)
components/StockFormModal.tsx:816:    const confirmed = window.confirm(...)
```

- [ ] **Step 2: Add/update test mocks for confirmation**

In tests that mock `useToast`, make the mock include `confirm`. Use this shape:

```ts
const toastMock = {
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
  confirm: vi.fn(async () => true),
  dismiss: vi.fn(),
  clear: vi.fn(),
};

vi.mock('../components/ui/ToastProvider', () => ({
  useToast: () => toastMock,
}));
```

For `components/StockFormModal.test.tsx`, use:

```ts
vi.mock('./ui/ToastProvider', () => ({
  useToast: () => toastMock,
}));
```

Add this assertion to each destructive-flow test after triggering the deletion:

```ts
expect(toastMock.confirm).toHaveBeenCalledWith(
  expect.objectContaining({
    variant: 'danger',
    confirmLabel: expect.stringMatching(/excluir|remover|solicitar/i),
  })
);
```

- [ ] **Step 3: Replace PDV duplicate deletion confirm**

In `pages/PDV.tsx`, replace:

```ts
const confirmed = window.confirm(`Excluir o registro ${duplicate.model} IMEI/Serial ${duplicate.imei || '-'}?`);
```

with:

```ts
const confirmed = await toast.confirm({
  title: 'Excluir registro duplicado',
  description: `Excluir o registro ${duplicate.model} IMEI/Serial ${duplicate.imei || '-'} removerá este aparelho do estoque. Esta ação não pode ser desfeita.`,
  confirmLabel: 'Excluir registro',
  variant: 'danger',
});
```

- [ ] **Step 4: Replace Settings category removal confirm**

In `pages/Settings.tsx`, replace:

```ts
const confirmed = window.confirm(
  `Deseja remover a categoria "${category.name}"? Esta ação não pode ser desfeita.`
);
```

with:

```ts
const confirmed = await toast.confirm({
  title: 'Remover categoria',
  description: `Remover a categoria "${category.name}" impede novos lançamentos com esse nome. Lançamentos antigos continuam preservados.`,
  confirmLabel: 'Remover categoria',
  variant: 'danger',
});
```

- [ ] **Step 5: Replace Settings account deletion confirm**

In `pages/Settings.tsx`, replace:

```ts
const confirmed = window.confirm(
  'Tem certeza que deseja excluir sua conta?\n\nSua conta será desativada imediatamente e excluída permanentemente em 30 dias. Você pode cancelar antes disso.'
);
```

with:

```ts
const confirmed = await toast.confirm({
  title: 'Solicitar exclusão da conta',
  description: 'Sua conta será desativada agora e excluída permanentemente em 30 dias. Você pode cancelar a solicitação antes do prazo.',
  confirmLabel: 'Solicitar exclusão',
  variant: 'danger',
});
```

- [ ] **Step 6: Replace StockFormModal delete confirm**

In `components/StockFormModal.tsx`, replace:

```ts
const confirmed = window.confirm(
  `Deseja realmente excluir o aparelho "${formData.model || 'Sem modelo'}"? Esta ação não pode ser desfeita.`
);
```

with:

```ts
const confirmed = await toast.confirm({
  title: 'Excluir aparelho',
  description: `Excluir o aparelho "${formData.model || 'Sem modelo'}" removerá o registro do estoque. Esta ação não pode ser desfeita.`,
  confirmLabel: 'Excluir aparelho',
  variant: 'danger',
});
```

- [ ] **Step 7: Run tests and grep check**

Run:

```bash
npx vitest run pages/PDV.test.tsx pages/Settings.test.tsx components/StockFormModal.test.tsx
rg -n "window\\.confirm" pages/PDV.tsx pages/Settings.tsx components/StockFormModal.tsx
```

Expected: tests PASS. Grep returns no matches.

- [ ] **Step 8: Commit**

```bash
git add pages/PDV.tsx pages/Settings.tsx components/StockFormModal.tsx pages/PDV.test.tsx pages/Settings.test.tsx components/StockFormModal.test.tsx
git commit -m "fix: replace native ERP confirmations"
```

---

### Task 7: Inline Field Validation for Quick Create Modals

**Files:**
- Modify: `components/AddCustomerModal.tsx`
- Create: `components/AddCustomerModal.test.tsx`
- Modify: `components/AddSellerModal.tsx`
- Create: `components/AddSellerModal.test.tsx`

**Interfaces:**
- Consumes: `formatCpf`, `formatPhone`, `Modal`, `useToast`.
- Produces: inline errors with `role="alert"`, `aria-invalid`, and `aria-describedby`.

- [ ] **Step 1: Write failing AddCustomerModal tests**

Create `components/AddCustomerModal.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AddCustomerModal } from './AddCustomerModal';

const toastMock = {
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
  confirm: vi.fn(),
  dismiss: vi.fn(),
  clear: vi.fn(),
};

const addCustomerMock = vi.fn();

vi.mock('./ui/ToastProvider', () => ({ useToast: () => toastMock }));
vi.mock('../services/dataContext', () => ({ useData: () => ({ addCustomer: addCustomerMock }) }));

describe('AddCustomerModal', () => {
  it('shows required name validation inline instead of toast', async () => {
    render(<AddCustomerModal open onClose={vi.fn()} onCustomerAdded={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: /cadastrar cliente/i }));

    expect(screen.getByRole('alert')).toHaveTextContent('Informe o nome completo do cliente.');
    expect(screen.getByLabelText(/nome completo/i)).toHaveAttribute('aria-invalid', 'true');
    expect(toastMock.error).not.toHaveBeenCalledWith('Nome é obrigatório.');
  });
});
```

- [ ] **Step 2: Write failing AddSellerModal tests**

Create `components/AddSellerModal.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AddSellerModal } from './AddSellerModal';

const toastMock = {
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
  confirm: vi.fn(),
  dismiss: vi.fn(),
  clear: vi.fn(),
};

vi.mock('./ui/ToastProvider', () => ({ useToast: () => toastMock }));
vi.mock('../services/dataContext', () => ({ useData: () => ({ refreshData: vi.fn() }) }));
vi.mock('../services/adminProvision', () => ({ adminProvisionUser: vi.fn() }));

describe('AddSellerModal', () => {
  it('shows missing required fields inline instead of toast', async () => {
    render(<AddSellerModal open onClose={vi.fn()} onSellerAdded={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: /cadastrar vendedor/i }));

    expect(screen.getByRole('alert')).toHaveTextContent('Informe nome, e-mail e senha inicial.');
    expect(screen.getByLabelText(/nome do vendedor/i)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText(/email de acesso/i)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText(/senha inicial/i)).toHaveAttribute('aria-invalid', 'true');
    expect(toastMock.error).not.toHaveBeenCalledWith('Nome e email são obrigatórios');
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run:

```bash
npx vitest run components/AddCustomerModal.test.tsx components/AddSellerModal.test.tsx
```

Expected: FAIL because inline errors and accessible labels are not wired.

- [ ] **Step 4: Implement AddCustomerModal inline validation**

In `components/AddCustomerModal.tsx`, add:

```ts
const [fieldErrors, setFieldErrors] = useState<{ name?: string }>({});
```

Change validation:

```ts
if (!normalizedName) {
  toast.error('Nome é obrigatório.');
  return;
}
```

to:

```ts
if (!normalizedName) {
  setFieldErrors({ name: 'Informe o nome completo do cliente.' });
  return;
}
setFieldErrors({});
```

Change the name label/input block to:

```tsx
<div>
  <label htmlFor="new-customer-name" className="ios-label">Nome Completo *</label>
  <input
    id="new-customer-name"
    type="text"
    required
    aria-invalid={!!fieldErrors.name}
    aria-describedby={fieldErrors.name ? 'new-customer-name-error' : undefined}
    className={`ios-input ${fieldErrors.name ? 'ios-input-error' : ''}`}
    value={name}
    onChange={(e) => {
      setName(e.target.value.toUpperCase());
      if (fieldErrors.name) setFieldErrors((prev) => ({ ...prev, name: undefined }));
    }}
    placeholder="Ex: João da Silva"
  />
  {fieldErrors.name && (
    <p id="new-customer-name-error" role="alert" className="mt-1 text-ios-footnote text-red-600 dark:text-red-400">
      {fieldErrors.name}
    </p>
  )}
</div>
```

Add `htmlFor`/`id` pairs for the remaining labels:

```tsx
htmlFor="new-customer-phone" id="new-customer-phone"
htmlFor="new-customer-cpf" id="new-customer-cpf"
htmlFor="new-customer-birth-date" id="new-customer-birth-date"
htmlFor="new-customer-email" id="new-customer-email"
```

- [ ] **Step 5: Implement AddSellerModal inline validation**

In `components/AddSellerModal.tsx`, add:

```ts
const [fieldErrors, setFieldErrors] = useState<{ form?: string; name?: string; email?: string; password?: string }>({});
```

Replace validation:

```ts
if (!name.trim() || !email.trim()) {
  toast.error('Nome e email são obrigatórios');
  return;
}

if (password.length < 6) {
  toast.error('A senha deve ter no mínimo 6 caracteres.');
  return;
}
```

with:

```ts
const nextErrors: typeof fieldErrors = {};
if (!name.trim()) nextErrors.name = 'Informe o nome do vendedor.';
if (!email.trim()) nextErrors.email = 'Informe o e-mail de acesso.';
if (!password) nextErrors.password = 'Informe a senha inicial.';
if (Object.keys(nextErrors).length > 0) {
  setFieldErrors({ ...nextErrors, form: 'Informe nome, e-mail e senha inicial.' });
  return;
}

if (password.length < 6) {
  setFieldErrors({ password: 'Use pelo menos 6 caracteres.', form: 'A senha inicial precisa ter pelo menos 6 caracteres.' });
  return;
}
setFieldErrors({});
```

Add form-level error before the fields:

```tsx
{fieldErrors.form && (
  <p role="alert" className="rounded-ios border border-red-200 bg-red-50 px-3 py-2 text-ios-footnote text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
    {fieldErrors.form}
  </p>
)}
```

Use these IDs and ARIA attributes:

```tsx
<label htmlFor="new-seller-name" className="ios-label">Nome do Vendedor *</label>
<input id="new-seller-name" aria-invalid={!!fieldErrors.name} aria-describedby={fieldErrors.name ? 'new-seller-name-error' : undefined} />

<label htmlFor="new-seller-email" className="ios-label">Email de Acesso *</label>
<input id="new-seller-email" aria-invalid={!!fieldErrors.email} aria-describedby={fieldErrors.email ? 'new-seller-email-error' : undefined} />

<label htmlFor="new-seller-password" className="ios-label">Senha Inicial *</label>
<input id="new-seller-password" aria-invalid={!!fieldErrors.password} aria-describedby={fieldErrors.password ? 'new-seller-password-error' : undefined} />
```

Render each field error with:

```tsx
{fieldErrors.password && (
  <p id="new-seller-password-error" className="mt-1 text-ios-footnote text-red-600 dark:text-red-400">
    {fieldErrors.password}
  </p>
)}
```

Repeat the same pattern for `name` and `email`.

- [ ] **Step 6: Run focused tests**

Run:

```bash
npx vitest run components/AddCustomerModal.test.tsx components/AddSellerModal.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add components/AddCustomerModal.tsx components/AddCustomerModal.test.tsx components/AddSellerModal.tsx components/AddSellerModal.test.tsx
git commit -m "fix: show quick-create validation inline"
```

---

### Task 8: Finance Export Action

**Files:**
- Create: `utils/csv.ts`
- Create: `utils/csv.test.ts`
- Modify: `pages/Finance.tsx`
- Modify: `pages/Finance.test.tsx`

**Interfaces:**
- Produces:
  - `escapeCsvCell(value: unknown): string`
  - `buildCsv(rows: unknown[][]): string`
  - `downloadTextFile(filename: string, content: string, mimeType: string): void`
- Consumes: existing `transactions`, active tab, date/category filters.

- [ ] **Step 1: Write failing CSV utility tests**

Create `utils/csv.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildCsv, escapeCsvCell } from './csv';

describe('csv utils', () => {
  it('escapes commas, quotes and line breaks', () => {
    expect(escapeCsvCell('Pagamento, "Hospital"\nLinha 2')).toBe('"Pagamento, ""Hospital""\nLinha 2"');
  });

  it('builds CSV with CRLF row separators', () => {
    expect(buildCsv([
      ['Data', 'Descrição'],
      ['2026-06-22', 'Aporte'],
    ])).toBe('Data,Descrição\r\n2026-06-22,Aporte');
  });
});
```

- [ ] **Step 2: Run CSV tests to verify they fail**

Run:

```bash
npx vitest run utils/csv.test.ts
```

Expected: FAIL because `utils/csv.ts` does not exist.

- [ ] **Step 3: Implement CSV utility**

Create `utils/csv.ts`:

```ts
export const escapeCsvCell = (value: unknown): string => {
  const text = value === null || value === undefined ? '' : String(value);
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

export const buildCsv = (rows: unknown[][]): string =>
  rows.map((row) => row.map(escapeCsvCell).join(',')).join('\r\n');

export const downloadTextFile = (filename: string, content: string, mimeType: string): void => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};
```

- [ ] **Step 4: Wire Finance export button**

In `pages/Finance.tsx`, import:

```ts
import { buildCsv, downloadTextFile } from '../utils/csv';
```

Add this helper inside `Finance` near `renderTransactionTable`:

```ts
const getFilteredTransactionsForAccount = (accountFilter: FinancialAccount): Transaction[] => {
  const { from: dateFrom, to: dateTo } = getEffectiveDateRange(datePreset, customDateFrom, customDateTo);
  const shouldFilterByCategory =
    transactionCategoryFilter !== 'all' && CASH_EQUIVALENT_ACCOUNTS.includes(accountFilter);

  return transactions
    .filter((t) => t.account === accountFilter)
    .filter((t) => !shouldFilterByCategory || t.category === transactionCategoryFilter)
    .filter((t) => isInDateRange(t.date, dateFrom, dateTo))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

const handleExportActiveAccountTransactions = () => {
  const account = getAccountFromTab(activeTab);
  const rows = getFilteredTransactionsForAccount(account);
  if (rows.length === 0) {
    toast.info('Nenhuma movimentação para exportar.');
    return;
  }

  const csv = buildCsv([
    ['Data', 'Conta', 'Tipo', 'Categoria', 'Descrição', 'Valor'],
    ...rows.map((transaction) => [
      new Date(transaction.date).toLocaleDateString('pt-BR'),
      transaction.account,
      transaction.type === 'IN' ? 'Entrada' : 'Saída',
      transaction.category,
      getTransactionDescription(transaction, sales, sellers, customers, debts),
      toFiniteNumber(transaction.amount).toFixed(2).replace('.', ','),
    ]),
  ]);

  const safeAccount = account.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-');
  downloadTextFile(`extrato-${safeAccount}.csv`, csv, 'text/csv;charset=utf-8');
  toast.success('Extrato exportado.');
};
```

Inside `renderTransactionTable`, replace repeated filter logic with:

```ts
const filtered = getFilteredTransactionsForAccount(accountFilter);
```

Change the export icon button:

```tsx
<button className="p-2 text-gray-400 hover:text-gray-600 rounded-ios-lg hover:bg-gray-100 dark:hover:bg-surface-dark-200">
  <Download size={20} />
</button>
```

to:

```tsx
<button
  type="button"
  onClick={handleExportActiveAccountTransactions}
  className="w-11 h-11 hit-target-44 inline-flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-ios-lg hover:bg-gray-100 dark:hover:bg-surface-dark-200"
  aria-label={`Exportar extrato de ${accountLabelByTab[activeTab as 'bank' | 'safe' | 'debtors']}`}
>
  <Download size={20} />
</button>
```

- [ ] **Step 5: Add Finance test for export button accessibility**

In `pages/Finance.test.tsx`, add:

```tsx
it('names the export button for the active account statement', async () => {
  renderFinancePage();

  await userEvent.click(screen.getByTestId('finance-tab-bank'));

  expect(screen.getByRole('button', { name: /exportar extrato de conta bancária/i })).toBeInTheDocument();
});
```

- [ ] **Step 6: Run focused tests**

Run:

```bash
npx vitest run utils/csv.test.ts pages/Finance.test.tsx -t "csv|export"
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add utils/csv.ts utils/csv.test.ts pages/Finance.tsx pages/Finance.test.tsx
git commit -m "feat: export finance statement csv"
```

---

### Task 9: Modal and Toast Platform Behavior

**Files:**
- Modify: `components/ui/Modal.tsx`
- Modify: `components/ui/Modal.test.tsx`
- Modify: `components/ui/ToastViewport.tsx`

**Interfaces:**
- Consumes: `useReducedMotion`, `closeOnBackdrop`, existing `ToastViewport`.
- Produces: reduced-motion modal variants with no transform animation, non-clickable backdrop when `closeOnBackdrop=false`, phone toasts offset above tab bar.

- [ ] **Step 1: Add failing Modal backdrop test**

In `components/ui/Modal.test.tsx`, add:

```tsx
it('renders a non-interactive backdrop when closeOnBackdrop is false', () => {
  render(
    <Modal open onClose={vi.fn()} title="Editar" closeOnBackdrop={false}>
      <p>Conteúdo</p>
    </Modal>
  );

  expect(screen.queryByRole('button', { name: /fechar/i })).toBeInTheDocument();
  expect(screen.queryAllByRole('button', { name: /fechar/i })).toHaveLength(1);
});
```

This expects only the header close button to be named “Fechar”; the backdrop must not be a second close button.

- [ ] **Step 2: Run Modal test to verify it fails**

Run:

```bash
npx vitest run components/ui/Modal.test.tsx -t "non-interactive backdrop"
```

Expected: FAIL because the backdrop is always an aria-labeled button.

- [ ] **Step 3: Make backdrop semantic based on close behavior**

In `components/ui/Modal.tsx`, replace the backdrop block:

```tsx
<m.button
  type="button"
  className="absolute inset-0 liquid-glass-strong"
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  exit={{ opacity: 0 }}
  transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
  onClick={closeOnBackdrop ? onClose : undefined}
  aria-label="Fechar"
/>
```

with:

```tsx
{closeOnBackdrop ? (
  <m.button
    type="button"
    className="absolute inset-0 liquid-glass-strong"
    initial={reducedMotion ? { opacity: 0 } : { opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={reducedMotion ? { duration: 0.01 } : { duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
    onClick={onClose}
    aria-label="Fechar"
  />
) : (
  <m.div
    className="absolute inset-0 liquid-glass-strong"
    initial={reducedMotion ? { opacity: 0 } : { opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={reducedMotion ? { duration: 0.01 } : { duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
    aria-hidden="true"
  />
)}
```

- [ ] **Step 4: Apply reduced-motion modal variants**

In `components/ui/Modal.tsx`, change `dialogVariants` to:

```ts
const dialogVariants = reducedMotion
  ? {
      initial: { opacity: 0 },
      animate: { opacity: 1, transition: { duration: 0.01 } },
      exit: { opacity: 0, transition: { duration: 0.01 } },
    }
  : !isCentered
    ? {
        initial: { y: '100%', opacity: 1 },
        animate: { y: 0, opacity: 1, transition: iosSheetSpring },
        exit: { y: '100%', opacity: 1, transition: { type: 'tween', ease: [0.32, 0.72, 0, 1], duration: 0.25 } },
      }
    : {
        initial: { scale: 0.95, opacity: 0 },
        animate: { scale: 1, opacity: 1, transition: iosSpring },
        exit: { scale: 0.96, opacity: 0, transition: { type: 'tween', ease: [0.4, 0, 1, 1], duration: 0.18 } },
      };
```

- [ ] **Step 5: Offset phone toasts above bottom tab bar**

In `components/ui/ToastViewport.tsx`, replace:

```tsx
className="fixed top-4 right-4 bottom-auto left-auto sm:bottom-auto max-sm:top-auto max-sm:bottom-[calc(env(safe-area-inset-bottom,0px)+1rem)] max-sm:left-4 max-sm:right-4 flex flex-col gap-3 pointer-events-none"
```

with:

```tsx
className="fixed top-4 right-4 bottom-auto left-auto sm:bottom-auto max-sm:top-auto max-sm:bottom-[calc(env(safe-area-inset-bottom,0px)+50px+1rem)] max-sm:left-4 max-sm:right-4 flex flex-col gap-3 pointer-events-none"
```

- [ ] **Step 6: Run Modal tests**

Run:

```bash
npx vitest run components/ui/Modal.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add components/ui/Modal.tsx components/ui/Modal.test.tsx components/ui/ToastViewport.tsx
git commit -m "fix: align modal and toast platform behavior"
```

---

### Task 10: Remove Global Uppercase and Fix Token Drift

**Files:**
- Modify: `index.css`
- Modify: `pages/Finance.tsx`
- Modify: `components/ui/ConfirmDialog.tsx`
- Modify: `components/ui/ToastViewport.tsx`

**Interfaces:**
- Produces: no global uppercase and no audited token drift (`text-ios-caption-1`, `shadow-premium-sm`, interactive `text-[10px]`/`text-[11px]`).

- [ ] **Step 1: Run baseline grep**

Run:

```bash
rg -n "text-transform: uppercase|text-ios-caption-1|shadow-premium-sm|text-\\[(10|11)px\\]" index.css pages components --glob '!pages/crm/**' --glob '!components/crm/**'
```

Expected: current matches include `index.css:112`, `pages/Finance.tsx`, `components/ui/ConfirmDialog.tsx`, `components/ui/ToastViewport.tsx`, and print receipt areas.

- [ ] **Step 2: Remove global uppercase only**

In `index.css`, remove this rule from `#root`:

```css
text-transform: uppercase;
```

Keep uppercase on explicit section headers:

```css
.ios-section-header {
  text-transform: uppercase;
}
```

- [ ] **Step 3: Replace ConfirmDialog shadow token**

In `components/ui/ConfirmDialog.tsx`, replace:

```tsx
className={`shrink-0 w-16 h-16 rounded-full flex items-center justify-center ${iconClass} shadow-premium-sm mb-2`}
```

with:

```tsx
className={`shrink-0 w-16 h-16 rounded-full flex items-center justify-center ${iconClass} shadow-ios26-sm mb-2`}
```

- [ ] **Step 4: Replace Toast arbitrary body size**

In `components/ui/ToastViewport.tsx`, replace:

```tsx
<p className="mt-1 text-[13px] text-gray-600 dark:text-surface-dark-600 leading-snug">{t.message}</p>
```

with:

```tsx
<p className="mt-1 text-ios-footnote text-gray-600 dark:text-surface-dark-600 leading-snug">{t.message}</p>
```

- [ ] **Step 5: Run grep guard**

Run:

```bash
rg -n "text-transform: uppercase|text-ios-caption-1|shadow-premium-sm|text-\\[(10|11)px\\]" index.css pages components --glob '!pages/crm/**' --glob '!components/crm/**'
```

Expected: remaining `text-transform: uppercase` only in component-specific classes such as `.ios-section-header`; remaining `text-[10px]`/`text-[11px]` only in print receipt sections or non-interactive legal/debug copy.

- [ ] **Step 6: Commit**

```bash
git add index.css pages/Finance.tsx components/ui/ConfirmDialog.tsx components/ui/ToastViewport.tsx
git commit -m "fix: remove ERP typography drift"
```

---

### Task 11: Platform Smoke Checks

**Files:**
- Create: `tests/smoke/erp-responsive-ui.spec.ts`
- Modify: `tests/smoke/README.md`

**Interfaces:**
- Consumes: existing smoke auth state at `tests/smoke/.auth/admin.json` when available.
- Produces: documented platform smoke coverage for desktop, iPhone, iPad portrait, and iPad landscape.

- [ ] **Step 1: Create Playwright smoke spec**

Create `tests/smoke/erp-responsive-ui.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { ADMIN_STORAGE_STATE } from './utils/constants';

const routes = [
  { path: '/#/inventory', title: 'Estoque' },
  { path: '/#/finance', title: 'Financeiro' },
  { path: '/#/pdv/nova-venda', title: 'Resumo' },
] as const;

const viewports = [
  { name: 'iphone', width: 393, height: 852, expectsSidebar: false, expectsBottomNav: true },
  { name: 'ipad-portrait', width: 834, height: 1194, expectsSidebar: true, expectsBottomNav: false },
  { name: 'ipad-landscape', width: 1194, height: 834, expectsSidebar: true, expectsBottomNav: false },
  { name: 'desktop', width: 1440, height: 1000, expectsSidebar: true, expectsBottomNav: false },
] as const;

test.use({ storageState: ADMIN_STORAGE_STATE });

for (const viewport of viewports) {
  for (const route of routes) {
    test(`[ERP responsive] ${viewport.name} ${route.path}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(route.path);

      await expect(page.getByText(route.title).first()).toBeVisible();

      const sidebar = page.getByTestId('erp-sidebar');
      const bottomNav = page.getByTestId('erp-bottom-nav');

      if (viewport.expectsSidebar) {
        await expect(sidebar).toBeVisible();
      } else {
        await expect(sidebar).toBeHidden();
      }

      if (viewport.expectsBottomNav) {
        await expect(bottomNav).toBeVisible();
      } else {
        await expect(bottomNav).toBeHidden();
      }

      await expect(page.locator('body')).not.toHaveJSProperty('scrollWidth', await page.locator('body').evaluate((body) => body.clientWidth));
    });
  }
}
```

If the final `scrollWidth` assertion is flaky in Chromium, replace it with:

```ts
const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
expect(overflow).toBeLessThanOrEqual(1);
```

- [ ] **Step 2: Run smoke spec when auth is available**

Run:

```bash
test -f tests/smoke/.auth/admin.json && npx playwright test -c playwright.smoke.config.ts tests/smoke/erp-responsive-ui.spec.ts
```

Expected: PASS when the stored auth state can reach Supabase. If Supabase is unreachable, record the error and run the Vitest suite instead; do not mark UI work complete until at least one authenticated smoke run passes in a reachable environment.

- [ ] **Step 3: Document smoke usage**

Append to `tests/smoke/README.md`:

```md
### ERP responsive UI smoke

Run after responsive shell or operational layout changes:

```bash
npx playwright test -c playwright.smoke.config.ts tests/smoke/erp-responsive-ui.spec.ts
```

It verifies the ERP shell across iPhone, iPad portrait, iPad landscape, and desktop using the stored admin auth state.
```

- [ ] **Step 4: Commit**

```bash
git add tests/smoke/erp-responsive-ui.spec.ts tests/smoke/README.md
git commit -m "test: add ERP responsive smoke coverage"
```

---

### Task 12: Final Verification and Regression Sweep

**Files:**
- No planned code modifications.

**Interfaces:**
- Consumes: all tasks above.
- Produces: final evidence that the responsive UI fixes are safe.

- [ ] **Step 1: Run lint**

Run:

```bash
npm run lint
```

Expected: exits 0.

- [ ] **Step 2: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: exits 0.

- [ ] **Step 3: Run focused unit/UI tests**

Run:

```bash
npx vitest run \
  lib/erpResponsive.test.ts \
  components/ui/Banner.test.tsx \
  components/ui/Modal.test.tsx \
  components/AddCustomerModal.test.tsx \
  components/AddSellerModal.test.tsx \
  pages/Inventory.test.tsx \
  pages/Finance.test.tsx \
  pages/PDV.test.tsx \
  pages/Settings.test.tsx \
  components/StockFormModal.test.tsx \
  utils/csv.test.ts
```

Expected: exits 0.

- [ ] **Step 4: Run full Vitest suite**

Run:

```bash
npm run test:run
```

Expected: exits 0.

- [ ] **Step 5: Run authenticated responsive smoke when available**

Run:

```bash
test -f tests/smoke/.auth/admin.json && npx playwright test -c playwright.smoke.config.ts tests/smoke/erp-responsive-ui.spec.ts
```

Expected: exits 0 in an environment with reachable Supabase.

- [ ] **Step 6: Run final grep guards**

Run:

```bash
rg -n "window\\.confirm" pages components --glob '!pages/crm/**' --glob '!components/crm/**'
rg -n "text-ios-caption-1|shadow-premium-sm" pages components --glob '!pages/crm/**' --glob '!components/crm/**'
rg -n "text-\\[(10|11)px\\]|min-h-10|w-8 h-8|p-1\\.5 text-gray-400" components/Layout.tsx components/ui pages/Inventory.tsx pages/Finance.tsx pages/PDV.tsx pages/Settings.tsx index.css
```

Expected:
- no `window.confirm`;
- no invalid token drift;
- no interactive 10–11 px or sub-44 px targets in audited ERP files. Print receipt markup may still use small print sizes.

- [ ] **Step 7: Manual visual checklist**

Open each viewport and check these exact items:

```bash
npm run dev -- --host 127.0.0.1 --port 4174
```

Desktop `1440×1000`:
- sidebar visible with labels;
- no bottom tab bar;
- Finance export button has label and works;
- Stock/Finance tables fit without horizontal page overflow.

iPhone `393×852`:
- top header and bottom tab bar visible;
- no sidebar;
- toast appears above tab bar;
- Inventory filters and PDV steps are 44 px tall;
- modals act as bottom sheets where `centered={false}`.

iPad portrait `834×1194`:
- compact sidebar visible;
- no bottom tab bar;
- Inventory and Finance use cards/lists, not dense tables;
- Configurations uses at most two useful columns.

iPad landscape `1194×834`:
- sidebar visible;
- no bottom tab bar;
- PDV two-column content/summary works;
- no content hidden behind fixed chrome.

- [ ] **Step 8: Commit final smoke/doc updates if any**

If Step 7 required only docs or test expectation updates:

```bash
git add docs tests
git commit -m "docs: record ERP responsive verification"
```

If no updates were required, do not create an empty commit.

---

## Self-Review

**Spec coverage:** This plan covers desktop, iPhone/iOS, and iPad separately through shell, operational content breakpoints, touch targets, typography, accessibility, destructive confirmations, inline validation, modal/toast behavior, export action, and smoke verification.

**Placeholder scan:** The plan intentionally contains no placeholder markers, no deferred implementation markers, and no vague fallback steps. Every code-changing task includes exact code or exact replacement snippets.

**Type consistency:** `ERP_COMPACT_CONTENT_MAX_WIDTH`, `classifyErpViewport`, `isCompactOperationalViewport`, `escapeCsvCell`, `buildCsv`, and `downloadTextFile` are defined before use. Breakpoint values match the requested desktop/iOS/iPad separation.

**Known execution caveat:** Playwright smoke requires valid stored auth and reachable Supabase. If Supabase is unreachable in a local environment, Vitest still verifies the code-level contract, but completion should wait for one authenticated smoke pass in a reachable environment.
