# Test Infra Stabilization and Unused Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Vitest suite deterministic by fixing broken test infrastructure and stale mocks, then remove unused test/code artifacts without changing production behavior.

**Architecture:** Keep production code changes minimal and evidence-driven. Move repeated mocks and timing controls into small test utilities, split heavy integration tests from fast unit tests, and use static analysis plus focused test runs before removing unused files, exports, mocks, or dependencies.

**Tech Stack:** Vitest, Testing Library, React 19, jsdom, TypeScript `noUnusedLocals`/`noUnusedParameters`, ESLint, optional `knip` audit for unused files/dependencies.

---

## Current Evidence

Fresh checks from 2026-05-15 show these patterns:

- `Settings` fails because `pages/Settings.test.tsx` mocks `supabase.from().select().order()`, while `hooks/useConsents.ts` calls `supabase.from('user_consents').select(...).eq(...)`.
- `PDV` has deterministic timeout pressure. A single payment-method test fails at `10000ms` but passes with `--testTimeout=30000`.
- `Finance` passes when run as a file, but fails inside the full suite, pointing to suite-level contention rather than a direct Finance regression.
- `Inventory` mostly passes as a file, with one slow/fragile render assertion. Many full-suite failures are timeout amplification.
- `CRM` tests emit React `act(...)` warnings and have background polling, realtime subscription, `setTimeout`, `setInterval`, and `requestAnimationFrame` activity that is not controlled by the tests.
- Deno Edge Function tests must not match Vitest's `**/*.test.ts` glob; Deno-only tests should use `.deno.ts`.

## Non-Goals

- Do not redesign PDV, Inventory, Finance, CRM, or Settings UI.
- Do not silence failures by deleting behavioral assertions.
- Do not raise all timeouts globally as the primary fix.
- Do not remove dependencies or files only because they look unused; require static analysis and at least one verification command.

## Task 1: Split Vitest Test Classes

**Files:**
- Modify: `vitest.config.ts`
- Modify: `package.json`
- Create: `vitest.integration.config.ts`

- [ ] **Step 1: Add a failing guard for Deno tests not being collected by Vitest**

Run:

```bash
npm run test:run -- --reporter=verbose
```

Expected before the fix, if any Deno function test is named `*.test.ts`: Vitest tries to load `jsr:` or `https:` imports from `supabase/functions/**` and fails. Current Deno files are `.deno.ts`; keep this as a regression guard.

- [ ] **Step 2: Create a dedicated integration config**

Create `vitest.integration.config.ts`:

```ts
import { mergeConfig } from 'vitest/config';
import baseConfig from './vitest.config';

export default mergeConfig(baseConfig, {
  test: {
    include: [
      'pages/**/*.test.tsx',
      'components/StockFormModal.test.tsx',
      'components/DevicesSoldAnalytics.test.tsx',
      'components/crm/**/*.test.tsx',
    ],
    exclude: [
      'node_modules/**',
      'dist/**',
      'supabase/functions/**',
    ],
    fileParallelism: false,
    testTimeout: 15000,
    hookTimeout: 15000,
  },
});
```

- [ ] **Step 3: Narrow the default Vitest config**

Modify `vitest.config.ts` so Deno functions are excluded explicitly and default unit tests do not pull the heaviest page integration files:

```ts
test: {
  environment: 'jsdom',
  globals: true,
  setupFiles: ['./tests/setup.ts'],
  include: ['**/*.test.ts', '**/*.test.tsx'],
  exclude: [
    'node_modules/**',
    'dist/**',
    'supabase/functions/**',
    'pages/**/*.test.tsx',
    'components/StockFormModal.test.tsx',
    'components/DevicesSoldAnalytics.test.tsx',
    'components/crm/**/*.test.tsx',
  ],
}
```

- [ ] **Step 4: Add scripts**

Modify `package.json` scripts:

```json
{
  "test:unit": "vitest run",
  "test:integration": "vitest run -c vitest.integration.config.ts",
  "test:all": "npm run test:unit && npm run test:integration",
  "test:deno": "deno test --allow-env --allow-net=localhost supabase/functions/**/*.deno.ts"
}
```

Keep existing `test:run` temporarily for compatibility. Do not remove it in this task.

- [ ] **Step 5: Verify split behavior**

Run:

```bash
npm run test:unit
npm run test:integration
npm run test:deno
```

Expected: Deno files are not collected by Vitest. Integration failures, if any remain, are isolated to integration script output.

## Task 2: Shared Supabase Query Mock Factory

**Files:**
- Create: `tests/utils/supabaseMock.ts`
- Modify: `pages/Settings.test.tsx`
- Modify: `pages/crm/ConversationsPage.newConversation.test.tsx`

- [ ] **Step 1: Write a failing unit test for the mock chain**

