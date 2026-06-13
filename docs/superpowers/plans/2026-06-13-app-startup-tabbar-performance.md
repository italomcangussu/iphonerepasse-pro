# App Startup and Mobile Tab Bar Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make authenticated startup and mobile tab switching feel faster by deferring heavy sales/finance data while preserving the existing `useData()` API and realtime behavior.

**Architecture:** Keep `DataProvider` as the public compatibility boundary, but split its internal fetch into shell/core, sales history, and finance groups. Add explicit route-demand methods for heavy groups and page-level loading states, then prefetch tab route chunks on touch/hover/focus without changing visual direction.

**Tech Stack:** React 19, TypeScript, Vite, React Router hash routes, Supabase JS, Vitest, Testing Library, Tailwind utilities.

---

## File Structure

- Modify `services/dataContext.tsx`
  - Add `salesHistoryLoading`, `financeLoading`, `ensureSalesHistoryLoaded`, and `ensureFinanceLoaded` to the context.
  - Extract grouped fetch helpers inside `DataProvider`.
  - Change startup to load shell/core first and heavy groups in the background.
  - Keep `refreshData` as a full compatibility refresh.
- Modify `services/dataContext.test.tsx`
  - Add characterization tests for phased startup, route-demand loaders, and stale resync protection.
  - Update existing tests that assume all tables are loaded before `loading` becomes `idle`.
- Modify `pages/Finance.tsx`
  - Call `ensureFinanceLoaded()` on mount.
  - Show real page-local loading copy while finance data is loading.
- Modify `pages/PDVHistory.tsx`, `pages/Warranties.tsx`, and `pages/Marketing.tsx`
  - Call `ensureSalesHistoryLoaded()` on mount.
  - Show page-local loading copy where the page depends on sales history.
- Modify `App.tsx`
  - Replace direct `lazy(() => import(...))` declarations for primary tab routes with named loader functions that can be prefetched.
- Create and register primary route loaders through `lib/routePrefetch.ts`.
- Create `lib/routePrefetch.ts`
  - Own route loader registration and idempotent prefetch state.
- Modify `components/Layout.tsx`
  - Add `onPointerEnter`, `onFocus`, and `onTouchStart` handlers to primary mobile tab links that call `prefetchPrimaryRoute(item.path)` from `lib/routePrefetch.ts`.
- Modify `components/Layout.permissions.test.tsx`
  - Add a test proving primary tab interaction requests prefetch and does not call `refreshData`.

## Commands

Use the project PATH shown in existing plans:

```bash
PATH="$HOME/.local/bin:$HOME/.deno/bin:/opt/homebrew/bin:$PATH" npm test -- services/dataContext.test.tsx
PATH="$HOME/.local/bin:$HOME/.deno/bin:/opt/homebrew/bin:$PATH" npm test -- components/Layout.permissions.test.tsx
PATH="$HOME/.local/bin:$HOME/.deno/bin:/opt/homebrew/bin:$PATH" npm run typecheck
```

If `npm` is unavailable in the active shell, stop and report that verification is blocked by the shell PATH. Do not claim tests passed.

---

### Task 1: Characterize Phased Startup Contract

**Files:**
- Modify: `services/dataContext.test.tsx`

- [ ] **Step 1: Add helper probes near `DataLoadProbe`**

Add these components after `DataLoadProbe`:

```tsx
function DataGroupProbe() {
  const {
    loading,
    salesHistoryLoading,
    financeLoading,
    sales,
    transactions,
    ensureSalesHistoryLoaded,
    ensureFinanceLoaded
  } = useData();

  return (
    <div>
      <span data-testid="loading-state">{loading ? 'loading' : 'idle'}</span>
      <span data-testid="sales-history-loading">{salesHistoryLoading ? 'loading' : 'idle'}</span>
      <span data-testid="finance-loading">{financeLoading ? 'loading' : 'idle'}</span>
      <span data-testid="sale-count">{sales.length}</span>
      <span data-testid="transaction-count">{transactions.length}</span>
      <button type="button" onClick={() => void ensureSalesHistoryLoaded()} aria-label="Carregar vendas">
        Carregar vendas
      </button>
      <button type="button" onClick={() => void ensureFinanceLoaded()} aria-label="Carregar financeiro">
        Carregar financeiro
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Add failing startup test**

Add this test inside `describe('DataProvider realtime resync', ...)` after `starts independent table reads in parallel during global refresh`:

```tsx
it('marks initial loading idle before sales history and finance reads finish', async () => {
  const blockedSales = createDeferred<{ data: any[]; error: null }>();
  const blockedTransactions = createDeferred<{ data: any[]; error: null }>();

  fromMock.mockImplementation((table: string) => {
    const query: any = createAdminQuery(table);

    if (table === 'sales') {
      query.then = (resolve: any, reject: any) => blockedSales.promise.then(resolve, reject);
      query.catch = (reject: any) => blockedSales.promise.catch(reject);
      query.finally = (onFinally: any) => blockedSales.promise.finally(onFinally);
      return query;
    }

    if (table === 'transactions') {
      query.limit = vi.fn(() => blockedTransactions.promise);
      return query;
    }

    return query;
  });

  render(
    <DataProvider>
      <DataGroupProbe />
    </DataProvider>
  );

  await waitFor(() => expect(screen.getByTestId('loading-state')).toHaveTextContent('idle'));
  expect(screen.getByTestId('sales-history-loading')).toHaveTextContent('loading');
  expect(screen.getByTestId('finance-loading')).toHaveTextContent('loading');
  expect(screen.getByTestId('sale-count')).toHaveTextContent('0');
  expect(screen.getByTestId('transaction-count')).toHaveTextContent('0');

  await act(async () => {
    blockedSales.resolve({ data: [], error: null });
    blockedTransactions.resolve({ data: [], error: null });
    await Promise.all([blockedSales.promise, blockedTransactions.promise]);
  });
});
```

- [ ] **Step 3: Add failing route-demand test**

Add this test in the same `describe` block:

```tsx
it('loads sales history and finance on explicit demand after startup', async () => {
  initialRowsByTable.sales = [
    {
      id: 'sale-demand-1',
      customer_id: 'cust-1',
      seller_id: 'seller-1',
      store_id: 'store-1',
      date: '2026-05-01T10:00:00.000Z',
      total: 1000,
      payment_method: 'Pix',
      warranty_months: 3,
      warranty_expires_at: null,
      state: 'completed',
      sale_items: [],
      payment_methods: [],
      sale_trade_in_items: [],
      customer: null,
      seller: null
    }
  ];
  initialRowsByTable.transactions = [
    {
      id: 'trx-demand-1',
      type: 'IN',
      category: 'Venda',
      amount: 1000,
      date: '2026-05-01T10:00:00.000Z',
      description: 'Venda',
      account: 'Conta Bancária',
      sale_id: 'sale-demand-1',
      debt_payment_id: null,
      payable_debt_payment_id: null
    }
  ];

  render(
    <DataProvider>
      <DataGroupProbe />
    </DataProvider>
  );

  await waitFor(() => expect(screen.getByTestId('loading-state')).toHaveTextContent('idle'));
  expect(screen.getByTestId('sale-count')).toHaveTextContent('0');
  expect(screen.getByTestId('transaction-count')).toHaveTextContent('0');

  await act(async () => {
    screen.getByRole('button', { name: 'Carregar vendas' }).click();
  });
  await waitFor(() => expect(screen.getByTestId('sale-count')).toHaveTextContent('1'));

  await act(async () => {
    screen.getByRole('button', { name: 'Carregar financeiro' }).click();
  });
  await waitFor(() => expect(screen.getByTestId('transaction-count')).toHaveTextContent('1'));
});
```

- [ ] **Step 4: Run focused tests and verify failure**

Run:

```bash
PATH="$HOME/.local/bin:$HOME/.deno/bin:/opt/homebrew/bin:$PATH" npm test -- services/dataContext.test.tsx -t "initial loading idle|explicit demand"
```

Expected: FAIL because `salesHistoryLoading`, `financeLoading`, `ensureSalesHistoryLoaded`, and `ensureFinanceLoaded` do not exist yet.

- [ ] **Step 5: Commit tests**

Do not commit while tests are red unless the executor's workflow explicitly allows red commits. If red commits are not allowed, keep this task uncommitted and proceed directly to Task 2.

---

### Task 2: Extend Data Context API

**Files:**
- Modify: `services/dataContext.tsx`

- [ ] **Step 1: Add context fields to `DataContextType`**

In `interface DataContextType`, after `loading: boolean;`, add:

```ts
  salesHistoryLoading: boolean;
  financeLoading: boolean;
  ensureSalesHistoryLoaded: () => Promise<void>;
  ensureFinanceLoaded: () => Promise<void>;
```

- [ ] **Step 2: Add loading and loaded refs**

Inside `DataProvider`, after the existing `const [loading, setLoading] = useState(true);`, add:

```ts
  const [salesHistoryLoading, setSalesHistoryLoading] = useState(false);
  const [financeLoading, setFinanceLoading] = useState(false);
  const salesHistoryLoadedRef = useRef(false);
  const financeLoadedRef = useRef(false);
  const salesHistoryPromiseRef = useRef<Promise<void> | null>(null);
  const financePromiseRef = useRef<Promise<void> | null>(null);
```

- [ ] **Step 3: Reset group state on sign-out**

In `resetState`, after `setSimulatorTradeInAdjustments([]);`, add:

```ts
    setSalesHistoryLoading(false);
    setFinanceLoading(false);
    salesHistoryLoadedRef.current = false;
    financeLoadedRef.current = false;
    salesHistoryPromiseRef.current = null;
    financePromiseRef.current = null;
