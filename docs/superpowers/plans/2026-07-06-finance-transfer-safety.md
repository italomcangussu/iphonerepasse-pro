# Finance Transfer Safety Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate concurrent overspending and RPC/Realtime duplication, then reconcile the Supabase migration ledger without exposing an intermediate RPC contract.

**Architecture:** Keep the public `security invoker` RPC and private `security definer` implementation. Serialize balance consumption with a transaction-scoped advisory lock inside the private implementation, and make client state updates idempotent through the existing pure realtime-state module. Reconcile the missing finance guards and final transfer RPC in one database transaction before repairing migration history.

**Tech Stack:** PostgreSQL 15+, Supabase/PostgREST, React 19, TypeScript 5.8, Vitest 4, Node.js 22, Supabase CLI 2.107+.

## Global Constraints

- Do not touch the live n8n workflow or its snapshots.
- Do not expose a `security definer` function in the `public` schema.
- Keep `public.transfer_between_accounts(numeric, text, text)` as the only public overload.
- Keep the operation admin-only through `public.current_role() is distinct from 'admin'`.
- Keep the two transaction rows atomic and linked by one `transfer_group_id`.
- Do not mark a migration applied until its material database state is present.
- Do not address the unrelated `tests/crm-ios-layout-contract.test.ts` failure in this work.
- Use TDD for every production-code change and preserve unrelated user changes.

---

### Task 1: Idempotent transaction state updates

**Files:**
- Modify: `services/data/realtime/realtimeState.ts`
- Modify: `services/data/realtime/realtimeState.test.ts`
- Modify: `services/dataContext.tsx`
- Modify: `services/dataContext.test.tsx`

**Interfaces:**
- Consumes: existing `upsertById<T extends { id: string }>(rows, incoming)`.
- Produces: `upsertManyById<T extends { id: string }>(rows: T[], incoming: T[]): T[]`.

- [ ] **Step 1: Write the failing pure-state test**

Import `upsertManyById` in `services/data/realtime/realtimeState.test.ts` and add:

```ts
it('upserts multiple rows without duplicating ids already received from realtime', () => {
  const realtimeRow = transaction('transfer-out');
  const rpcRows = [
    { ...realtimeRow, description: 'updated transfer out' },
    transaction('transfer-in')
  ];

  const next = upsertManyById([realtimeRow], rpcRows);

  expect(next.map((item) => item.id)).toEqual(['transfer-out', 'transfer-in']);
  expect(next[0]?.description).toBe('updated transfer out');
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
npx vitest run services/data/realtime/realtimeState.test.ts
```

Expected: FAIL because `upsertManyById` is not exported.

- [ ] **Step 3: Add the minimal pure helper**

Add next to `upsertById` in `services/data/realtime/realtimeState.ts`:

```ts
export const upsertManyById = <T extends { id: string }>(rows: T[], incoming: T[]): T[] =>
  incoming.reduce((current, row) => upsertById(current, row), rows);
```

- [ ] **Step 4: Run the pure-state test and verify GREEN**

Run the command from Step 2. Expected: all tests in the file PASS.

- [ ] **Step 5: Write the failing DataProvider race-order test**

In `services/dataContext.test.tsx`, render `DataProvider` with `DataContractProbe`, wait for `loading === false`, capture the transactions Realtime callback from `channelOnMock`, emit both transfer rows first, then configure `rpcMock` to return those same rows and call `transferBetweenAccounts` from the latest context value:

```ts
it('does not duplicate transfer rows when realtime arrives before the RPC response', async () => {
  initialRowsByTable.transactions = [];
  const onValue = vi.fn();
  const rows = [
    {
      id: 'trx-transfer-out',
      type: 'OUT',
      category: 'Transferência',
      amount: 25,
      date: '2026-07-06T12:00:00.000Z',
      description: 'Transferência para Cofre',
      account: 'Conta Bancária',
      transfer_group_id: 'trf-race'
    },
    {
      id: 'trx-transfer-in',
      type: 'IN',
      category: 'Transferência',
      amount: 25,
      date: '2026-07-06T12:00:00.000Z',
      description: 'Transferência de Conta Bancária',
      account: 'Cofre',
      transfer_group_id: 'trf-race'
    }
  ];

  render(<DataProvider><DataContractProbe onValue={onValue} /></DataProvider>);
  await waitFor(() => expect(onValue.mock.calls.at(-1)?.[0].loading).toBe(false));

  const handler = channelOnMock.mock.calls.find((call) => call[1]?.table === 'transactions')?.[2];
  expect(handler).toBeTypeOf('function');

  await act(async () => {
    await handler({ eventType: 'INSERT', new: rows[0] });
    await handler({ eventType: 'INSERT', new: rows[1] });
  });

  rpcMock.mockResolvedValueOnce({ data: rows, error: null });
  await act(async () => {
    await onValue.mock.calls.at(-1)?.[0].transferBetweenAccounts('Conta Bancária', 'Cofre', 25);
  });

  await waitFor(() => {
    const transactions = onValue.mock.calls.at(-1)?.[0].transactions;
    expect(transactions.map((item: Transaction) => item.id)).toEqual([
      'trx-transfer-out',
      'trx-transfer-in'
    ]);
  });
});
```

- [ ] **Step 6: Run the DataProvider test and verify RED**

Run:

```bash
npx vitest run services/dataContext.test.tsx -t "does not duplicate transfer rows"
```

Expected: FAIL with four transaction IDs because the RPC path appends rows unconditionally.

- [ ] **Step 7: Route both event paths through the pure helper**

Import `upsertById` and `upsertManyById` in `services/dataContext.tsx`. Replace the Realtime insert update with:

```ts
setTransactions((prev) => upsertById(prev, mapped));
```

Replace the RPC append with:

```ts
if (!Array.isArray(data)) {
  throw new Error('Resposta inválida ao transferir entre contas.');
}

const mapped = data.map(mapTransaction);
setTransactions((prev) => upsertManyById(prev, mapped));
```

- [ ] **Step 8: Run focused tests and verify GREEN**

```bash
npx vitest run services/data/realtime/realtimeState.test.ts services/dataContext.test.tsx pages/Finance.test.tsx
```

Expected: all focused tests PASS.

- [ ] **Step 9: Commit Task 1**

```bash
git add services/data/realtime/realtimeState.ts services/data/realtime/realtimeState.test.ts services/dataContext.tsx services/dataContext.test.tsx
git commit -m "fix: deduplicate transfer transactions across realtime"
```

---

### Task 2: Serialize balance consumption in PostgreSQL

**Files:**
- Modify: `tests/finance-transfer-rpc-migration.test.ts`
- Modify: `supabase/migrations/20260706153746_restore_transfer_rpc_row_contract.sql`

**Interfaces:**
- Consumes: `private.transfer_between_accounts_impl(numeric, text, text)`.
- Produces: the same function signature and result, with an advisory transaction lock keyed by normalized source account.

- [ ] **Step 1: Write the failing migration-order assertion**

Add to the latest migration contract test:

```ts
const lockStatement = "perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('finance-transfer:' || v_from, 0));";

expect(latestTransferMigrationSql).toContain(lockStatement);
expect(latestTransferMigrationSql.indexOf(lockStatement)).toBeLessThan(
  latestTransferMigrationSql.indexOf('select coalesce(')
);
```

- [ ] **Step 2: Run the migration test and verify RED**

```bash
npx vitest run tests/finance-transfer-rpc-migration.test.ts
```

Expected: FAIL because the lock statement is absent.

- [ ] **Step 3: Add the lock inside the private implementation**

In `20260706153746_restore_transfer_rpc_row_contract.sql`, insert this statement after account validation and before the balance query:

```sql
  -- Serialize consumers of the same source balance until commit or rollback.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('finance-transfer:' || v_from, 0)
  );
```

- [ ] **Step 4: Run the migration test and verify GREEN**

Run the Step 2 command. Expected: all migration contract tests PASS.