Create `tests/utils/supabaseMock.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { createSupabaseQueryMock } from './supabaseMock';

describe('createSupabaseQueryMock', () => {
  it('supports select, eq, order, limit, maybeSingle and awaited query chains', async () => {
    const query = createSupabaseQueryMock([{ id: 'row-1' }]);

    const result = await query
      .select('id')
      .eq('user_id', 'user-1')
      .order('created_at', { ascending: false })
      .limit(1);

    expect(result).toEqual({ data: [{ id: 'row-1' }], error: null });
    expect(query.eq).toHaveBeenCalledWith('user_id', 'user-1');
  });
});
```

Run:

```bash
npm run test:run -- tests/utils/supabaseMock.test.ts
```

Expected: fail because `tests/utils/supabaseMock.ts` does not exist.

- [ ] **Step 2: Implement the reusable query mock**

Create `tests/utils/supabaseMock.ts`:

```ts
import { vi } from 'vitest';

type QueryResult<T> = { data: T; error: null };

export function createSupabaseQueryMock<T>(data: T) {
  const result: QueryResult<T> = { data, error: null };
  const chain: any = {};

  for (const method of ['select', 'eq', 'neq', 'order', 'limit', 'range', 'in', 'is', 'gt', 'gte', 'lt', 'lte', 'contains', 'or']) {
    chain[method] = vi.fn(() => chain);
  }

  chain.single = vi.fn(async () => ({
    data: Array.isArray(data) ? (data[0] ?? null) : data,
    error: null,
  }));
  chain.maybeSingle = vi.fn(async () => ({
    data: Array.isArray(data) ? (data[0] ?? null) : data,
    error: null,
  }));
  chain.insert = vi.fn(() => chain);
  chain.update = vi.fn(() => chain);
  chain.delete = vi.fn(() => chain);
  chain.upsert = vi.fn(async () => result);
  chain.then = (resolve: (value: QueryResult<T>) => unknown) => Promise.resolve(resolve(result));

  return chain;
}
```

- [ ] **Step 3: Replace the Settings Supabase mock**

In `pages/Settings.test.tsx`, replace the local `supabaseSelectMock`/`supabaseOrderMock` style for `from()` with table-specific chains:

```ts
supabaseFromMock.mockImplementation((table: string) => {
  if (table === 'user_consents') return createSupabaseQueryMock([]);
  if (table === 'user_access_roles') return createSupabaseQueryMock([]);
  return createSupabaseQueryMock([]);
});
```

Add:

```ts
import { createSupabaseQueryMock } from '../tests/utils/supabaseMock';
```

- [ ] **Step 4: Verify Settings**

Run:

```bash
npm run test:run -- pages/Settings.test.tsx
```

Expected: no `select(...).eq is not a function` error. Remaining failures must be real Settings assertions, not broken mock chains.

- [ ] **Step 5: Replace duplicate CRM query chain helpers**

In `pages/crm/ConversationsPage.newConversation.test.tsx`, replace local `makeListChain` and `makeOrderResultChain` with `createSupabaseQueryMock` where behavior matches. Preserve special `insert().select().single()` behavior for `crm_conversations`.

Run:

```bash
npm run test:run -- pages/crm/ConversationsPage.newConversation.test.tsx
```

Expected: fewer local mock helpers and no missing Supabase chain methods.

## Task 3: Test Timer and Animation Harness

**Files:**
- Modify: `tests/setup.ts`
- Create: `tests/utils/renderWithMotion.tsx`
- Modify: `components/ui/Combobox.test.tsx`
- Modify: `components/ui/Modal.test.tsx`
- Modify: `pages/PDV.test.tsx`
- Modify: `pages/Inventory.test.tsx`

- [ ] **Step 1: Add missing browser timing APIs to setup**

Modify `tests/setup.ts`:

```ts
Object.defineProperty(window, 'requestAnimationFrame', {
  configurable: true,
  writable: true,
  value: (callback: FrameRequestCallback) => window.setTimeout(() => callback(performance.now()), 0),
});

Object.defineProperty(window, 'cancelAnimationFrame', {
  configurable: true,
  writable: true,
  value: (id: number) => window.clearTimeout(id),
});

if (!Element.prototype.scrollTo) {
  Object.defineProperty(Element.prototype, 'scrollTo', {
    configurable: true,
    writable: true,
    value: vi.fn(),
  });
}
```

- [ ] **Step 2: Create a motion-aware render helper**

Create `tests/utils/renderWithMotion.tsx`:

```tsx
import React from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { MotionConfig } from 'framer-motion';

export function renderWithMotion(ui: React.ReactElement, options?: RenderOptions) {
  return render(
    <MotionConfig reducedMotion="always">
      {ui}
    </MotionConfig>,
    options,
  );
}
```

