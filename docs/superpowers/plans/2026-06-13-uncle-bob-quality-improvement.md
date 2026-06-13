# Uncle Bob Quality Improvement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce the codebase's highest structural risks without changing observable behavior, using characterization tests, measurable coverage, scoped mutation testing, and small reversible extractions.

**Architecture:** Treat this as an incremental quality campaign rather than a rewrite. First establish measurable test protection, then extract stable domain logic and infrastructure from the most complex modules while preserving their public APIs; UI decomposition comes only after pure behavior is protected. Each wave must remain independently releasable and must improve or preserve complexity, coverage, mutation score, dependency cycles, and duplication.

**Tech Stack:** React 19, TypeScript 5.8, Vite 6, Vitest 4, Testing Library, Supabase JS, Deno tests, Stryker Mutator, Python `audit_codebase.py`.

---

## Audit Basis

Source: `output/uncle-bob-performance-after.md`.

| Risk | Baseline | Engineering reason |
|---|---:|---|
| Coverage | Not measured | T1/T2: tests may execute behavior without protecting all branches |
| Mutation | Not measured | Coverage alone cannot prove assertions detect incorrect behavior |
| Dependency cycles | 0 | ADP is healthy and must remain at zero |
| Functions above complexity 5 | 166/832 | High path count makes changes expensive to reason about |
| Functions above 20 lines | 178 | Mixed abstraction levels and multiple responsibilities |
| Files above 200 lines | 69 | Likely SRP/CCP violations and broad change surfaces |
| Duplication | ~4.0% | Warning range; abstractions should be introduced only after behavior is characterized |
| `DataProvider` | complexity 914, 3,218 function lines, I=0.23, Ca=31 | Central concrete module in the Zone of Pain; changes can affect most application routes |
| `PDV` | complexity 487, 2,889 function lines | Checkout, calculations, persistence, printing, and UI live in one component |
| `ConversationsPage` | complexity 392, 1,859 function lines | Realtime/polling, composer, media, filters, and presentation are coupled |
| `StockFormModal` | complexity 294, 1,826 function lines | Form state, photo queue, uploads, costs, catalog, and rendering are coupled |

## Non-Regression Rules

1. Structural refactoring and behavior changes never share a commit.
2. Before extracting behavior, add or identify a characterization test that fails if that behavior changes.
3. After every extraction run the focused tests and `npm run typecheck`.
4. After every wave run the complete Vitest suite and production build.
5. Keep dependency cycles at zero.
6. Coverage and mutation score for touched files may not decrease.
7. Do not change the public shape of `useData()` during the first provider wave.
8. Do not alter visible labels, navigation, form defaults, validation messages, persistence keys, database payloads, or realtime semantics unless a separate behavior task is approved.
9. Each commit must compile and pass its focused tests.

## File Structure

### Quality tooling

- Modify `package.json`
  - Add coverage, mutation, and audit scripts.
- Modify the active lockfile
  - Record exact compatible versions.
- Create `stryker.config.mjs`
  - Start with a narrow set of pure modules; never mutate the entire React application initially.
- Create `docs/quality/quality-baseline.md`
  - Record commands and before/after metrics for each wave.

### Data provider

- Create `services/data/dataContextTypes.ts`
  - Own the public context contract and input types.
- Create `services/data/dataLoaders.ts`
  - Own Supabase read orchestration for shell, sales, and finance groups.
- Create `services/data/dataLoaders.test.ts`
  - Verify table selection, role restrictions, ordering, and transaction limit.
- Create `services/data/realtime/realtimeState.ts`
  - Own pure immutable row upsert/delete/cascade functions.
- Create `services/data/realtime/realtimeState.test.ts`
  - Protect sale/debt/payment/transaction cascade behavior.
- Create `services/data/useDataRealtime.ts`
  - Own channel registration and cleanup while accepting explicit callbacks/state ports.
- Modify `services/dataContext.tsx`
  - Retain state ownership, mutation commands, compatibility API, and composition.
- Modify `services/dataContext.test.tsx`
  - Keep integration coverage and add contract tests before moving realtime behavior.

### PDV and inventory

- Create `pages/pdv/pdvCalculations.ts`
  - Own totals, discount limits, trade-in totals, remaining balance, and warranty derivation.
- Create `pages/pdv/pdvCalculations.test.ts`
- Create `pages/pdv/pdvDraft.ts`
  - Own serialization, validation, restore, and clearing of `pdv:draft:v1`.
- Create `pages/pdv/pdvDraft.test.ts`
- Create `pages/pdv/buildSalePayload.ts`
  - Own the final `Sale` construction without side effects.
- Create `pages/pdv/buildSalePayload.test.ts`
- Create `pages/inventory/inventoryViewModel.ts`
  - Own filtering, sorting, pagination inputs, reservation summaries, and share selection.
- Create `pages/inventory/inventoryViewModel.test.ts`
- Modify `pages/PDV.tsx` and `pages/Inventory.tsx`
  - Delegate pure policy while retaining orchestration and rendering.

### Stock form

- Create `components/stock-form/photoQueue.ts`
  - Own immutable photo queue transitions.
- Create `components/stock-form/photoQueue.test.ts`
- Create `components/stock-form/useStockPhotoQueue.ts`
  - Own object URL lifecycle and upload orchestration.