- [ ] **Step 5: Run static migration and type checks**

```bash
npm run smoke:migrations
npm run typecheck
```

At this stage `smoke:migrations` may still report pending migrations but must complete under its pre-gate behavior. Typecheck must PASS.

- [ ] **Step 6: Commit Task 2**

```bash
git add tests/finance-transfer-rpc-migration.test.ts supabase/migrations/20260706153746_restore_transfer_rpc_row_contract.sql
git commit -m "fix: serialize transfers by source account"
```

---

### Task 3: Turn migration health into a failing gate

**Files:**
- Create: `scripts/smoke/migration-health-core.mjs`
- Create: `scripts/smoke/migration-health.test.mjs`
- Modify: `scripts/smoke/migration-health.mjs`

**Interfaces:**
- Produces: `hasMigrationHealthFailures(report: object): boolean`.

- [ ] **Step 1: Write the failing pure gate tests**

Create `scripts/smoke/migration-health.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { hasMigrationHealthFailures } from './migration-health-core.mjs';

const healthy = {
  remote: { status: 'ok' },
  pendingMigrations: [],
  versionDriftMigrations: [],
  remoteOnlyMigrations: [],
};

test('migration health is clean only when remote and ledgers agree', () => {
  assert.equal(hasMigrationHealthFailures(healthy), false);
  assert.equal(hasMigrationHealthFailures({ ...healthy, remote: { status: 'error' } }), true);
  assert.equal(hasMigrationHealthFailures({ ...healthy, pendingMigrations: [{}] }), true);
  assert.equal(hasMigrationHealthFailures({ ...healthy, versionDriftMigrations: [{}] }), true);
  assert.equal(hasMigrationHealthFailures({ ...healthy, remoteOnlyMigrations: [{}] }), true);
});
```

- [ ] **Step 2: Run the test and verify RED**

```bash
node --test scripts/smoke/migration-health.test.mjs
```

Expected: FAIL because `migration-health-core.mjs` does not exist.

- [ ] **Step 3: Implement the pure gate**

Create `scripts/smoke/migration-health-core.mjs`:

```js
export const hasMigrationHealthFailures = (report) =>
  report.remote.status !== 'ok' ||
  report.pendingMigrations.length > 0 ||
  report.versionDriftMigrations.length > 0 ||
  report.remoteOnlyMigrations.length > 0;
```

- [ ] **Step 4: Connect the gate after report generation**

Import the helper in `migration-health.mjs` and append after the report files are written:

```js
  if (hasMigrationHealthFailures(report)) {
    process.exitCode = 1;
  }
```

- [ ] **Step 5: Verify GREEN and verify the current drift fails**

```bash
node --test scripts/smoke/migration-health.test.mjs
npm run smoke:migrations
```

Expected: unit test PASS; smoke exits 1 and reports the four known pending migrations.

- [ ] **Step 6: Commit Task 3**

```bash
git add scripts/smoke/migration-health-core.mjs scripts/smoke/migration-health.test.mjs scripts/smoke/migration-health.mjs
git commit -m "test: fail migration health on schema drift"
```

---

### Task 4: Reconcile production atomically and repair the ledger

**Files:**
- Read: `supabase/migrations/20260701130000_restore_device_images_select_for_reconciliation.sql`
- Read: `supabase/migrations/20260705120000_finance_integrity_guards.sql`
- Read: `supabase/migrations/20260706151306_transfer_between_accounts_rpc.sql`
- Read: `supabase/migrations/20260706153746_restore_transfer_rpc_row_contract.sql`
- Temporary generated file: `/tmp/finance-transfer-reconciliation.sql`

**Interfaces:**
- Produces: final remote functions/policies equivalent to all four migration intents and a synchronized `supabase_migrations.schema_migrations` ledger.

- [ ] **Step 1: Save a fresh catalog snapshot**

Use Supabase `execute_sql` to record definitions of the five finance functions, the private transfer implementation, and the two storage policies. Save the tool result in the session record; do not expose secrets or user data.

