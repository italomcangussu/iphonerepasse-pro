# Inventory Reserved Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a dedicated `Reservado` inventory tab with structured reservation data, optional deposit fields, expiration alerts, and explicit release/sale actions.

**Architecture:** Store reservation metadata in `stock_reservations` while keeping `stock_items.status = 'Reservado'` as the inventory state. Attach active reservation data to `StockItem` in `DataProvider`, expose explicit reservation actions, and render the new tab/actions in the existing inventory flow.

**Tech Stack:** React 19, TypeScript, Supabase/Postgres migrations, Vitest, Testing Library.

---

## File Structure

- Create `supabase/migrations/20260610172000_stock_reservations.sql`: table, indexes, RLS, updated-at trigger.
- Modify `types.ts`: reservation types and optional `StockItem.reservation`.
- Modify `services/dataContext.tsx`: load/map reservations and expose reserve/update/release methods.
- Create `components/StockReservationModal.tsx`: focused modal for customer/contact/validity/deposit/notes.
- Modify `components/StockDetailsModal.tsx`: render reservation metadata and actions for reserved items.
- Modify `pages/Inventory.tsx`: add tab, filters, reserve/release/sale actions, modal orchestration.
- Modify `pages/Inventory.test.tsx`: cover tab isolation, reservation flow, release flow, expired alert, share behavior.

### Task 1: Database And Types

**Files:**
- Create: `supabase/migrations/20260610172000_stock_reservations.sql`
- Modify: `types.ts`

- [ ] **Step 1: Write the migration**

```sql
begin;

create table if not exists public.stock_reservations (
  id text primary key,
  stock_item_id text not null references public.stock_items(id) on delete cascade,
  customer_name text not null,
  customer_phone text not null,
  reserved_at timestamptz not null default now(),
  expires_at timestamptz null,
  deposit_amount numeric(10,2) null,
  deposit_payment_method text null,
  notes text null,
  status text not null default 'active',
  released_at timestamptz null,
  sold_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stock_reservations_status_check check (status in ('active', 'released', 'sold')),
  constraint stock_reservations_deposit_amount_check check (deposit_amount is null or deposit_amount >= 0)
);

create unique index if not exists idx_stock_reservations_one_active
  on public.stock_reservations (stock_item_id)
  where status = 'active';

create index if not exists idx_stock_reservations_stock_item_id
  on public.stock_reservations (stock_item_id);

create index if not exists idx_stock_reservations_expires_at
  on public.stock_reservations (expires_at)
  where status = 'active' and expires_at is not null;

create or replace function public.tg_set_stock_reservations_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_stock_reservations_set_updated_at on public.stock_reservations;
create trigger trg_stock_reservations_set_updated_at
before update on public.stock_reservations
for each row execute function public.tg_set_stock_reservations_updated_at();

alter table public.stock_reservations enable row level security;

drop policy if exists stock_reservations_store_scope_select on public.stock_reservations;
create policy stock_reservations_store_scope_select on public.stock_reservations
  for select to authenticated
  using (
    exists (
      select 1
      from public.stock_items si
      where si.id = stock_reservations.stock_item_id
        and public.crm_can_access_store(si.store_id)
    )
  );

drop policy if exists stock_reservations_store_scope_insert on public.stock_reservations;
create policy stock_reservations_store_scope_insert on public.stock_reservations
  for insert to authenticated
  with check (
    exists (
      select 1
      from public.stock_items si
      where si.id = stock_reservations.stock_item_id
        and public.crm_can_access_store(si.store_id)
    )
  );

drop policy if exists stock_reservations_store_scope_update on public.stock_reservations;
create policy stock_reservations_store_scope_update on public.stock_reservations
  for update to authenticated
  using (
    exists (
      select 1
      from public.stock_items si
      where si.id = stock_reservations.stock_item_id
        and public.crm_can_access_store(si.store_id)
    )
  )
  with check (
    exists (
      select 1
      from public.stock_items si
      where si.id = stock_reservations.stock_item_id
        and public.crm_can_access_store(si.store_id)
    )
  );

commit;
```

- [ ] **Step 2: Add TypeScript reservation types**

```ts
export type StockReservationStatus = 'active' | 'released' | 'sold';

export interface StockReservation {
  id: string;
  stockItemId: string;
  customerName: string;
  customerPhone: string;
  reservedAt: string;
  expiresAt?: string | null;
  depositAmount?: number | null;
  depositPaymentMethod?: string | null;
  notes?: string | null;
  status: StockReservationStatus;
  releasedAt?: string | null;
  soldAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StockReservationInput {
  customerName: string;
  customerPhone: string;
  expiresAt?: string | null;
  depositAmount?: number | null;
  depositPaymentMethod?: string | null;
  notes?: string | null;
}
```

Add `reservation?: StockReservation | null;` to `StockItem`.

- [ ] **Step 3: Commit task**

```bash
git add types.ts supabase/migrations/20260610172000_stock_reservations.sql
git commit -m "feat: add stock reservation schema"
```

### Task 2: Data Context Reservation Actions

**Files:**
- Modify: `services/dataContext.tsx`

- [ ] **Step 1: Add data context methods**

Add to `DataContextType`:

```ts
reserveStockItem: (stockItemId: string, input: StockReservationInput) => Promise<void>;
updateStockReservation: (reservationId: string, input: StockReservationInput) => Promise<void>;
releaseStockReservation: (stockItemId: string) => Promise<void>;
```

- [ ] **Step 2: Load active reservations**

Fetch active reservations in `fetchData`:

```ts
supabase.from('stock_reservations').select('*').eq('status', 'active')
```

Build a `Map<string, StockReservation>` keyed by `stock_item_id` and pass it into stock mapping so `StockItem.reservation` is available to inventory UI.

- [ ] **Step 3: Implement validation and mutations**

Normalize reservation input:

```ts
const normalizeReservationInput = (input: StockReservationInput) => {
  const customerName = input.customerName.trim();
  const customerPhone = input.customerPhone.trim();
  const depositAmount = input.depositAmount === null || input.depositAmount === undefined || input.depositAmount === 0
    ? null
    : Number(input.depositAmount);
  const depositPaymentMethod = depositAmount && depositAmount > 0
    ? (input.depositPaymentMethod || '').trim()
    : null;

  if (!customerName) throw new Error('Informe o cliente da reserva.');
  if (!customerPhone) throw new Error('Informe o telefone da reserva.');
  if (depositAmount !== null && (!Number.isFinite(depositAmount) || depositAmount < 0)) {
    throw new Error('Valor do sinal inválido.');
  }
  if (depositAmount !== null && depositAmount > 0 && !depositPaymentMethod) {
    throw new Error('Informe a forma do sinal.');
  }

  return {
    customerName,
    customerPhone,
    expiresAt: input.expiresAt || null,
    depositAmount,
    depositPaymentMethod,
    notes: input.notes?.trim() || null,
  };
};
```

`reserveStockItem` must upsert/insert an active reservation and set stock status to `Reservado`. `releaseStockReservation` must mark active reservation as `released`, set `released_at`, and return stock status to `Disponível`.

- [ ] **Step 4: Commit task**

```bash
git add services/dataContext.tsx
git commit -m "feat: manage stock reservations in data context"
```

### Task 3: Reservation Modal And Details

**Files:**
- Create: `components/StockReservationModal.tsx`
- Modify: `components/StockDetailsModal.tsx`

- [ ] **Step 1: Create reservation modal**

Create a modal with fields for required customer/contact and optional expiration/deposit/payment/notes. It should accept `initialReservation`, `stockItem`, `open`, `onClose`, `onSave`, and `isSaving`.

- [ ] **Step 2: Update stock details modal**

Show reservation metadata when `item.status === StockStatus.RESERVED`, including expired label when `expiresAt` is before today. Add footer actions:

```ts
onEditReservation?: () => void;
onReleaseReservation?: () => void;
onSellReserved?: () => void;
isReleasingReservation?: boolean;
```

- [ ] **Step 3: Commit task**

```bash
git add components/StockReservationModal.tsx components/StockDetailsModal.tsx
git commit -m "feat: add stock reservation modal and details"
```

### Task 4: Inventory Tab And Actions

**Files:**
- Modify: `pages/Inventory.tsx`
- Modify: `pages/Inventory.test.tsx`

- [ ] **Step 1: Write failing inventory tests**

Add tests for:

```ts
it('separates reserved stock from available tab', async () => {});
it('reserves an available stock item with structured data', async () => {});
it('releases a reserved stock item back to available', async () => {});
it('marks expired reservations without auto releasing them', async () => {});
it('keeps complete share list free of reserved items', async () => {});
```

- [ ] **Step 2: Run tests and verify they fail**

```bash
npm run test:run -- pages/Inventory.test.tsx
```

Expected: FAIL before implementation because `Reservado` tab/actions/modal are missing or reserved rows still appear under `Disponíveis`.

- [ ] **Step 3: Implement inventory behavior**

Change defaults:

```ts
const DEFAULT_LIST_STATUSES: StockStatus[] = [StockStatus.AVAILABLE];
const DEFAULT_RESERVED_STATUSES: StockStatus[] = [StockStatus.RESERVED];
const COMPLETE_SHARE_STOCK_STATUSES = new Set([StockStatus.AVAILABLE]);
```

Add `activeTab: 'list' | 'reserved' | 'prep' | 'custom'`, render the `Reservado` segment, and connect `StockReservationModal` to:

```ts
reserveStockItem(selectedReservationItem.id, formInput)
updateStockReservation(selectedReservationItem.reservation.id, formInput)
releaseStockReservation(selectedDetailItem.id)
```

Add row action `Reservar` for available rows and details actions for reserved rows.

- [ ] **Step 4: Run inventory tests and verify pass**

```bash
npm run test:run -- pages/Inventory.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit task**

```bash
git add pages/Inventory.tsx pages/Inventory.test.tsx
git commit -m "feat: add reserved inventory tab"
```

### Task 5: Verification

**Files:**
- Read: `package.json`

- [ ] **Step 1: Run focused tests**

```bash
npm run test:run -- pages/Inventory.test.tsx components/StockDetailsModal.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Run build**

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 4: Commit any verification fixes**

```bash
git status --short
git add types.ts services/dataContext.tsx components/StockReservationModal.tsx components/StockDetailsModal.tsx pages/Inventory.tsx pages/Inventory.test.tsx supabase/migrations/20260610172000_stock_reservations.sql
git commit -m "fix: stabilize reserved inventory flow"
```

Commit only if verification required code fixes.

## Self-Review

Spec coverage: the plan covers the reserved tab, structured reservation data, optional deposit fields, optional expiration with alert only, explicit release/sale actions, PDV default safety, and tests.

Placeholder scan: no placeholders, deferred fields, or undefined implementation contracts remain.

Type consistency: `StockReservation`, `StockReservationInput`, `reserveStockItem`, `updateStockReservation`, and `releaseStockReservation` names are consistent across tasks.