- Create `components/stock-form/stockFormModel.ts`
  - Own initial form data, normalization, and persistence payload creation.
- Create `components/stock-form/stockFormModel.test.ts`
- Modify `components/StockFormModal.tsx`
  - Compose focused hooks and sections without changing props.
- Modify `components/StockFormModal.test.tsx`
  - Preserve modal-level workflows.

### CRM conversations

- Create `pages/crm/conversations/conversationOrdering.ts`
- Create `pages/crm/conversations/conversationOrdering.test.ts`
- Create `pages/crm/conversations/useConversationFeed.ts`
- Create `pages/crm/conversations/useMessageComposer.ts`
- Create `pages/crm/conversations/ConversationFilters.tsx`
- Create `pages/crm/conversations/ConversationThread.tsx`
- Modify `pages/crm/ConversationsPage.tsx`
- Modify the existing `pages/crm/ConversationsPage.*.test.tsx` files.

### Finance, settings, debts, and warranties

- Create `pages/finance/financeViewModel.ts` and tests.
- Create `pages/settings/FinancialCategoriesSection.tsx`.
- Create `pages/settings/AccessManagementSection.tsx`.
- Create `pages/debts/debtFormModel.ts` and tests.
- Create `pages/warranties/warrantyFormModel.ts` and tests.
- Modify the corresponding page components while preserving route-level APIs.

### Server functions and scripts

- Create focused modules beside each function rather than a shared generic utility.
- Add Deno tests beside extracted modules.
- Replace functions with more than three positional parameters by named input objects only after tests capture current calls.

---

### Task 1: Install Measurement Infrastructure

**Files:**
- Modify: `package.json`
- Modify: active lockfile
- Create: `stryker.config.mjs`
- Create: `docs/quality/quality-baseline.md`

- [ ] **Step 1: Verify the current baseline**

Run:

```bash
PATH="$HOME/.local/bin:$HOME/.deno/bin:/opt/homebrew/bin:$PATH" npm test
PATH="$HOME/.local/bin:$HOME/.deno/bin:/opt/homebrew/bin:$PATH" npm run typecheck
PATH="$HOME/.local/bin:$HOME/.deno/bin:/opt/homebrew/bin:$PATH" npm run build
```

Expected: all commands exit `0`. If any command fails, stop and fix or document the pre-existing failure before refactoring.

- [ ] **Step 2: Install coverage and mutation tools**

Run:

```bash
PATH="$HOME/.local/bin:$HOME/.deno/bin:/opt/homebrew/bin:$PATH" npm install --save-dev @vitest/coverage-v8@^4.0.18 @stryker-mutator/core @stryker-mutator/vitest-runner
```

Expected: dependency installation succeeds without changing production dependencies.

- [ ] **Step 3: Add deterministic quality scripts**

Add to `package.json`:

```json
{
  "scripts": {
    "test:coverage": "vitest run --coverage --coverage.reporter=json-summary --coverage.reporter=lcov --coverage.reporter=text",
    "test:mutation": "stryker run",
    "audit:quality": "python3 /Users/italo/.codex/skills/uncle-bob/scripts/audit_codebase.py . --top 20 --output output/uncle-bob-quality-current.md"
  }
}
```

- [ ] **Step 4: Configure mutation for pure modules only**

Create `stryker.config.mjs`:

```js
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  testRunner: 'vitest',
  mutate: [
    'utils/**/*.ts',
    'pages/pdv/**/*.ts',
    'pages/inventory/**/*.ts',
    'components/stock-form/**/*.ts',
    '!**/*.test.ts'
  ],
  reporters: ['clear-text', 'progress', 'html', 'json'],
  jsonReporter: { fileName: 'reports/mutation/mutation.json' },
  coverageAnalysis: 'perTest',
  thresholds: { high: 70, low: 50, break: 50 }
};
```

- [ ] **Step 5: Generate measurable baseline**

Run:

```bash
PATH="$HOME/.local/bin:$HOME/.deno/bin:/opt/homebrew/bin:$PATH" npm run test:coverage
PATH="$HOME/.local/bin:$HOME/.deno/bin:/opt/homebrew/bin:$PATH" npm run audit:quality
```

Expected: `coverage/coverage-summary.json`, `coverage/lcov.info`, and `output/uncle-bob-quality-current.md` exist; the audit includes a risk matrix.

- [ ] **Step 6: Record baseline**

Create `docs/quality/quality-baseline.md` with:

```markdown
# Quality Baseline

Date: 2026-06-13

| Metric | Baseline |
|---|---:|
| Vitest files/tests | 76 files / 452 tests |
| Line coverage | Generated by `npm run test:coverage` in Task 1 Step 5 |
| Branch coverage | Generated by `npm run test:coverage` in Task 1 Step 5 |
| Dependency cycles | 0 |
| Functions with complexity > 5 | 166/832 |
| Files > 200 lines | 69 |
| Duplication | ~4.0% |

Mutation is introduced after the first pure extraction so the initial scope is deterministic.
```

Replace the two command-source descriptions with the exact measured percentages before committing.

- [ ] **Step 7: Commit tooling**

```bash
git add package.json package-lock.json deno.lock stryker.config.mjs docs/quality/quality-baseline.md
git commit -m "test: add coverage and mutation quality gates"
```