```

- [ ] **Step 4: Add temporary no-op demand methods**

Before `const contextValue = useMemo(() => ({`, add:

```ts
  const ensureSalesHistoryLoaded = useCallback(async () => {
    salesHistoryLoadedRef.current = true;
  }, []);

  const ensureFinanceLoaded = useCallback(async () => {
    financeLoadedRef.current = true;
  }, []);
```

- [ ] **Step 5: Add new fields to `contextValue`**

In the object passed to `useMemo`, add the fields after `loading`:

```ts
    salesHistoryLoading,
    financeLoading,
    ensureSalesHistoryLoaded,
    ensureFinanceLoaded,
```

Update the dependency list to include:

```ts
    salesHistoryLoading, financeLoading, ensureSalesHistoryLoaded, ensureFinanceLoaded,
```

- [ ] **Step 6: Run typecheck**

Run:

```bash
PATH="$HOME/.local/bin:$HOME/.deno/bin:/opt/homebrew/bin:$PATH" npm run typecheck
```

Expected: PASS. The new tests still fail because the methods do not fetch data yet.

---

### Task 3: Extract Fetch Group Helpers Without Changing Behavior

**Files:**
- Modify: `services/dataContext.tsx`
- Test: `services/dataContext.test.tsx`

- [ ] **Step 1: Add grouped result types**

Above `export const DataProvider`, add:

```ts
type ShellDataResults = {
  profileResult: any;
  cardFeeSettingsResult: any;
  aiEntrySettingsResult: any;
  simulatorTradeInValuesResult: any;
  simulatorTradeInAdjustmentsResult: any;
  storesResult: any;
  customersResult: any;
  sellersResult: any;
  stockResult: any;
  stockReservationsResult: any;
  deviceCatalogResult: any;
};

type SalesHistoryResults = {
  salesResult: any;
};

type FinanceDataResults = {
  debtsResult: any;
  debtPaymentsResult: any;
  partsResult: any;
  transactionsResult: any;
  costHistoryResult: any;
  categoriesResult: any;
  creditorsResult: any;
  payableDebtsResult: any;
  payableDebtPaymentsResult: any;
};
```

- [ ] **Step 2: Add shell/core loader**

Inside `DataProvider`, above `fetchData`, add:

```ts
  const loadShellAndCoreData = useCallback(async (): Promise<ShellDataResults> => {
    const [
      profileResult,
      cardFeeSettingsResult,
      aiEntrySettingsResult,
      simulatorTradeInValuesResult,
      simulatorTradeInAdjustmentsResult,
      storesResult,
      customersResult,
      sellersResult,
      stockResult,
      stockReservationsResult,
      deviceCatalogResult
    ] = await Promise.all([
      supabase.from('business_profile').select('*').single(),
      supabase.from('card_fee_settings').select('*').eq('id', 'default').single(),
      supabase.from('crm_ai_entry_settings').select('store_id,business_hours,special_business_hours'),
      supabase.from('simulator_trade_in_values').select('*').order('model', { ascending: true }),
      supabase.from('simulator_trade_in_adjustments').select('*').order('label', { ascending: true }),
      supabase.from('stores').select('*'),
      supabase.from('customers').select('*'),
      supabase.from('sellers').select('*'),
      supabase.from('stock_items').select('*, costs(*)'),
      supabase.from('stock_reservations').select('*').eq('status', 'active'),
      supabase.from('device_catalog').select('*').order('created_at', { ascending: false })
    ]);

    return {
      profileResult,
      cardFeeSettingsResult,
      aiEntrySettingsResult,
      simulatorTradeInValuesResult,
      simulatorTradeInAdjustmentsResult,
      storesResult,
      customersResult,
      sellersResult,
      stockResult,
      stockReservationsResult,
      deviceCatalogResult
    };
  }, []);
```

- [ ] **Step 3: Add sales loader**

Below `loadShellAndCoreData`, add:

```ts
  const loadSalesHistoryData = useCallback(async (): Promise<SalesHistoryResults> => {
    const salesResult = await supabase.from('sales').select(SALES_SELECT);
    return { salesResult };
  }, []);
```

- [ ] **Step 4: Add finance loader**

Below `loadSalesHistoryData`, add:

```ts
  const loadFinanceData = useCallback(async (): Promise<FinanceDataResults> => {
    const [
      debtsResult,
      debtPaymentsResult,
      partsResult,
      transactionsResult,
      costHistoryResult,
      categoriesResult,
      creditorsResult,
      payableDebtsResult,
      payableDebtPaymentsResult
    ] = await Promise.all([
      role === 'admin'
        ? supabase.from('debts').select('*').order('created_at', { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      role === 'admin'
        ? supabase.from('debt_payments').select('*').order('paid_at', { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      supabase.from('parts_inventory').select('*').order('name', { ascending: true }),
      role === 'admin'
        ? supabase.from('transactions').select('*').order('date', { ascending: false }).limit(100000)
        : Promise.resolve({ data: [], error: null }),
      supabase.from('cost_history').select('*'),
      supabase.from('finance_categories').select('*').order('name', { ascending: true }),
      role === 'admin'
        ? supabase.from('creditors').select('*').order('name', { ascending: true })
        : Promise.resolve({ data: [], error: null }),
      role === 'admin'
        ? supabase.from('payable_debts').select('*').order('created_at', { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      role === 'admin'
        ? supabase.from('payable_debt_payments').select('*').order('paid_at', { ascending: false })
        : Promise.resolve({ data: [], error: null })
    ]);

    return {
      debtsResult,
      debtPaymentsResult,
      partsResult,
      transactionsResult,
      costHistoryResult,
      categoriesResult,
      creditorsResult,
      payableDebtsResult,
      payableDebtPaymentsResult
    };
  }, [role]);
```

- [ ] **Step 5: Replace the `Promise.all` in `fetchData` with helper calls**

Inside `fetchData`, replace the large destructuring `const [...] = await Promise.all([...]);` with:

```ts
        const [
          shellResults,
          salesHistoryResults,
          financeResults
        ] = await Promise.all([
          loadShellAndCoreData(),
          loadSalesHistoryData(),
          loadFinanceData()
        ]);

        const {
          profileResult,
          cardFeeSettingsResult,
          aiEntrySettingsResult,
          simulatorTradeInValuesResult,
          simulatorTradeInAdjustmentsResult,
          storesResult,
          customersResult,
          sellersResult,
          stockResult,
          stockReservationsResult,
          deviceCatalogResult
        } = shellResults;

        const { salesResult } = salesHistoryResults;

        const {
          debtsResult,
          debtPaymentsResult,
          partsResult,
          transactionsResult,
          costHistoryResult,
          categoriesResult,
          creditorsResult,
          payableDebtsResult,
          payableDebtPaymentsResult
        } = financeResults;
```

- [ ] **Step 6: Add helper dependencies to `fetchData`**

Change the dependency array for `fetchData` from:

```ts
  }, [isAuthenticated, resetState, role]);
```

to:

```ts
  }, [isAuthenticated, resetState, role, loadShellAndCoreData, loadSalesHistoryData, loadFinanceData]);
```

- [ ] **Step 7: Run existing parallel refresh test**

Run:

```bash
PATH="$HOME/.local/bin:$HOME/.deno/bin:/opt/homebrew/bin:$PATH" npm test -- services/dataContext.test.tsx -t "starts independent table reads in parallel during global refresh"
```

Expected: PASS. This task should not change behavior.

- [ ] **Step 8: Commit mechanical extraction**

Run:

```bash
git add services/dataContext.tsx
git commit -m "refactor: group data provider fetches"
```

---

### Task 4: Implement Route-Demand Heavy Data Loading

**Files:**
- Modify: `services/dataContext.tsx`
- Test: `services/dataContext.test.tsx`

- [ ] **Step 1: Add sales application helper**

Above `ensureSalesHistoryLoaded`, add:

```ts
  const applySalesHistoryResults = useCallback((salesResult: any) => {
    if (salesResult.error) {
      console.error('Error fetching sales:', salesResult.error);
    }

    const mappedSales = (salesResult.data || [])
      .map((s: any) => mapSaleRef.current(s))
      .filter((s: Sale) => pendingSaleMutationsRef.current.get(s.id)?.type !== 'remove');
    const presentIds = new Set(mappedSales.map((s: Sale) => s.id));
    const pendingAdds: Sale[] = [];
    pendingSaleMutationsRef.current.forEach((entry, id) => {
      if (entry.type === 'add' && entry.sale && !presentIds.has(id)) {
        pendingAdds.push(entry.sale);
      }
    });
    setSales([...mappedSales, ...pendingAdds]);
    salesHistoryLoadedRef.current = true;
  }, []);
```

- [ ] **Step 2: Add finance application helper**

Below `applySalesHistoryResults`, add:

```ts
  const applyFinanceResults = useCallback((financeResults: FinanceDataResults) => {
    const {
      debtsResult,
      debtPaymentsResult,
      partsResult,
      transactionsResult,
      costHistoryResult,
      categoriesResult,
      creditorsResult,
      payableDebtsResult,
      payableDebtPaymentsResult
    } = financeResults;

    if (debtsResult.error) console.error('Error fetching debts:', debtsResult.error);
    if (debtPaymentsResult.error) console.error('Error fetching debt payments:', debtPaymentsResult.error);
    if (partsResult.error) console.error('Error fetching parts inventory:', partsResult.error);
    if (transactionsResult.error) console.error('Error fetching transactions:', transactionsResult.error);
    if (costHistoryResult.error) console.error('Error fetching cost history:', costHistoryResult.error);
    if (categoriesResult.error) console.error('Error fetching finance categories:', categoriesResult.error);
    if (creditorsResult.error) console.error('Error fetching creditors:', creditorsResult.error);
    if (payableDebtsResult.error) console.error('Error fetching payable debts:', payableDebtsResult.error);
    if (payableDebtPaymentsResult.error) console.error('Error fetching payable debt payments:', payableDebtPaymentsResult.error);

    setDebts(role === 'admin' ? (debtsResult.data || []).map(mapDebt) : []);
    setDebtPayments(role === 'admin' ? (debtPaymentsResult.data || []).map(mapDebtPayment) : []);
    setPartsInventory((partsResult.data || []).map(mapPartStockItem));
    setTransactions(role === 'admin' ? (transactionsResult.data || []).map(mapTransaction) : []);
    setCostHistory((costHistoryResult.data || []).map(mapCostHistory));
    setFinancialCategories((categoriesResult.data || []).map(mapFinancialCategory));
    setCreditors(role === 'admin' ? (creditorsResult.data || []).map(mapCreditor) : []);
    setPayableDebts(role === 'admin' ? (payableDebtsResult.data || []).map(mapPayableDebt) : []);
    setPayableDebtPayments(role === 'admin' ? (payableDebtPaymentsResult.data || []).map(mapPayableDebtPayment) : []);
    financeLoadedRef.current = true;
  }, [role]);
```

- [ ] **Step 3: Replace temporary `ensureSalesHistoryLoaded`**

Replace the no-op implementation with:

```ts
  const ensureSalesHistoryLoaded = useCallback(async () => {
    if (!isAuthenticated) return;
    if (salesHistoryLoadedRef.current) return;
    if (salesHistoryPromiseRef.current) return salesHistoryPromiseRef.current;

    setSalesHistoryLoading(true);
    const promise = loadSalesHistoryData()
      .then(({ salesResult }) => {
        applySalesHistoryResults(salesResult);
      })
      .finally(() => {
        setSalesHistoryLoading(false);
        salesHistoryPromiseRef.current = null;
      });

    salesHistoryPromiseRef.current = promise;
    return promise;
  }, [isAuthenticated, loadSalesHistoryData, applySalesHistoryResults]);
```

- [ ] **Step 4: Replace temporary `ensureFinanceLoaded`**

Replace the no-op implementation with:

```ts
  const ensureFinanceLoaded = useCallback(async () => {
    if (!isAuthenticated) return;
    if (financeLoadedRef.current) return;
    if (financePromiseRef.current) return financePromiseRef.current;

    setFinanceLoading(true);
    const promise = loadFinanceData()
      .then((financeResults) => {
        applyFinanceResults(financeResults);
      })
      .finally(() => {
        setFinanceLoading(false);
        financePromiseRef.current = null;
      });

    financePromiseRef.current = promise;
    return promise;
  }, [isAuthenticated, loadFinanceData, applyFinanceResults]);
```

- [ ] **Step 5: Change startup `fetchData` to load shell/core first**

Inside `fetchData`, replace the helper `Promise.all` block from Task 3 with:

```ts
        const shellResults = await loadShellAndCoreData();

        const {
          profileResult,
          cardFeeSettingsResult,
          aiEntrySettingsResult,
          simulatorTradeInValuesResult,
          simulatorTradeInAdjustmentsResult,
          storesResult,
          customersResult,
          sellersResult,
          stockResult,
          stockReservationsResult,
          deviceCatalogResult
        } = shellResults;
```

Remove the `salesResult` and finance result destructuring from this area.

- [ ] **Step 6: Remove heavy result application from startup**

In `fetchData`, remove these existing startup application blocks:

```ts
        if (debtsResult.error) console.error('Error fetching debts:', debtsResult.error);
        if (debtPaymentsResult.error) console.error('Error fetching debt payments:', debtPaymentsResult.error);
        if (partsError) console.error('Error fetching parts inventory:', partsError);
        if (transactionsResult.error) console.error('Error fetching transactions:', transactionsResult.error);
        if (costHistoryError) console.error('Error fetching cost history:', costHistoryError);
        if (categoriesError) console.error('Error fetching finance categories:', categoriesError);
        if (creditorsResult.error) console.error('Error fetching creditors:', creditorsResult.error);
        if (payableDebtsResult.error) console.error('Error fetching payable debts:', payableDebtsResult.error);
        if (payableDebtPaymentsResult.error) console.error('Error fetching payable debt payments:', payableDebtPaymentsResult.error);
```

Also remove:

```ts
        setPartsInventory((partsData || []).map(mapPartStockItem));
        {
          const mappedSales = (salesData || [])
            .map((s) => mapSaleRef.current(s))
            .filter((s) => pendingSaleMutationsRef.current.get(s.id)?.type !== 'remove');
          const presentIds = new Set(mappedSales.map((s) => s.id));
          const pendingAdds: Sale[] = [];
          pendingSaleMutationsRef.current.forEach((entry, id) => {
            if (entry.type === 'add' && entry.sale && !presentIds.has(id)) {
              pendingAdds.push(entry.sale);
            }
          });
          setSales([...mappedSales, ...pendingAdds]);
        }
        setTransactions(role === 'admin' ? (transactionsResult.data || []).map(mapTransaction) : []);
        setCostHistory((costHistoryData || []).map(mapCostHistory));
        setFinancialCategories((categoriesData || []).map(mapFinancialCategory));
        setCreditors(role === 'admin' ? (creditorsResult.data || []).map(mapCreditor) : []);
        setPayableDebts(role === 'admin' ? (payableDebtsResult.data || []).map(mapPayableDebt) : []);
        setPayableDebtPayments(role === 'admin' ? (payableDebtPaymentsResult.data || []).map(mapPayableDebtPayment) : []);
```

- [ ] **Step 7: Start background heavy loads after shell/core settles**

After shell/core state application and before the `catch`, add:

```ts
        if (!silent) {
          void ensureSalesHistoryLoaded();
          void ensureFinanceLoaded();
        }
```

This keeps first render unblocked while still warming heavy data after startup.

- [ ] **Step 8: Update `fetchData` dependencies**

Make sure the dependency list includes:

```ts
loadShellAndCoreData, ensureSalesHistoryLoaded, ensureFinanceLoaded
```

and no longer includes `loadSalesHistoryData` or `loadFinanceData` directly unless still referenced inside `fetchData`.

- [ ] **Step 9: Run focused new tests**

Run:

```bash
PATH="$HOME/.local/bin:$HOME/.deno/bin:/opt/homebrew/bin:$PATH" npm test -- services/dataContext.test.tsx -t "initial loading idle|explicit demand"
```

Expected: PASS.

- [ ] **Step 10: Run realtime resync tests**

Run:

```bash
PATH="$HOME/.local/bin:$HOME/.deno/bin:/opt/homebrew/bin:$PATH" npm test -- services/dataContext.test.tsx -t "DataProvider realtime resync"
```

Expected: PASS. If existing tests fail because they expected finance/sales data at initial idle, update those tests to click `Carregar vendas` or `Carregar financeiro` through `DataGroupProbe`, or call the relevant demand method from a small test probe.

- [ ] **Step 11: Commit demand loading**

Run:

```bash
git add services/dataContext.tsx services/dataContext.test.tsx
git commit -m "feat: defer heavy data provider groups"
```

---

### Task 5: Wire Heavy Data Demand Into Pages

**Files:**
- Modify: `pages/Finance.tsx`
- Modify: `pages/PDVHistory.tsx`
- Modify: `pages/Warranties.tsx`
- Modify: `pages/Marketing.tsx`
- Test: existing page tests for each modified page

- [ ] **Step 1: Update Finance data destructuring**

In `pages/Finance.tsx`, replace the `useData()` destructuring with:

```ts
  const {
    stock,
    transactions,
    sales,
    sellers = [],
    addTransaction,
    updateTransaction,
    removeTransaction,
    removeDebt,
    debts,
    debtPayments,
    customers,
    financialCategories,
    payableDebts,
    creditors,
    financeLoading,
    ensureFinanceLoaded
  } = useData();
```

- [ ] **Step 2: Add Finance demand effect**

After the state declarations near the top of `Finance`, add:

```ts
  useEffect(() => {
    void ensureFinanceLoaded();
  }, [ensureFinanceLoaded]);
```

- [ ] **Step 3: Add Finance page-local loading copy**

Near the top of Finance's returned JSX, just inside the main page container, add:

```tsx
      {financeLoading && (
        <div className="mb-3 rounded-ios border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 shadow-ios-sm dark:border-surface-dark-200 dark:bg-surface-dark-100 dark:text-surface-dark-600">
          Carregando financeiro...
        </div>
      )}
```

Place it above the first dashboard/filter content so it is visible but does not replace the page.

- [ ] **Step 4: Update PDV History destructuring and effect**

In `pages/PDVHistory.tsx`, change:

```ts
  const { sales, stores, sellers, customers, businessProfile, removeSale, updateSale } = useData();
```

to:

```ts
  const {
    sales,
    stores,
    sellers,
    customers,
    businessProfile,
    removeSale,
    updateSale,
    salesHistoryLoading,
    ensureSalesHistoryLoaded
  } = useData();
```

Then add after the first `useMemo`/state setup:

```ts
  useEffect(() => {
    void ensureSalesHistoryLoaded();
  }, [ensureSalesHistoryLoaded]);
```

- [ ] **Step 5: Add PDV History loading copy**

In `pages/PDVHistory.tsx`, near the top of the returned JSX, add:

```tsx
      {salesHistoryLoading && (
        <div className="mb-3 rounded-ios border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 shadow-ios-sm dark:border-surface-dark-200 dark:bg-surface-dark-100 dark:text-surface-dark-600">
          Carregando vendas...
        </div>
      )}
```

- [ ] **Step 6: Update Warranties destructuring and effect**

In `pages/Warranties.tsx`, add `salesHistoryLoading` and `ensureSalesHistoryLoaded` to the `useData()` destructuring:

```ts
    salesHistoryLoading,
    ensureSalesHistoryLoaded
```

Then add:

```ts
  useEffect(() => {
    void ensureSalesHistoryLoaded();
  }, [ensureSalesHistoryLoaded]);
```

Add this visible loading copy near the top of the returned content:

```tsx
      {salesHistoryLoading && (
        <div className="mb-3 rounded-ios border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 shadow-ios-sm dark:border-surface-dark-200 dark:bg-surface-dark-100 dark:text-surface-dark-600">
          Carregando garantias...
        </div>
      )}
```

- [ ] **Step 7: Update Marketing**

In `pages/Marketing.tsx`, change:

```ts
  const { sales, customers } = useData();
```

to:

```ts
  const { sales, customers, salesHistoryLoading, ensureSalesHistoryLoaded } = useData();
```

Add:

```ts
  useEffect(() => {
    void ensureSalesHistoryLoaded();
  }, [ensureSalesHistoryLoaded]);
```

If `useEffect` is not imported, change the React import to include it:

```ts
import React, { useEffect, useMemo } from 'react';
```

Add this loading copy above the marketing metrics/list:

```tsx
      {salesHistoryLoading && (
        <div className="mb-3 rounded-ios border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 shadow-ios-sm dark:border-surface-dark-200 dark:bg-surface-dark-100 dark:text-surface-dark-600">
          Carregando vendas...
        </div>
      )}
```

- [ ] **Step 8: Run focused page tests**

Run:

```bash
PATH="$HOME/.local/bin:$HOME/.deno/bin:/opt/homebrew/bin:$PATH" npm test -- pages/Finance.test.tsx pages/PDVHistory.test.tsx pages/Warranties.test.tsx
```

Expected: PASS. If page test mocks for `useData()` fail, update each mock to include:

```ts
salesHistoryLoading: false,
financeLoading: false,
ensureSalesHistoryLoaded: vi.fn(),
ensureFinanceLoaded: vi.fn()
```

- [ ] **Step 9: Commit page demand wiring**

Run:

```bash
git add pages/Finance.tsx pages/PDVHistory.tsx pages/Warranties.tsx pages/Marketing.tsx pages/*.test.tsx
git commit -m "feat: load heavy data on route demand"
```

---

### Task 6: Add Primary Tab Route Prefetch

**Files:**
- Create: `lib/routePrefetch.ts`
- Modify: `App.tsx`
- Modify: `components/Layout.tsx`
- Modify: `components/Layout.permissions.test.tsx`

- [ ] **Step 1: Create route prefetch registry**

Create `lib/routePrefetch.ts`:

```ts
type RouteLoader = () => Promise<unknown>;

const primaryRouteLoaders = new Map<string, RouteLoader>();
const prefetchedPrimaryRoutes = new Set<string>();

export const registerPrimaryRouteLoaders = (loaders: Record<string, RouteLoader>): void => {
  Object.entries(loaders).forEach(([path, loader]) => {
    primaryRouteLoaders.set(path, loader);
  });
};

export const prefetchPrimaryRoute = (path: string): void => {
  const loader = primaryRouteLoaders.get(path);
  if (!loader || prefetchedPrimaryRoutes.has(path)) return;

  prefetchedPrimaryRoutes.add(path);
  void loader().catch(() => {
    prefetchedPrimaryRoutes.delete(path);
  });
};
```

- [ ] **Step 2: Replace primary lazy imports with named loaders**

At the top of `App.tsx`, replace these declarations:

```ts
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Inventory = lazy(() => import('./pages/Inventory'));
const PDVHistory = lazy(() => import('./pages/PDVHistory'));
const Finance = lazy(() => import('./pages/Finance'));
```

with:

```ts
const loadDashboardPage = () => import('./pages/Dashboard');
const loadInventoryPage = () => import('./pages/Inventory');
const loadPDVHistoryPage = () => import('./pages/PDVHistory');
const loadFinancePage = () => import('./pages/Finance');

const Dashboard = lazy(loadDashboardPage);
const Inventory = lazy(loadInventoryPage);
const PDVHistory = lazy(loadPDVHistoryPage);
const Finance = lazy(loadFinancePage);
```

- [ ] **Step 3: Register primary loaders in App**

In `App.tsx`, add this import near the other local imports:

```ts
import { registerPrimaryRouteLoaders } from './lib/routePrefetch';
```

Below the named primary lazy declarations, add:

```ts
registerPrimaryRouteLoaders({
  '/': loadDashboardPage,
  '/inventory': loadInventoryPage,
  '/pdv': loadPDVHistoryPage,
  '/finance': loadFinancePage,
});
```

- [ ] **Step 4: Import prefetch in Layout**

In `components/Layout.tsx`, add:

```ts
import { prefetchPrimaryRoute } from '../lib/routePrefetch';
```

- [ ] **Step 5: Add handlers to primary tab links**

In the mobile tab `Link` inside `operationItems.map`, add:

```tsx
                    onPointerEnter={() => prefetchPrimaryRoute(item.path)}
                    onFocus={() => prefetchPrimaryRoute(item.path)}
                    onTouchStart={() => prefetchPrimaryRoute(item.path)}
```

The resulting `Link` should still keep `key`, `to`, `className`, and `aria-label`.

- [ ] **Step 6: Mock prefetch in Layout test**

In `components/Layout.permissions.test.tsx`, add these mocks near the existing mock declarations:

```ts
const prefetchPrimaryRouteMock = vi.fn();
const refreshDataMock = vi.fn();
```

Add:

```ts
vi.mock('../lib/routePrefetch', () => ({
  prefetchPrimaryRoute: (path: string) => prefetchPrimaryRouteMock(path)
}));
```

In `beforeEach`, add:

```ts
    prefetchPrimaryRouteMock.mockClear();
    refreshDataMock.mockClear();
```

Update the existing `vi.mock('../services/dataContext', ...)` block to return `refreshData`:

```ts
vi.mock('../services/dataContext', () => ({
  useData: () => ({
    businessProfile: {},
    refreshData: refreshDataMock
  })
}));
```

- [ ] **Step 7: Add Layout prefetch test**

Add this test to `describe('Layout permission navigation', ...)`:

```tsx
  it('prefetches primary mobile tab chunks on first tab intent without refreshing data', () => {
    usePermissionsMock.mockReturnValue({
      can: vi.fn((key: string, action = 'visible') => action === 'visible' && ['dashboard', 'pdv', 'inventory', 'finance'].includes(key))
    });

    render(
      <MemoryRouter>
        <Layout>
          <div>Conteudo</div>
        </Layout>
      </MemoryRouter>
    );

    const inventoryTab = screen.getByRole('link', { name: 'Estoque' });
    fireEvent.pointerEnter(inventoryTab);
    fireEvent.focus(inventoryTab);

    expect(prefetchPrimaryRouteMock).toHaveBeenCalledWith('/inventory');
    expect(refreshDataMock).not.toHaveBeenCalled();
  });
```

- [ ] **Step 8: Run Layout tests**

Run:

```bash
PATH="$HOME/.local/bin:$HOME/.deno/bin:/opt/homebrew/bin:$PATH" npm test -- components/Layout.permissions.test.tsx
```

Expected: PASS.

- [ ] **Step 9: Commit prefetch**

Run:

```bash
git add lib/routePrefetch.ts App.tsx components/Layout.tsx components/Layout.permissions.test.tsx
git commit -m "feat: prefetch primary mobile tab routes"
```

---

### Task 7: Verification and Audit

**Files:**
- Verify only

- [ ] **Step 1: Run DataProvider tests**

Run:

```bash
PATH="$HOME/.local/bin:$HOME/.deno/bin:/opt/homebrew/bin:$PATH" npm test -- services/dataContext.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run affected page and layout tests**

Run:

```bash
PATH="$HOME/.local/bin:$HOME/.deno/bin:/opt/homebrew/bin:$PATH" npm test -- components/Layout.permissions.test.tsx pages/Finance.test.tsx pages/PDVHistory.test.tsx pages/Warranties.test.tsx tests/pwa-ios-shell.test.ts tests/crm-ios-layout-contract.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run typecheck**

Run:

```bash
PATH="$HOME/.local/bin:$HOME/.deno/bin:/opt/homebrew/bin:$PATH" npm run typecheck
```

Expected: PASS.

- [ ] **Step 4: Run Uncle Bob static audit**

Run:

```bash
/usr/bin/python3 /Users/italo/.codex/skills/uncle-bob/scripts/audit_codebase.py /Volumes/DEV/projetos/iphonerepasse-pro --top 20 -o /Volumes/DEV/projetos/iphonerepasse-pro/output/uncle-bob-performance-review-after.md
```

Expected: command exits 0 and writes `output/uncle-bob-performance-review-after.md`.

- [ ] **Step 5: Compare startup fetch behavior manually from tests**

Inspect `services/dataContext.test.tsx` results and verify:

- initial `loading` reaches `idle` while blocked sales/transactions are still pending;
- explicit demand loads sales and finance;
- mobile tab prefetch test passes without `refreshData`.

- [ ] **Step 6: Final commit if verification-only changes were made**

If only test/audit commands ran, do not commit generated `output/` artifacts. If test files were adjusted during verification, commit the known affected test files:

```bash
git add services/dataContext.test.tsx components/Layout.permissions.test.tsx pages/Finance.test.tsx pages/PDVHistory.test.tsx pages/Warranties.test.tsx
git commit -m "test: stabilize startup performance coverage"
```

---

## Self-Review Notes

- Spec coverage: startup phasing is covered by Tasks 1-4; route-demand loading by Task 5; tab prefetch by Task 6; Uncle Bob audit and verification by Task 7.
- Non-goals preserved: no database migration, no visual redesign, no provider rewrite into multiple providers.
- Type consistency: public API names are `salesHistoryLoading`, `financeLoading`, `ensureSalesHistoryLoaded`, and `ensureFinanceLoaded` throughout the plan.