- [ ] **Step 3: Prove Combobox timers are controlled**

Modify `components/ui/Combobox.test.tsx` to use `renderWithMotion` and `await screen.findByRole(...)` instead of immediate role queries after opening.

Run:

```bash
npm run test:run -- components/ui/Combobox.test.tsx
```

Expected: combobox test passes without 5s timeout.

- [ ] **Step 4: Apply render helper to PDV and Inventory**

In `pages/PDV.test.tsx` and `pages/Inventory.test.tsx`, replace direct `render(<PDV />)` and `render(<Inventory />)` with `renderWithMotion(<PDV />)` and `renderWithMotion(<Inventory />)`.

Use async queries after user navigation:

```ts
await user.click(screen.getByRole('button', { name: '2. Produto/Troca' }));
expect(await screen.findByRole('combobox', { name: 'Produto' })).toBeInTheDocument();
```

- [ ] **Step 5: Verify targeted slow tests**

Run:

```bash
npm run test:run -- pages/PDV.test.tsx -t "renders updated payment methods in PDV"
npm run test:run -- pages/Inventory.test.tsx -t "renders current stock table headers"
```

Expected: both pass within their existing per-test timeouts. If PDV still exceeds 10s, document actual duration and only then raise PDV-specific timeout for known matrix tests.

## Task 4: CRM Background Effects Control

**Files:**
- Modify: `pages/crm/ConversationsPage.newConversation.test.tsx`
- Modify: `pages/crm/ConversationsPage.tsx` only if a test-only seam is necessary and behavior remains unchanged by default.

- [ ] **Step 1: Confirm current act/polling issue**

Run:

```bash
npm run test:run -- pages/crm/ConversationsPage.newConversation.test.tsx
```

Expected before fix: React `act(...)` warnings and timeouts in multiple tests.

- [ ] **Step 2: Control intervals in the test**

In `beforeEach`, add a spy that prevents background polling intervals from running during these tests:

```ts
const intervalIds: number[] = [];
vi.spyOn(window, 'setInterval').mockImplementation((handler: TimerHandler, timeout?: number, ...args: any[]) => {
  const id = Number(globalThis.setTimeout(() => undefined, 0));
  intervalIds.push(id);
  return id;
});
vi.spyOn(window, 'clearInterval').mockImplementation((id: number) => {
  intervalIds.splice(intervalIds.indexOf(id), 1);
  clearTimeout(id);
});
```

In `afterEach`, restore mocks:

```ts
vi.restoreAllMocks();
```

If this conflicts with existing spies, move only interval stubbing to a helper and avoid `restoreAllMocks()` wiping table mocks before assertions.

- [ ] **Step 3: Ensure Supabase mocks cover all mounted tables**

In `supabaseFromMock.mockImplementation`, add explicit chains for:

```ts
if (table === 'crm_filter_views') return createSupabaseQueryMock([]);
if (table === 'crm_messages') return createSupabaseQueryMock([]);
```

Keep `crm_channels`, `crm_conversations`, and `user_access_roles` table-specific behavior.

- [ ] **Step 4: Verify CRM file**

Run:

```bash
npm run test:run -- pages/crm/ConversationsPage.newConversation.test.tsx
```

Expected: no act warnings from background polling and all tests pass. If a test still times out, inspect the exact awaited query and add a missing mock method instead of increasing timeout.

## Task 5: PDV Flow Helpers

**Files:**
- Modify: `pages/PDV.test.tsx`
- Create: `tests/utils/pdvFlow.tsx` only if helpers are reusable without circular imports.

- [ ] **Step 1: Add wait-based helpers inside PDV test**

Replace immediate product/seller/client clicks with helpers that wait for options:

```ts
const chooseComboboxOption = async (
  user: ReturnType<typeof userEvent.setup>,
  label: string,
  option: string | RegExp,
) => {
  await user.click(await screen.findByRole('combobox', { name: label }));
  await user.click(await screen.findByText(option));
};
```

Use:

```ts
await chooseComboboxOption(user, 'Vendedor', 'Vendedor Teste');
await chooseComboboxOption(user, 'Loja', 'Loja Centro');
await chooseComboboxOption(user, 'Cliente', 'Cliente Teste');
```

- [ ] **Step 2: Make step navigation explicit**

Before selecting product:

```ts
await user.click(screen.getByRole('button', { name: '2. Produto/Troca' }));
expect(await screen.findByRole('combobox', { name: 'Produto' })).toBeInTheDocument();
```

Do not assume the wizard auto-advanced.

- [ ] **Step 3: Reduce matrix blast radius**

Keep one full end-to-end sale test per payment family:

- Pix with no trade-in.
- Cartao Credito with no trade-in.
- Devedor with trade-in.