Add only lockfiles actually modified.

---

### Task 2: Freeze the DataProvider Public Contract

**Files:**
- Modify: `services/dataContext.test.tsx`
- Create: `services/data/dataContextContract.test.tsx`

- [ ] **Step 1: Add a public contract probe**

Create a test that renders `DataProvider`, captures `useData()`, and asserts the stable API keys:

```tsx
const REQUIRED_DATA_CONTEXT_KEYS = [
  'businessProfile',
  'stock',
  'customers',
  'sales',
  'transactions',
  'loading',
  'refreshData',
  'ensureSalesHistoryLoaded',
  'ensureFinanceLoaded',
  'addSale',
  'updateSale',
  'removeSale',
  'addStockItem',
  'updateStockItem',
  'removeStockItem'
] as const;

it('preserves the public useData contract during provider refactoring', async () => {
  let value: ReturnType<typeof useData> | undefined;

  function Probe() {
    value = useData();
    return null;
  }

  render(
    <DataProvider>
      <Probe />
    </DataProvider>
  );

  await waitFor(() => expect(value?.loading).toBe(false));
  expect(Object.keys(value || {})).toEqual(expect.arrayContaining(REQUIRED_DATA_CONTEXT_KEYS));
});
```

- [ ] **Step 2: Add reset and cleanup characterization**

Add tests proving:

```tsx
it('clears loaded groups after authentication is removed', async () => {
  // Render authenticated, explicitly load sales and finance, rerender unauthenticated.
  // Assert sales, transactions, debts, and loading flags return to their defaults.
});

it('removes the realtime channel on unmount', async () => {
  const { unmount } = render(<DataProvider><DataLoadProbe /></DataProvider>);
  await waitFor(() => expect(channelSubscribeMock).toHaveBeenCalled());
  unmount();
  expect(removeChannelMock).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 3: Run the new tests**

```bash
PATH="$HOME/.local/bin:$HOME/.deno/bin:/opt/homebrew/bin:$PATH" npm test -- services/data/dataContextContract.test.tsx services/dataContext.test.tsx
```

Expected: the cleanup test may expose a missing reset edge; if so, make the smallest behavior fix in a separate commit before any extraction.

- [ ] **Step 4: Commit characterization**

```bash
git add services/data/dataContextContract.test.tsx services/dataContext.test.tsx
git commit -m "test: characterize data context compatibility contract"
```

---

### Task 3: Extract Data Context Types

**Files:**
- Create: `services/data/dataContextTypes.ts`
- Modify: `services/dataContext.tsx`
- Test: `services/data/dataContextContract.test.tsx`

- [ ] **Step 1: Move exported input types without renaming**

Move `DataContextType`, `CostHistoryItem`, `AddDebtInput`, `UpdateDebtInput`, `PayDebtInput`, `AddPayableDebtInput`, `UpdatePayableDebtInput`, `AddPayableDebtPaymentInput`, `AddPartInput`, and `UpdatePartInput` into `services/data/dataContextTypes.ts`.

Keep the context type export explicit:

```ts
export interface DataContextType {
  // Copy the existing properties and signatures exactly.
}
```

- [ ] **Step 2: Re-export compatibility types**

In `services/dataContext.tsx`:

```ts
export type {
  AddDebtInput,
  UpdateDebtInput,
  PayDebtInput,
  AddPayableDebtInput,
  UpdatePayableDebtInput,
  AddPayableDebtPaymentInput,
  AddPartInput,
  UpdatePartInput,
  CostHistoryItem
} from './data/dataContextTypes';
```

Import the same types locally with `import type`.

- [ ] **Step 3: Verify no consumer changes are required**

```bash
PATH="$HOME/.local/bin:$HOME/.deno/bin:/opt/homebrew/bin:$PATH" npm run typecheck
PATH="$HOME/.local/bin:$HOME/.deno/bin:/opt/homebrew/bin:$PATH" npm test -- services/data/dataContextContract.test.tsx services/dataContext.test.tsx
```

Expected: PASS with no public import changes.

- [ ] **Step 4: Commit**

```bash
git add services/data/dataContextTypes.ts services/dataContext.tsx
git commit -m "refactor: extract data context contracts"
```

---

### Task 4: Extract Data Read Loaders

**Files:**
- Create: `services/data/dataLoaders.ts`
- Create: `services/data/dataLoaders.test.ts`
- Modify: `services/dataContext.tsx`

- [ ] **Step 1: Write failing loader tests**

Define a minimal query-port interface and assert:

```ts
it('loads shell tables in parallel without sales or finance tables', async () => {
  await loadShellAndCoreData(client);
  expect(selectedTables).toEqual(expect.arrayContaining([
    'business_profile',
    'card_fee_settings',
    'stores',
    'customers',
    'sellers',
    'stock_items',
    'stock_reservations',
    'device_catalog'
  ]));
  expect(selectedTables).not.toContain('sales');
  expect(selectedTables).not.toContain('transactions');
});

it('does not query admin-only finance tables for sellers', async () => {
  await loadFinanceData(client, 'seller');
  expect(selectedTables).not.toEqual(expect.arrayContaining([
    'debts',
    'transactions',
    'creditors',
    'payable_debts'
  ]));
});

