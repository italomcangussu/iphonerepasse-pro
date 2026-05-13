# Realtime Resync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the global `DataProvider` so application state resynchronizes automatically after realtime degradation, focus return, visibility return, and online recovery.

**Architecture:** Keep existing incremental Supabase Realtime handlers, but wrap full-data hydration in a guarded refresh scheduler. The provider becomes responsible for healing stale state after connection lifecycle transitions without forcing manual page reloads.

**Tech Stack:** React 19, TypeScript, Vitest, Supabase JS realtime channels

---

### Task 1: Add failing tests for lifecycle-triggered resync

**Files:**
- Modify: `services/dataContext.test.tsx`
- Test: `services/dataContext.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
it('refreshes data when window regains focus', async () => {
  // Mount DataProvider with authenticated admin user.
  // Prime initial table reads.
  // Dispatch window focus event.
  // Assert a second customers/stores fetch happened.
});

it('refreshes data when browser comes back online', async () => {
  // Mount DataProvider with authenticated admin user.
  // Dispatch online event.
  // Assert another data fetch cycle occurred.
});

it('refreshes data when document becomes visible again', async () => {
  // Mount DataProvider with authenticated admin user.
  // Mock document.visibilityState as hidden then visible.
  // Dispatch visibilitychange.
  // Assert another data fetch cycle occurred.
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- services/dataContext.test.tsx`
Expected: FAIL because lifecycle listeners do not trigger a new sync yet.

- [ ] **Step 3: Implement the minimal test harness support**

```tsx
const channelOnMock = vi.fn();
const channelSubscribeMock = vi.fn();
let channelStatusHandler: ((status: string) => void) | null = null;

vi.mock('./supabase', () => ({
  supabase: {
    from: (table: string) => fromMock(table),
    rpc: (...args: any[]) => rpcMock(...args),
    channel: vi.fn(() => ({
      on: channelOnMock.mockReturnThis(),
      subscribe: channelSubscribeMock.mockImplementation((callback?: (status: string) => void) => {
        channelStatusHandler = callback ?? null;
        return {};
      })
    })),
    removeChannel: vi.fn()
  }
}));
```

- [ ] **Step 4: Run test to verify it still fails for the intended reason**

Run: `npm run test:run -- services/dataContext.test.tsx`
Expected: FAIL on the new assertions, not on mock setup.

- [ ] **Step 5: Commit**

```bash
git add services/dataContext.test.tsx
git commit -m "test: cover data provider lifecycle resync triggers"
```

### Task 2: Add failing test for realtime reconnection healing

**Files:**
- Modify: `services/dataContext.test.tsx`
- Test: `services/dataContext.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
it('refreshes data when realtime resubscribes after a degraded state', async () => {
  // Mount provider.
  // Simulate channel status sequence: CHANNEL_ERROR -> SUBSCRIBED.
  // Assert a new fetch cycle runs after recovery.
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- services/dataContext.test.tsx`
Expected: FAIL because subscribe status is currently ignored.

- [ ] **Step 3: Reuse the channel status hook in the test**

```tsx
act(() => {
  channelStatusHandler?.('CHANNEL_ERROR');
  channelStatusHandler?.('SUBSCRIBED');
});
```

- [ ] **Step 4: Run test to verify it still fails for the intended reason**

Run: `npm run test:run -- services/dataContext.test.tsx`
Expected: FAIL on missing resync behavior.

- [ ] **Step 5: Commit**

```bash
git add services/dataContext.test.tsx
git commit -m "test: cover realtime recovery resync"
```

### Task 3: Implement guarded refresh scheduling in the provider

**Files:**
- Modify: `services/dataContext.tsx`
- Test: `services/dataContext.test.tsx`

- [ ] **Step 1: Add refs and a stable refresh scheduler**