- [ ] **Step 2: Confirm the storage migration is materially present**

Verify `Auth Read DevImages` and `Auth Read Logos` are `SELECT` policies for `authenticated`. If either is absent, stop and apply `20260701130000` before repairing its version.

- [ ] **Step 3: Build one atomic reconciliation SQL file**

Mechanically compose the body of `20260705120000_finance_integrity_guards.sql` followed by the updated body of `20260706153746_restore_transfer_rpc_row_contract.sql`, stripping only each file's outer `begin;` and `commit;`, and wrapping the result in one outer transaction:

```bash
node --input-type=module -e "
  import fs from 'node:fs';
  const files = [
    'supabase/migrations/20260705120000_finance_integrity_guards.sql',
    'supabase/migrations/20260706153746_restore_transfer_rpc_row_contract.sql'
  ];
  const bodies = files.map((file) => fs.readFileSync(file, 'utf8')
    .replace(/^\\s*begin;\\s*/i, '')
    .replace(/\\s*commit;\\s*$/i, ''));
  fs.writeFileSync('/tmp/finance-transfer-reconciliation.sql', 'begin;\\n' + bodies.join('\\n') + '\\ncommit;\\n');
"
```

- [ ] **Step 4: Review and apply the composed transaction**

```bash
rg -n "^(begin|commit);|transfer_between_accounts|pg_advisory_xact_lock|handle_sale_before_delete|release_stock_reservation|cancel_transaction|pdv_rebuild_sale_full_payload" /tmp/finance-transfer-reconciliation.sql
supabase db query --linked --file /tmp/finance-transfer-reconciliation.sql
rm /tmp/finance-transfer-reconciliation.sql
```

Expected: exactly one outer `begin` and `commit`; query exits 0. The old transfer overload exists only inside the uncommitted transaction and is removed before commit.

- [ ] **Step 5: Verify material equivalence before ledger repair**

Use `execute_sql` to verify:

- one public transfer overload with arguments `(numeric,text,text)`;
- public wrapper is invoker and private implementation is definer;
- private definition contains `pg_advisory_xact_lock` and `hashtextextended`;
- `handle_sale_before_delete` restores active reservations;
- `release_stock_reservation` rejects a missing deposit transaction before refund;
- `cancel_transaction` blocks reservation-linked manual rows;
- `pdv_rebuild_sale_full_payload` rejects sales with received debt payments.

Stop without repairing history if any assertion is false.

- [ ] **Step 6: Repair only the demonstrated versions**

```bash
supabase migration repair --linked --status applied \
  20260701130000 \
  20260705120000 \
  20260706151306 \
  20260706153746
```

`20260706151306` is safe to mark applied only because its intended RPC availability/security state is superseded by the verified final `20260706153746` state.

- [ ] **Step 7: Verify ledger and smoke gate**

```bash
supabase migration list --linked
npm run smoke:migrations
```

Expected: no pending, drift, or remote-only migrations; smoke exits 0.

- [ ] **Step 8: Verify functional RPC behavior with rollback**

Run a SQL transaction as an existing admin claim, transfer `0.01` from an account with sufficient balance, assert two rows, one transfer group, `IN` and `OUT`, then rollback. Query afterward to confirm no test transfer remains.

- [ ] **Step 9: Verify serialization with two PostgreSQL sessions**

Load only `SUPABASE_DB_PASSWORD` from `.env.local` and the linked pooler URL from
`supabase/.temp/pooler-url`. Select the cash-equivalent account with the highest
positive balance, then start Session A in a transaction: set an existing admin user as
the local JWT subject, call the RPC for `0.01`, sleep for three seconds, and roll back.
After Session A acquires the lock, start Session B with the same admin setup and source
account, call the same RPC, and roll back.

Measure Session B wall time. Expected: at least two seconds because it waits for Session
A's transaction-scoped lock. Both sessions must exit 0, and a final query must confirm
that neither test transfer persisted.