it('keeps the transaction safety limit', async () => {
  await loadFinanceData(client, 'admin');
  expect(limitCalls).toContainEqual({ table: 'transactions', limit: 100000 });
});
```

- [ ] **Step 2: Run tests to verify RED**

```bash
PATH="$HOME/.local/bin:$HOME/.deno/bin:/opt/homebrew/bin:$PATH" npm test -- services/data/dataLoaders.test.ts
```

Expected: FAIL because `dataLoaders.ts` does not exist.

- [ ] **Step 3: Implement loader functions**

Create three named functions:

1. `loadShellAndCoreData(client)` receives the Supabase client and moves the exact eleven-query `Promise.all` currently at `services/dataContext.tsx:393-431`.
2. `loadSalesHistoryData(client)` returns `client.from('sales').select(SALES_SELECT)`.
3. `loadFinanceData(client, role)` moves the exact nine-result finance `Promise.all` currently at `services/dataContext.tsx:581-603`, including empty resolved results for non-admin roles.

Export `SALES_SELECT` from this module so the sales query remains defined once. Return named result objects matching the current `applyShellAndCoreData` and `applyFinanceData` parameter names; this keeps the provider call sites type-safe without positional tuple knowledge.

- [ ] **Step 4: Delegate from DataProvider**

Replace inline query construction with:

```ts
const results = await loadShellAndCoreData(supabase);
const salesResult = await loadSalesHistoryData(supabase);
const financeResults = await loadFinanceData(supabase, role);
```

Do not move state application in this task.

- [ ] **Step 5: Verify**

```bash
PATH="$HOME/.local/bin:$HOME/.deno/bin:/opt/homebrew/bin:$PATH" npm test -- services/data/dataLoaders.test.ts services/dataContext.test.tsx
PATH="$HOME/.local/bin:$HOME/.deno/bin:/opt/homebrew/bin:$PATH" npm run typecheck
```

- [ ] **Step 6: Commit**

```bash
git add services/data/dataLoaders.ts services/data/dataLoaders.test.ts services/dataContext.tsx
git commit -m "refactor: extract grouped data loaders"
```

---

### Task 5: Extract Pure Realtime State Transitions

**Files:**
- Create: `services/data/realtime/realtimeState.ts`
- Create: `services/data/realtime/realtimeState.test.ts`
- Modify: `services/dataContext.tsx`

- [ ] **Step 1: Characterize generic row transitions**

Add tests for immutable helpers:

```ts
expect(upsertById([{ id: '1', name: 'old' }], { id: '1', name: 'new' }))
  .toEqual([{ id: '1', name: 'new' }]);

expect(upsertById([{ id: '1' }], { id: '2' }))
  .toEqual([{ id: '1' }, { id: '2' }]);

expect(removeById([{ id: '1' }, { id: '2' }], '1'))
  .toEqual([{ id: '2' }]);
```

- [ ] **Step 2: Characterize sale deletion cascades**

Create a pure input/output contract:

```ts
const next = removeSaleCascade({
  saleId: 'sale-1',
  sales,
  transactions,
  debts,
  debtPayments,
  payableDebts,
  payableDebtPayments,
  stock
});

expect(next.sales).toEqual([]);
expect(next.transactions).toEqual([]);
expect(next.debts).toEqual([]);
expect(next.stock[0].status).toBe(StockStatus.AVAILABLE);
```

Cover sales with receivable debt, payable debt, both payment link types, and no local sale.

- [ ] **Step 3: Run RED**

```bash
PATH="$HOME/.local/bin:$HOME/.deno/bin:/opt/homebrew/bin:$PATH" npm test -- services/data/realtime/realtimeState.test.ts
```

- [ ] **Step 4: Implement pure functions**

Export:

```ts
export const upsertById = <T extends { id: string }>(rows: T[], incoming: T): T[] =>
  rows.some((row) => row.id === incoming.id)
    ? rows.map((row) => row.id === incoming.id ? incoming : row)
    : [...rows, incoming];

export const removeById = <T extends { id: string }>(rows: T[], id: string): T[] =>
  rows.filter((row) => row.id !== id);