Move repeated payment payload combinations into pure utility tests if utilities exist. If no pure utility exists, leave the matrix but give each matrix test `30000ms` after helpers are wait-based.

- [ ] **Step 4: Verify PDV file**

Run:

```bash
npm run test:run -- pages/PDV.test.tsx
```

Expected: PDV tests pass or only clearly identified assertion failures remain. Timeouts caused by missing UI state should be gone.

## Task 6: Finance and Inventory Suite Isolation

**Files:**
- Modify: `pages/Finance.test.tsx`
- Modify: `pages/Inventory.test.tsx`
- Modify: `tests/setup.ts` if shared cleanup is needed.

- [ ] **Step 1: Add per-test cleanup for leaked DOM state**

In tests that open modals or change body styles, add afterEach:

```ts
afterEach(() => {
  document.body.style.overflow = '';
  document.body.removeAttribute('style');
});
```

Use Testing Library cleanup only if not already automatic.

- [ ] **Step 2: Convert synchronous render assertions to async stabilization**

For Inventory's first test:

```ts
renderWithMotion(<Inventory />);

expect(await screen.findByRole('button', { name: 'Geral' })).toBeInTheDocument();
const table = await screen.findByRole('table');
```

For Finance tests that click rows/details, use `findByRole`/`findByText` after render before interaction.

- [ ] **Step 3: Verify files alone and through integration config**

Run:

```bash
npm run test:run -- pages/Inventory.test.tsx
npm run test:run -- pages/Finance.test.tsx
npm run test:integration -- pages/Inventory.test.tsx pages/Finance.test.tsx
```

Expected: both files pass alone and under integration config.

## Task 7: Remove Unused Test Mocks, Helpers, Files, and Dependencies

**Files:**
- Modify: test files touched in previous tasks.
- Modify: `package.json` only if an unused dependency is proven unused.
- Modify: `eslint.config.js` only if adding a rule with a passing verification command.

- [ ] **Step 1: Run built-in unused checks**

Run:

```bash
npm run typecheck
npm run lint
```

Expected: typecheck catches unused locals/params because `tsconfig.json` has `noUnusedLocals` and `noUnusedParameters`. Lint currently has no unused rules; do not treat it as sufficient alone.

- [ ] **Step 2: Run a one-off unused dependency/file audit**

Run without changing package files first:

```bash
npx knip --include files,dependencies,exports --exclude binaries
```

Expected: a report of candidate unused files/dependencies/exports. Treat every item as suspect until verified with `rg`.

- [ ] **Step 3: Verify each removal candidate manually**

For each candidate path or package:

```bash
rg -n "candidateName|candidate/path" . -g '!node_modules' -g '!dist'
```

Remove only candidates with no runtime/test usage and no dynamic import path. Do not remove assets referenced by manifest, service worker, HTML, Supabase config, or external deployment scripts.

- [ ] **Step 4: Remove duplicated local mocks replaced by shared helpers**

Remove local helpers that are fully replaced by `tests/utils/supabaseMock.ts`, such as:

- `makeListChain` in CRM tests, if no special insert/select/single behavior remains.
- `supabaseSelectMock` and `supabaseOrderMock` in Settings tests after table-specific mock factory is used.

- [ ] **Step 5: Verify after removals**

Run:

```bash
npm run typecheck
npm run lint
npm run test:unit
npm run test:integration
npm run test:deno
npm run build
```

Expected: all pass. If a removal breaks any command, restore that removal and record why the item is actually used.

## Task 8: Final Full Verification and Baseline Report

**Files:**
- Create: `reports/test-infra-baseline-2026-05-15.md`

- [ ] **Step 1: Generate final baseline report**

Create `reports/test-infra-baseline-2026-05-15.md`:

```md
# Test Infrastructure Baseline - 2026-05-15

## Commands

- npm run typecheck
- npm run lint
- npm run test:unit
- npm run test:integration
- npm run test:deno
- npm run build

## Result

Record pass/fail, failure count, and remaining domains.

## Removed As Unused

List removed files, mocks, exports, or dependencies with the command that proved removal safe.

## Not Removed

List candidates kept because they are dynamically referenced or externally deployed.
```

- [ ] **Step 2: Run final commands**

Run:

```bash
npm run typecheck
npm run lint
npm run test:unit
npm run test:integration
npm run test:deno
npm run build
```

Expected: all commands pass before claiming the test infrastructure is stable.

- [ ] **Step 3: Commit**

Run:

```bash
git add vitest.config.ts vitest.integration.config.ts package.json package-lock.json tests pages components reports eslint.config.js
git commit -m "test: stabilize suite infrastructure"
```

Expected: commit contains only test infrastructure, test updates, reports, and verified unused cleanup. No unrelated product behavior changes.