```bash
db_url=$(cat supabase/.temp/pooler-url)
db_password=$(sed -n 's/^SUPABASE_DB_PASSWORD=//p' .env.local | tail -1 | tr -d '\r')
origin=$(PGPASSWORD="$db_password" psql "$db_url" -At -v ON_ERROR_STOP=1 -c \
  "select account from public.transactions where account in ('Conta Bancária','Cofre') group by account order by sum(case when type='IN' then amount else -amount end) desc limit 1")
destination=$([ "$origin" = "Conta Bancária" ] && printf 'Cofre' || printf 'Conta Bancária')
before=$(PGPASSWORD="$db_password" psql "$db_url" -At -v ON_ERROR_STOP=1 -c \
  "select count(*) from public.transactions where amount = 0.0137 and transfer_group_id is not null")
admin_setup="select pg_catalog.set_config('request.jwt.claim.sub',(select id::text from public.user_profiles where role='admin' limit 1),true); select pg_catalog.set_config('request.jwt.claim.role','authenticated',true);"

PGPASSWORD="$db_password" psql "$db_url" -v ON_ERROR_STOP=1 -c \
  "begin; $admin_setup select count(*) from public.transfer_between_accounts(0.0137,'$origin','$destination'); select pg_sleep(3); rollback;" \
  >/tmp/transfer-session-a.log 2>&1 &
session_a_pid=$!
sleep 1

started=$(date +%s)
PGPASSWORD="$db_password" psql "$db_url" -v ON_ERROR_STOP=1 -c \
  "begin; $admin_setup select count(*) from public.transfer_between_accounts(0.0137,'$origin','$destination'); rollback;" \
  >/tmp/transfer-session-b.log 2>&1
elapsed=$(( $(date +%s) - started ))
wait "$session_a_pid"

after=$(PGPASSWORD="$db_password" psql "$db_url" -At -v ON_ERROR_STOP=1 -c \
  "select count(*) from public.transactions where amount = 0.0137 and transfer_group_id is not null")
test "$elapsed" -ge 2
test "$after" = "$before"
rm /tmp/transfer-session-a.log /tmp/transfer-session-b.log
```

- [ ] **Step 10: Verify PostgREST discovery and authorization**

Call `/rest/v1/rpc/transfer_between_accounts` with the service-role credential only as a negative probe. Expected: HTTP 403, SQLSTATE `42501`, and the admin-only message. A `PGRST202`/`PGRST203` response is a failure.

- [ ] **Step 11: Run Supabase advisors**

Run security and performance advisors. Confirm no advisory names the transfer functions; report unrelated existing warnings separately.

---

### Task 5: Final verification and branch completion

**Files:**
- Verify all files changed by Tasks 1-3.
- Do not modify the unrelated CRM layout test.

- [ ] **Step 1: Run focused regression tests**

```bash
npx vitest run \
  services/data/realtime/realtimeState.test.ts \
  services/dataContext.test.tsx \
  pages/Finance.test.tsx \
  tests/finance-transfer-rpc-migration.test.ts
node --test scripts/smoke/migration-health.test.mjs
```

Expected: all focused tests PASS.

- [ ] **Step 2: Run project checks**

```bash
npm run typecheck
npm run lint
npm run build
npm run smoke:migrations
git diff --check
```

Expected: all commands exit 0. The five known unrelated lint warnings may remain, but no lint errors are allowed.

- [ ] **Step 3: Re-run the quality auditor**

```bash
python3 /Users/italomendes/.codex/skills/uncle-bob/scripts/audit_codebase.py . --top 20 -o /tmp/iphonerepasse-uncle-bob-after.md
```

Expected: zero dependency cycles; no regression attributable to the focused changes. Do not run full coverage until the unrelated CRM contract test is fixed.

- [ ] **Step 4: Review the complete branch diff**

Inspect every changed file, confirm only approved scope is present, and verify no secret, temporary SQL file, generated coverage deletion, or report churn is staged.

- [ ] **Step 5: Commit any remaining verification-only changes**

If no source change remains uncommitted, do not create an empty commit. Otherwise stage only approved files and use an atomic message describing the remaining intent.