```

Define `SaleCascadeState`, `DebtCascadeState`, and `PayableDebtCascadeState` with the exact affected arrays, then move the existing deletion predicates from the corresponding realtime handlers into `removeSaleCascade`, `removeDebtCascade`, and `removePayableDebtCascade`. Return a new object containing every updated array. Do not simplify conditions until mutation tests exist.

- [ ] **Step 5: Replace only equivalent inline transitions**

For each replacement:

1. Replace one handler.
2. Run `realtimeState.test.ts` and `dataContext.test.tsx`.
3. Commit if the handler family is complete.

Suggested order: simple catalog rows, stock rows, debts, payable debts, sales.

- [ ] **Step 6: Verify and commit**

```bash
PATH="$HOME/.local/bin:$HOME/.deno/bin:/opt/homebrew/bin:$PATH" npm test -- services/data/realtime/realtimeState.test.ts services/dataContext.test.tsx
PATH="$HOME/.local/bin:$HOME/.deno/bin:/opt/homebrew/bin:$PATH" npm run typecheck
git add services/data/realtime/realtimeState.ts services/data/realtime/realtimeState.test.ts services/dataContext.tsx
git commit -m "refactor: extract realtime state transitions"
```

---

### Task 6: Extract Realtime Subscription Composition

**Files:**
- Create: `services/data/useDataRealtime.ts`
- Modify: `services/dataContext.tsx`
- Modify: `services/dataContext.test.tsx`

- [ ] **Step 1: Add subscription contract tests**

Assert the exact table list currently registered and cleanup:

```ts
expect(registeredTables).toEqual(expect.arrayContaining([
  'business_profile',
  'sales',
  'sale_items',
  'payment_methods',
  'transactions',
  'debts',
  'debt_payments',
  'stock_items',
  'stock_reservations',
  'customers',
  'sellers',
  'stores',
  'finance_categories',
  'payable_debts',
  'payable_debt_payments'
]));
```

- [ ] **Step 2: Introduce explicit ports**

Define:

```ts
export interface DataRealtimePorts {
  role: AppRole | null;
  scheduleResync(reason: string, options?: { force?: boolean }): void;
  onBusinessProfile(payload: RealtimePostgresChangesPayload<Record<string, unknown>>): void;
  onSale(payload: RealtimePostgresChangesPayload<Record<string, unknown>>): Promise<void>;
  onTransaction(payload: RealtimePostgresChangesPayload<Record<string, unknown>>): Promise<void>;
  onDebt(payload: RealtimePostgresChangesPayload<Record<string, unknown>>): Promise<void> | void;
  onPayableDebt(payload: RealtimePostgresChangesPayload<Record<string, unknown>>): Promise<void> | void;
  onStock(payload: RealtimePostgresChangesPayload<Record<string, unknown>>): Promise<void> | void;
  onCustomer(payload: RealtimePostgresChangesPayload<Record<string, unknown>>): void;
  onSeller(payload: RealtimePostgresChangesPayload<Record<string, unknown>>): void;
  onStore(payload: RealtimePostgresChangesPayload<Record<string, unknown>>): void;
}
```

Add equivalent explicitly named callbacks for the remaining currently subscribed tables: card fees, simulator values, simulator adjustments, sale children, debt payments, reservations, costs, parts, device catalog, cost history, finance categories, creditors, and payable debt payments.

The hook may depend on Supabase; state policy remains in passed callbacks.

- [ ] **Step 3: Move channel registration unchanged**

Implement:

```ts
export const useDataRealtime = (
  isAuthenticated: boolean,
  ports: DataRealtimePorts
): void => {
  useEffect(() => {
    if (!isAuthenticated) return;
    const channel = supabase.channel('data-realtime');
    // Register existing handlers through ports.
    channel.subscribe((status) => { /* preserve degraded/resync semantics */ });
    return () => { void supabase.removeChannel(channel); };
  }, [isAuthenticated, ports]);
};
```

Memoize the `ports` object in `DataProvider` to prevent resubscription loops.

- [ ] **Step 4: Verify**

```bash
PATH="$HOME/.local/bin:$HOME/.deno/bin:/opt/homebrew/bin:$PATH" npm test -- services/dataContext.test.tsx
PATH="$HOME/.local/bin:$HOME/.deno/bin:/opt/homebrew/bin:$PATH" npm run typecheck
```

- [ ] **Step 5: Audit the first provider wave**

```bash
PATH="$HOME/.local/bin:$HOME/.deno/bin:/opt/homebrew/bin:$PATH" npm run test:coverage
PATH="$HOME/.local/bin:$HOME/.deno/bin:/opt/homebrew/bin:$PATH" npm run audit:quality
```

Gate:

- `DataProvider` complexity and function length decrease.
- `services/dataContext.tsx` coverage does not decrease.
- dependency cycles remain `0`.
- duplication does not exceed the baseline.

- [ ] **Step 6: Commit**

```bash
git add services/data/useDataRealtime.ts services/dataContext.tsx services/dataContext.test.tsx
git commit -m "refactor: isolate data realtime subscription"
```

---

### Task 7: Extract PDV Domain Policy

**Files:**
- Create: `pages/pdv/pdvCalculations.ts`
- Create: `pages/pdv/pdvCalculations.test.ts`
- Create: `pages/pdv/pdvDraft.ts`
- Create: `pages/pdv/pdvDraft.test.ts`
- Create: `pages/pdv/buildSalePayload.ts`
- Create: `pages/pdv/buildSalePayload.test.ts`
- Modify: `pages/PDV.tsx`
- Keep: `pages/PDV.test.tsx`, `pages/PDV.tradeIn.red.test.tsx`, `pages/PDV.whatsapp.red.test.tsx`

- [ ] **Step 1: Characterize calculations**

Cover:

```ts
it.each([
  { cart: 3000, tradeIn: 0, payments: 1000, expected: 2000 },
  { cart: 3000, tradeIn: 500, payments: 2500, expected: 0 },
  { cart: 3000, tradeIn: 3500, payments: 0, expected: -500 }
])('calculates remaining balance', ({ cart, tradeIn, payments, expected }) => {
  expect(calculateRemainingBalance({ cartTotal: cart, tradeInTotal: tradeIn, paymentTotal: payments }))
    .toBe(expected);
});
```

Also test maximum discount, negotiated price clamping, card fee totals, client refund, and store warranty dates.

- [ ] **Step 2: Move pure calculations**

Export named functions with object parameters:

```ts
export interface PdvTotalsInput {
  cartItems: StockItem[];
  tradeInItems: SaleTradeInItem[];
  payments: PaymentMethod[];
  negotiatedPrice: number;
}
```

Implement `calculatePdvTotals(input)` by moving the existing `PDV.tsx` total, trade-in, payment, negotiated-price, discount, and remaining-balance formulas without changing rounding order. Do not move React state in this step.

- [ ] **Step 3: Characterize draft persistence**

Test invalid JSON, version mismatch, valid restore, and clear:

```ts
expect(readPdvDraft(storage)).toBeNull();
writePdvDraft(storage, draft);
expect(readPdvDraft(storage)).toEqual(draft);
clearPdvDraft(storage);
expect(storage.getItem(PDV_DRAFT_KEY)).toBeNull();
```

- [ ] **Step 4: Extract final sale payload**

Use an object parameter and assert the exact payload currently passed to `addSale`:

```ts
export const buildSalePayload = (input: BuildSalePayloadInput): Sale => ({
  // Move current mapping unchanged.
});
```

- [ ] **Step 5: Delegate from PDV**

Replace only calculation, draft, and payload blocks. Keep modal orchestration, navigation, printing, WhatsApp, and mutation calls in `PDV.tsx`.

- [ ] **Step 6: Verify and mutate**

```bash
PATH="$HOME/.local/bin:$HOME/.deno/bin:/opt/homebrew/bin:$PATH" npm test -- pages/pdv pages/PDV.test.tsx pages/PDV.tradeIn.red.test.tsx pages/PDV.whatsapp.red.test.tsx
PATH="$HOME/.local/bin:$HOME/.deno/bin:/opt/homebrew/bin:$PATH" npm run typecheck
PATH="$HOME/.local/bin:$HOME/.deno/bin:/opt/homebrew/bin:$PATH" npm run test:mutation
```

Gate: mutation score for `pages/pdv/**/*.ts` is at least 70%; add assertions for surviving business-rule mutants before continuing.

- [ ] **Step 7: Commit**

```bash
git add pages/pdv pages/PDV.tsx pages/PDV.test.tsx pages/PDV.tradeIn.red.test.tsx pages/PDV.whatsapp.red.test.tsx
git commit -m "refactor: extract pdv domain policy"
```

---

### Task 8: Extract Inventory View Model

**Files:**
- Create: `pages/inventory/inventoryViewModel.ts`
- Create: `pages/inventory/inventoryViewModel.test.ts`
- Modify: `pages/Inventory.tsx`
- Modify: `pages/Inventory.test.tsx`

- [ ] **Step 1: Characterize filtering and sorting**

Test condition, status, store, search, battery, capacity, reservation expiry, and model numeric ordering.

- [ ] **Step 2: Extract a single pure selector**

```ts
export const selectInventoryRows = ({
  stock,
  search,
  statuses,
  condition,
  storeId,
  now
}: InventorySelectionInput): StockItem[] => {
  // Preserve existing filter and sort order.
};
```

Pass `now` explicitly to keep tests repeatable.

- [ ] **Step 3: Move share text helpers**

Move `parseCapacityToGb`, share truncation, item formatting, and `buildStockShareText` into the view-model module while re-exporting `buildStockShareText` from `Inventory.tsx` for compatibility.

- [ ] **Step 4: Verify and commit**

```bash
PATH="$HOME/.local/bin:$HOME/.deno/bin:/opt/homebrew/bin:$PATH" npm test -- pages/inventory/inventoryViewModel.test.ts pages/Inventory.test.tsx
PATH="$HOME/.local/bin:$HOME/.deno/bin:/opt/homebrew/bin:$PATH" npm run typecheck
git add pages/inventory pages/Inventory.tsx pages/Inventory.test.tsx
git commit -m "refactor: extract inventory view model"
```

---

### Task 9: Extract Stock Form Models and Photo Queue

**Files:**
- Create: `components/stock-form/photoQueue.ts`
- Create: `components/stock-form/photoQueue.test.ts`
- Create: `components/stock-form/stockFormModel.ts`
- Create: `components/stock-form/stockFormModel.test.ts`
- Create: `components/stock-form/useStockPhotoQueue.ts`
- Modify: `components/StockFormModal.tsx`
- Modify: `components/StockFormModal.test.tsx`

- [ ] **Step 1: Characterize queue transitions**

Test add, remove, move boundaries, cover selection, upload success, upload failure, retry, and object URL cleanup.

- [ ] **Step 2: Implement immutable queue reducer**

```ts
export type PhotoQueueAction =
  | { type: 'added'; photos: QueuedPhoto[] }
  | { type: 'removed'; id: string }
  | { type: 'moved'; id: string; direction: -1 | 1 }
  | { type: 'cover-selected'; id: string }
  | { type: 'upload-started'; id: string }
  | { type: 'upload-succeeded'; id: string; url: string }
  | { type: 'upload-failed'; id: string; message: string };