```tsx
const refreshInFlightRef = useRef<Promise<void> | null>(null);
const refreshVersionRef = useRef(0);
const appliedVersionRef = useRef(0);
const lastRefreshAtRef = useRef(0);

const fetchData = useCallback(async (options?: { silent?: boolean; reason?: string; force?: boolean }) => {
  const now = Date.now();
  if (!options?.force && now - lastRefreshAtRef.current < 300) return;
  lastRefreshAtRef.current = now;

  const version = ++refreshVersionRef.current;
  const run = (async () => {
    // existing fetch logic
    if (version < appliedVersionRef.current) return;
    appliedVersionRef.current = version;
    // apply fetched state
  })();

  refreshInFlightRef.current = run.finally(() => {
    if (refreshInFlightRef.current === run) refreshInFlightRef.current = null;
  });

  return refreshInFlightRef.current;
}, [/* auth deps */]);
```

- [ ] **Step 2: Preserve current initial-load behavior while making non-initial refreshes silent**

```tsx
if (!options?.silent) {
  setLoading(true);
}

try {
  // current reads
} finally {
  if (!options?.silent) {
    setLoading(false);
  }
}
```

- [ ] **Step 3: Add a wrapper used by UI and reconnect listeners**

```tsx
const refreshData = useCallback(() => fetchData({ silent: true, reason: 'manual-refresh', force: true }), [fetchData]);

const scheduleResync = useCallback((reason: string, options?: { force?: boolean }) => {
  void fetchData({ silent: true, reason, force: options?.force ?? false });
}, [fetchData]);
```

- [ ] **Step 4: Run tests**

Run: `npm run test:run -- services/dataContext.test.tsx`
Expected: Some tests still FAIL until listeners and subscribe status handling are added.

- [ ] **Step 5: Commit**

```bash
git add services/dataContext.tsx services/dataContext.test.tsx
git commit -m "refactor: guard data provider refresh cycles"
```

### Task 4: Wire realtime status healing and browser lifecycle listeners

**Files:**
- Modify: `services/dataContext.tsx`
- Test: `services/dataContext.test.tsx`

- [ ] **Step 1: Track degraded realtime state**

```tsx
const realtimeDegradedRef = useRef(false);
```

- [ ] **Step 2: Extend subscribe callback with recovery logic**

```tsx
.subscribe((status) => {
  if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
    realtimeDegradedRef.current = true;
    return;
  }

  if (status === 'SUBSCRIBED' && realtimeDegradedRef.current) {
    realtimeDegradedRef.current = false;
    scheduleResync('realtime-recovered', { force: true });
  }
});
```

- [ ] **Step 3: Add browser lifecycle listeners**

```tsx
useEffect(() => {
  if (!isAuthenticated) return;

  const handleFocus = () => scheduleResync('window-focus');
  const handleOnline = () => scheduleResync('window-online', { force: true });
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      scheduleResync('document-visible');
    }
  };

  window.addEventListener('focus', handleFocus);
  window.addEventListener('online', handleOnline);
  document.addEventListener('visibilitychange', handleVisibilityChange);

  return () => {
    window.removeEventListener('focus', handleFocus);
    window.removeEventListener('online', handleOnline);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
}, [isAuthenticated, scheduleResync]);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:run -- services/dataContext.test.tsx`
Expected: PASS for lifecycle and realtime recovery coverage.

- [ ] **Step 5: Commit**

```bash
git add services/dataContext.tsx services/dataContext.test.tsx
git commit -m "fix: resync data after realtime and browser lifecycle recovery"
```

### Task 5: Run verification

**Files:**
- Modify: none
- Test: `services/dataContext.test.tsx`

- [ ] **Step 1: Run the focused test suite**

Run: `npm run test:run -- services/dataContext.test.tsx`
Expected: PASS

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Review changed files**

```bash
git diff -- services/dataContext.tsx services/dataContext.test.tsx docs/superpowers/specs/2026-05-13-realtime-resync-design.md docs/superpowers/plans/2026-05-13-realtime-resync.md
```

- [ ] **Step 4: Commit final implementation**

```bash
git add services/dataContext.tsx services/dataContext.test.tsx docs/superpowers/specs/2026-05-13-realtime-resync-design.md docs/superpowers/plans/2026-05-13-realtime-resync.md
git commit -m "fix: harden realtime resync in data provider"
```
