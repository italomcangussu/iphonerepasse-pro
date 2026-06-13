# App Startup and Mobile Tab Bar Performance Design

## Context

The app feels slow on authenticated startup and when switching mobile tab bar routes. Investigation found no evidence that tab clicks trigger a global data refresh. The main startup cost is the global `DataProvider`, mounted above every protected route, which currently loads the full operational dataset at once.

Measured evidence:

- Admin startup data fetch runs 21 Supabase requests in parallel.
- The combined admin payload is about 1.01 MB of JSON before client mapping.
- Heavy startup reads include `sales` with nested joins at about 431 KB, `transactions` at about 320 KB, and `stock_items` with costs at about 146 KB.
- The Uncle Bob audit marks `services/dataContext.tsx` as a high-risk stable module: about 2.8k source lines, complexity 850, fan-in 30, no dependency cycles.
- Route switching uses lazy page chunks plus a 200 ms `PageTransition`; first visit to a page may still download and execute that page chunk.

Problem statement: protected routes pay for more data than they need before the user can perceive the app as ready.

## Chosen Approach

Use an incremental, behavior-preserving performance path:

1. Add characterization tests and performance contracts around startup fetch behavior, focus resync, and mobile tab navigation.
2. Split the internal startup load into phases while keeping the public `useData()` API stable.
3. Defer heavy admin/finance/history datasets until a route or consumer actually needs them.
4. Improve perceived navigation with route chunk prefetch and page-local loading feedback using existing visual language.

This avoids a large provider rewrite while reducing the root cause. It follows the Uncle Bob rule that stable, highly depended modules need tests before structural change.

## Architecture

Keep the current provider boundary initially:

- `DataProvider` remains the public compatibility layer.
- Existing pages continue calling `useData()`.
- New internal loaders separate data into named groups.

Proposed internal groups:

- `loadShellData`: `business_profile`, `card_fee_settings`, `crm_ai_entry_settings`, `stores`, permission-adjacent lightweight settings.
- `loadCommerceCoreData`: `stock_items`, active `stock_reservations`, `customers`, `sellers`, `device_catalog`, simulator values and adjustments.
- `loadSalesHistoryData`: `sales` with nested sale joins.
- `loadFinanceData`: `transactions`, `debts`, `debt_payments`, `creditors`, `payable_debts`, `payable_debt_payments`, `finance_categories`, `cost_history`, `parts_inventory`.

The first implementation should introduce these groups as private helpers inside or near `services/dataContext.tsx`, then move them to smaller files only after tests are green. That keeps the first refactor mechanical and easier to review.

## Data Flow

Startup should change from one all-or-nothing fetch to a phased fetch:

1. Auth and permissions complete as today.
2. `DataProvider` loads shell and commerce core data.
3. The app renders the protected shell as soon as the minimum route data is available.
4. Heavy groups load in the background or on route demand.
5. Realtime and focus resync update the same groups without replacing newer local mutations.

Route demand rules:

- Dashboard, Inventory, PDV, Clients, Sellers, Stores, Profile, Settings: shell/core data only at first render unless the route explicitly needs sales or finance summaries.
- PDV History, Warranties, Marketing: request sales history.
- Finance, Debtors, Payable Debts: request finance data.
- CRM routes: keep using their existing page-specific queries; only consume shared stores from `useData()`.

No route should lose access to current data. Until a heavy group finishes, consumers receive the existing default empty arrays plus a loading flag for that group.

## UI and Perceived Performance

Frontend anchor: Swiss functional restraint.

Reason: this is an operational commerce app with dense data and repeated workflows. The improvement should make state legible, not add decoration. The existing iOS-style surface stays intact; the design change is about clarity of loading state and immediate navigation feedback.

Differentiator: page-level loading should name the real data being prepared, for example `Carregando vendas...` or `Carregando financeiro...`, only where a page truly waits for that dataset.

Rules:

- Keep standard action labels.
- Do not invent telemetry, fake counts, or decorative loading copy.
- Keep tab bar labels unchanged.
- Avoid full-screen loading after the app shell is available.
- Keep `PageTransition` behavior unless profiling later proves the 200 ms transition materially harms route switching.
- Add prefetch for primary mobile tab route chunks where Vite/React patterns allow it without eager-loading every page.

## Error Handling

Each data group should report failure independently:

- Shell/core failure keeps the current guarded behavior: app can show the existing error/toast path or fallback data.
- Sales history failure should not block Inventory, PDV, or Settings.
- Finance failure should not block non-finance routes.
- Background failures should log with enough context to identify the group and table, but should not spam the user on every focus/visibility resync.

If a background group fails, its previous successful data remains in place.

## Testing Strategy

Before production changes:

- Add characterization tests around `DataProvider` startup to assert which table groups are requested initially.
- Add a test proving tab navigation does not call global `refreshData`.
- Add tests for lazy heavy data loading when entering Finance and PDV History.
- Preserve existing realtime tests for sale, finance, and stock side effects.

During refactor:

- One behavior-preserving step at a time.
- Run focused `services/dataContext.test.tsx` tests after each data-flow change.
- Run `components/Layout.permissions.test.tsx` and iOS/PWA contract tests after navigation changes.
- Run typecheck before claiming done.

If coverage tooling remains unavailable in the shell, report that explicitly and rely on focused Vitest suites plus the Uncle Bob static audit as the baseline.

## Non-Goals

- No full rewrite of `DataProvider` into many providers in the first pass.
- No visual redesign of the app shell or tab bar.
- No removal of realtime behavior.
- No behavioral changes to sale creation, cancellation, reservation, or finance side effects.
- No database schema changes unless route-specific RPCs are later proven necessary.

## Rollout Plan

1. Create tests for current startup and tab navigation behavior.
2. Extract private fetch group helpers without changing when they are called.
3. Change startup to load shell/core first and heavy groups after initial render.
4. Add route-demand loaders for sales history and finance.
5. Add page-local loading flags and copy for delayed heavy groups.
6. Add route chunk prefetch for primary mobile tabs.
7. Re-run static audit and focused tests, then compare measured startup request payload and route switching behavior.

## Acceptance Criteria

- Authenticated startup no longer waits for full sales history and finance datasets before the shell can render.
- Mobile tab switching does not trigger a global data refresh.
- Existing DataProvider mutation and realtime tests continue to pass.
- Finance and history pages still hydrate complete data before showing actions that depend on it.
- User-facing loading copy names real data only.
- No new dependency cycles are introduced.
- `services/dataContext.tsx` complexity starts moving down or is at least prepared for a safe follow-up extraction.

## Implementation Decisions

- Use `ensureSalesHistoryLoaded()` and `ensureFinanceLoaded()` as the route-demand API names.
- Preserve current Dashboard behavior in the first implementation. Do not replace full sales history with a summary until a later test-backed change proves that the Dashboard can safely use a lightweight dataset.
- Trigger tab route prefetch on first touch, hover, or focus of a tab item. Do not prefetch every primary tab on app shell mount.