export const reducePhotoQueue = (state: PhotoQueueState, action: PhotoQueueAction): PhotoQueueState => {
  switch (action.type) {
    case 'added':
      return { ...state, queued: [...state.queued, ...action.photos] };
    case 'removed':
      return { ...state, queued: state.queued.filter((photo) => photo.id !== action.id) };
    default:
      return state;
  }
};
```

Add the remaining tested cases one at a time: bounded movement, cover selection, upload start, success removal plus uploaded URL insertion, and failure status/message.

- [ ] **Step 3: Characterize form normalization**

Test IMEI/serial normalization, battery clamping, empty observations, acquisition cost, draft context, and create/edit payloads.

- [ ] **Step 4: Extract upload lifecycle hook**

The hook owns local queue and preview URL cleanup; it receives `uploadImage` as a dependency so tests do not require storage/network.

- [ ] **Step 5: Delegate from modal**

Keep the existing `StockFormModalProps` unchanged. Replace local queue callbacks and payload construction while preserving tab flow and labels.

- [ ] **Step 6: Verify**

```bash
PATH="$HOME/.local/bin:$HOME/.deno/bin:/opt/homebrew/bin:$PATH" npm test -- components/stock-form components/StockFormModal.test.tsx
PATH="$HOME/.local/bin:$HOME/.deno/bin:/opt/homebrew/bin:$PATH" npm run typecheck
PATH="$HOME/.local/bin:$HOME/.deno/bin:/opt/homebrew/bin:$PATH" npm run test:mutation
```

- [ ] **Step 7: Commit**

```bash
git add components/stock-form components/StockFormModal.tsx components/StockFormModal.test.tsx
git commit -m "refactor: isolate stock form state and photo queue"
```

---

### Task 10: Split CRM Conversation Responsibilities

**Files:**
- Create: `pages/crm/conversations/conversationOrdering.ts`
- Create: `pages/crm/conversations/conversationOrdering.test.ts`
- Create: `pages/crm/conversations/useConversationFeed.ts`
- Create: `pages/crm/conversations/useMessageComposer.ts`
- Create: `pages/crm/conversations/ConversationFilters.tsx`
- Create: `pages/crm/conversations/ConversationThread.tsx`
- Modify: `pages/crm/ConversationsPage.tsx`
- Modify: existing `ConversationsPage` tests

- [ ] **Step 1: Add ordering and deduplication tests**

Cover message timestamp fallback, conversation recency, duplicate realtime events, optimistic message replacement, and stable order for equal timestamps.

- [ ] **Step 2: Extract pure ordering functions**

Move `messageTimeMs`, `conversationRecencyMs`, relation normalization, and merge/dedupe logic.

- [ ] **Step 3: Characterize feed lifecycle**

Use fake timers to protect the existing `15_000ms` poll interval, realtime refresh, selected conversation retention, and cleanup.

- [ ] **Step 4: Extract `useConversationFeed`**

The hook owns query/poll/realtime orchestration and returns data plus commands. It must not render UI.

- [ ] **Step 5: Characterize composer workflows**

Protect text send, attachment validation, optimistic state, retry/error state, AI handoff, and new conversation creation.

- [ ] **Step 6: Extract `useMessageComposer`**

Inject storage/function dependencies; preserve existing messages and accepted file types.

- [ ] **Step 7: Extract presentational sections**

Move filters and thread rendering to components with explicit props. They must not query Supabase or read global contexts.

- [ ] **Step 8: Verify and commit in three atomic commits**

```bash
PATH="$HOME/.local/bin:$HOME/.deno/bin:/opt/homebrew/bin:$PATH" npm test -- pages/crm/ConversationsPage.ai-handoff.test.tsx pages/crm/ConversationsPage.newConversation.test.tsx pages/crm/conversations
PATH="$HOME/.local/bin:$HOME/.deno/bin:/opt/homebrew/bin:$PATH" npm run typecheck
```

Commit ordering, feed, and composer/UI extraction separately.

---

### Task 11: Extract Finance, Settings, Debt, and Warranty Policy

**Files:**
- Create and test the modules listed in the File Structure section.
- Modify: `pages/Finance.tsx`, `pages/Settings.tsx`, `pages/Debtors.tsx`, `pages/PayableDebts.tsx`, `pages/Warranties.tsx`

- [ ] **Step 1: Extract Finance pure view model**

Move date range, account balance, category dedupe, transaction filtering, and description resolution. Test boundary dates and non-finite amounts.

- [ ] **Step 2: Split Settings by actor**

Extract `FinancialCategoriesSection` and `AccessManagementSection`. Pass data and commands as props; sections must not import Supabase directly.

- [ ] **Step 3: Consolidate debt form policy**

Create separate receivable and payable input types in one domain module only where validation is genuinely shared. Preserve different account/status semantics; do not force them through one generic component.

- [ ] **Step 4: Extract warranty form model**

Move default form creation, date conversion, warranty day calculation, and create/edit payload construction.

- [ ] **Step 5: Verify focused suites**

```bash
PATH="$HOME/.local/bin:$HOME/.deno/bin:/opt/homebrew/bin:$PATH" npm test -- pages/Finance.test.tsx pages/Finance.confirmation.test.tsx pages/Settings.test.tsx pages/Debtors.test.tsx pages/PayableDebts.test.tsx pages/Warranties.test.tsx
PATH="$HOME/.local/bin:$HOME/.deno/bin:/opt/homebrew/bin:$PATH" npm run typecheck
```

- [ ] **Step 6: Commit one page family at a time**

Use:

```bash
git commit -m "refactor: extract finance view model"
git commit -m "refactor: split settings responsibilities"
git commit -m "refactor: extract debt form policy"
git commit -m "refactor: extract warranty form model"
```

---

### Task 12: Reduce Excessive Arguments in Server and Script Hotspots

**Files:**
- Modify only functions listed by the audit after frontend waves.
- Add colocated Deno/Vitest tests before signature changes.

- [ ] **Step 1: Re-run audit and select still-live functions**

Do not refactor dead or generated scripts merely to satisfy a number. Prioritize production handlers:

```text
supabase/functions/admin-provision-user/index.ts:createUserOrError
supabase/functions/push-send/index.ts:buildVapidHeaders
supabase/functions/push-send/index.ts:deliverEncryptedPush
supabase/functions/crm-uaz-webhook-receiver/index.ts:collectNested
```

- [ ] **Step 2: Add characterization tests for each call**

Assert returned values, side effects, and error propagation before changing signatures.

- [ ] **Step 3: Replace positional arguments with named inputs**

Example:

```ts
interface CreateUserInput {
  email: string;
  password: string;
  fullName: string;
  phone: string;
  role: AppRole;
  storeId: string | null;
  requesterId: string;
}

await createUserOrError({
  email,
  password,
  fullName,
  phone,
  role,
  storeId,
  requesterId
});
```

- [ ] **Step 4: Run Deno and JS verification**

```bash
PATH="$HOME/.local/bin:$HOME/.deno/bin:/opt/homebrew/bin:$PATH" npm run test:deno
PATH="$HOME/.local/bin:$HOME/.deno/bin:/opt/homebrew/bin:$PATH" npm test
PATH="$HOME/.local/bin:$HOME/.deno/bin:/opt/homebrew/bin:$PATH" npm run typecheck
```

- [ ] **Step 5: Commit per function family**

Never combine push encryption, admin provisioning, webhook parsing, and n8n script cleanup in one commit.

---

### Task 13: Final Quality Gate and Before/After Report

**Files:**
- Modify: `docs/quality/quality-baseline.md`
- Create: `output/uncle-bob-quality-after.md`

- [ ] **Step 1: Run complete verification**

```bash
PATH="$HOME/.local/bin:$HOME/.deno/bin:/opt/homebrew/bin:$PATH" npm test
PATH="$HOME/.local/bin:$HOME/.deno/bin:/opt/homebrew/bin:$PATH" npm run test:deno
PATH="$HOME/.local/bin:$HOME/.deno/bin:/opt/homebrew/bin:$PATH" npm run typecheck
PATH="$HOME/.local/bin:$HOME/.deno/bin:/opt/homebrew/bin:$PATH" npm run lint
PATH="$HOME/.local/bin:$HOME/.deno/bin:/opt/homebrew/bin:$PATH" npm run build
PATH="$HOME/.local/bin:$HOME/.deno/bin:/opt/homebrew/bin:$PATH" npm run test:coverage
PATH="$HOME/.local/bin:$HOME/.deno/bin:/opt/homebrew/bin:$PATH" npm run test:mutation
```

- [ ] **Step 2: Run final audit**

```bash
PATH="$HOME/.local/bin:$HOME/.deno/bin:/opt/homebrew/bin:$PATH" python3 /Users/italo/.codex/skills/uncle-bob/scripts/audit_codebase.py . --top 20 --output output/uncle-bob-quality-after.md
```

- [ ] **Step 3: Enforce acceptance gates**

The campaign is complete only when:

- all test, typecheck, lint, and build commands exit `0`;
- dependency cycles remain `0`;
- touched-file line and branch coverage do not decrease;
- scoped mutation score is at least `70%`, with no touched module below `50%`;
- duplication remains at or below `4.0%`;
- `DataProvider`, `PDV`, `ConversationsPage`, and `StockFormModal` all show lower complexity and function length than baseline;
- no public route, context API, persistence key, Supabase payload, or user-visible workflow changes unintentionally.

- [ ] **Step 4: Record exact comparison**

Append:

```markdown
## After

| Metric | Before | After | Result |
|---|---:|---:|---|
| Dependency cycles | 0 | Read from final audit | must remain 0 |
| Functions complexity > 5 | 166/832 | Read from final audit | decrease |
| Files > 200 lines | 69 | Read from final audit | decrease |
| Duplication | ~4.0% | Read from final audit | no increase |
| Line coverage | Recorded in Task 1 | Read from coverage summary | no decrease |
| Branch coverage | Recorded in Task 1 | Read from coverage summary | no decrease |
| Mutation score | First scoped Stryker run | Read from mutation report | >= 70% |
```

- [ ] **Step 5: Commit the report**

```bash
git add docs/quality/quality-baseline.md
git commit -m "docs: record quality improvement results"
```

Keep generated `output/` artifacts untracked unless the repository explicitly adopts them.

---

## Recommended Execution Order

1. Tasks 1-6: measurement and `DataProvider`, because it has the highest fan-in and structural risk.
2. Tasks 7-9: PDV, Inventory, and Stock Form, because these form the core sales/stock workflow.
3. Task 10: CRM conversations as an independent subsystem.
4. Task 11: finance/settings/debt/warranty page decomposition.
5. Task 12: server and script signatures, selected from a fresh audit.
6. Task 13: complete verification and before/after evidence.

Pause after each numbered group for review. Do not execute the whole campaign as one unreviewed batch.
