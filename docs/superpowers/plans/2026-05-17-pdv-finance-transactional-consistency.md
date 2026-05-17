# PDV Finance Transactional Consistency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make PDV sale creation and completed-sale editing financially atomic, idempotent, and consistent across trade-in, client refund, debts, transactions, local state, and realtime refetches.

**Architecture:** Add transactional Supabase RPCs for full sale creation and full sale update, then route `dataContext.addSale` and `dataContext.updateSale` through those RPCs. Keep PDV UI mostly unchanged, but tighten refund method choices and draft restore behavior.

**Tech Stack:** React 19, TypeScript, Vitest, Supabase Postgres migrations, Supabase JS RPC calls.

---

## File Structure

- Modify: `services/dataContext.tsx`
  - Add RPC payload mapper helpers.
  - Replace multi-call `addSale` persistence with `create_sale_full`.
  - Replace multi-call `updateSale` persistence with `update_sale_full`.
  - Preserve local state merge, pending mutation, stale fetch invalidation, realtime refresh behavior.

- Modify: `pages/PDV.tsx`
  - Restrict client refund methods to `Pix` and `Dinheiro`.
  - Consume saved PDV draft only once after stock is available.

- Modify: `components/SaleCompleteEditModal.tsx`
  - Allow `paymentMethods` to be empty when the edited sale financial total is zero.
  - Preserve client refund fields in edit payload if editing UI exposes them later; for this plan, ensure update payload does not accidentally erase existing fields unless recalculated by RPC.

- Create: `supabase/migrations/20260517120000_pdv_sale_full_rpc.sql`
  - Add `create_sale_full(jsonb)`.
  - Add `update_sale_full(text, jsonb)`.
  - Add grants.
  - Retire conflicting sale/payment trigger side effects by moving them into RPC-owned helpers for RPC-managed sale writes.

- Modify: `services/dataContext.test.tsx`
  - Add failing tests for RPC usage, idempotent retry, zero-total trade-in sale, client refund reconciliation, and update behavior.

- Modify: `pages/PDV.test.tsx`
  - Add/adjust tests for refund method picker and draft restore.

- Modify: `components/SaleCompleteEditModal.test.tsx` or create if absent.
  - Add test for saving a zero-total trade-in sale with no payment methods.

---

### Task 1: Lock PDV Refund Method Rules

**Files:**
- Modify: `pages/PDV.test.tsx`
- Modify: `pages/PDV.tsx`

- [ ] **Step 1: Write the failing refund-method test**

Add this test to `pages/PDV.test.tsx` near the trade-in surplus tests:

```tsx
it('only allows Pix and Dinheiro for customer refund when trade-in exceeds sale total', async () => {
  const user = userEvent.setup();
  render(<PDV />);

  await selectSeller(user);
  await selectStore(user);
  await selectClient(user);
  await selectProduct(user);
  await addTradeIn(user);
  await addTradeIn(user);
  await addTradeIn(user);
  await addTradeIn(user);

  await user.click(screen.getByRole('button', { name: /Continuar|Avançar para pagamento/i }));

  expect(screen.getByRole('button', { name: 'Pix' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Dinheiro' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Cartão' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Cartão Débito' })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
npm run test:run -- pages/PDV.test.tsx -t "only allows Pix and Dinheiro"
```

Expected: FAIL because `Cartão` and `Cartão Débito` are still rendered in the refund picker.

- [ ] **Step 3: Implement the minimal UI change**

In `pages/PDV.tsx`, add a constant near the other PDV constants:

```ts
const PDV_CLIENT_REFUND_METHODS = ['Pix', 'Dinheiro'] as const;
```

Replace the refund method map:

```tsx
{(['Pix', 'Dinheiro', 'Cartão', 'Cartão Débito'] as const).map((m) => (
```

with:

```tsx
{PDV_CLIENT_REFUND_METHODS.map((m) => (
```

Update the state type for `clientPaymentMethod` only if TypeScript requires it. The preferred state type remains broad enough to read older drafts, but new UI choices must be limited to the constant.

- [ ] **Step 4: Verify**

Run:

```bash
npm run test:run -- pages/PDV.test.tsx -t "only allows Pix and Dinheiro"
npm run typecheck
```

Expected: both pass.

---

### Task 2: Make PDV Draft Restore Single-Use

**Files:**
- Modify: `pages/PDV.test.tsx`
- Modify: `pages/PDV.tsx`

- [ ] **Step 1: Write the failing draft restore test**

Add a test that stores a draft, lets PDV restore it, changes the cart/payment state, then simulates a stock refresh by rerendering with updated `useDataMock`.

```tsx
it('does not reapply a saved draft after the user edits the restored sale flow', async () => {
  const user = userEvent.setup();
  window.localStorage.setItem('pdv:draft:v1', JSON.stringify({
    selectedStore: 'store-1',
    selectedSeller: 'sel-1',
    selectedClient: 'cust-1',
    cartItemIds: ['stk-1'],
    payments: [{ type: 'Pix', amount: 3000, account: 'Conta Bancária' }]
  }));

  const { rerender } = render(<PDV />);

  await screen.findByText(/iPhone 14 Test/i);
  await user.click(screen.getByRole('button', { name: /Remover pagamento/i }));

  useDataMock.mockReturnValue({
    ...baseUseDataMockValue(),
    stock: [
      ...baseStockRows(),
      {
        ...baseStockRows()[0],
        id: 'stk-refresh-marker',
        model: 'iPhone Refresh Marker'
      }
    ]
  });

  rerender(<PDV />);

  expect(screen.queryByText(/Pix/i)).not.toBeInTheDocument();
});
```

If the local test helpers have different names, use the existing `useDataMock` setup in `pages/PDV.test.tsx` and keep the same behavior: restored payment removed by user must not return after stock changes.

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
npm run test:run -- pages/PDV.test.tsx -t "does not reapply a saved draft"
```

Expected: FAIL because the draft restore effect is keyed on `stock` and can reapply saved payment/cart data.

- [ ] **Step 3: Implement single-use draft restore**

In `pages/PDV.tsx`, replace the `useEffect([stock])` draft parsing flow with two refs:

```ts
const pendingDraftRef = useRef<ParsedPdvDraft | null>(null);
const draftConsumedRef = useRef(false);
```

Add a local type above the component:

```ts
type ParsedPdvDraft = {
  selectedStore?: string;
  selectedSeller?: string;
  selectedClient?: string;
  selectedProductId?: string;
  cartItemIds?: string[];
  productConditionFilter?: ProductConditionFilter;
  storeWarrantyDays?: StoreWarrantyDays;
  itemWarrantyDays?: WarrantyDaysByItem;
  payments?: PaymentMethod[];
  commission?: number;
  originalSaleDate?: string;
  originalSaleId?: string;
  draftTradeIns?: StockItem[];
  discountConfig?: { type: DiscountInputType; value: number };
  negotiatedPriceInput?: string;
  clientPaymentMode?: 'immediate' | 'payable_debt' | null;
  clientPaymentAccount?: FinancialAccount | null;
  clientPaymentMethod?: 'Pix' | 'Dinheiro' | 'Cartão' | 'Cartão Débito' | null;
  clientPaymentNotes?: string | null;
  clientPaymentDueDate?: string | null;
};
```

Read localStorage once on mount:

```ts
useEffect(() => {
  if (draftConsumedRef.current) return;
  try {
    const rawDraft = window.localStorage.getItem(PDV_DRAFT_KEY);
    pendingDraftRef.current = rawDraft ? JSON.parse(rawDraft) as ParsedPdvDraft : null;
  } catch {
    pendingDraftRef.current = null;
  }
}, []);
```

Apply pending draft only once when stock can resolve cart IDs:

```ts
useEffect(() => {
  if (draftConsumedRef.current) return;
  const draft = pendingDraftRef.current;
  if (!draft) return;

  const draftCartIds = Array.isArray(draft.cartItemIds)
    ? draft.cartItemIds
    : draft.selectedProductId
      ? [draft.selectedProductId]
      : [];

  if (draftCartIds.length > 0 && stock.length === 0) return;

  draftConsumedRef.current = true;
  pendingDraftRef.current = null;

  // Move the existing draft application assignments here without changing field semantics.
}, [stock]);
```

- [ ] **Step 4: Verify**

Run:

```bash
npm run test:run -- pages/PDV.test.tsx -t "does not reapply a saved draft"
npm run test:run -- pages/PDV.test.tsx
```

Expected: targeted test and PDV suite pass.

---

### Task 3: Add RPC Migration Skeleton With Permission and Return Contract

**Files:**
- Create: `supabase/migrations/20260517120000_pdv_sale_full_rpc.sql`

- [ ] **Step 1: Create migration with function signatures**

Create `supabase/migrations/20260517120000_pdv_sale_full_rpc.sql` with this structure:

```sql
begin;

create or replace function public.create_sale_full(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale_id text := p_payload->>'id';
  v_existing public.sales%rowtype;
  v_result jsonb;
begin
  if public.current_role() not in ('admin', 'seller') then
    raise exception 'Usuário sem permissão para criar venda.' using errcode = '42501';
  end if;

  if coalesce(v_sale_id, '') = '' then
    raise exception 'ID da venda é obrigatório.' using errcode = '22023';
  end if;

  select * into v_existing from public.sales where id = v_sale_id for update;

  if found then
    -- Rebuild keeps retry idempotent for sales that were partially created by an earlier attempt.
    delete from public.debt_payments where debt_id in (select id from public.debts where sale_id = v_sale_id);
    delete from public.debts where sale_id = v_sale_id;
    delete from public.payable_debt_payments where payable_debt_id in (select id from public.payable_debts where sale_id = v_sale_id);
    delete from public.payable_debts where sale_id = v_sale_id;
    delete from public.transactions where sale_id = v_sale_id;
    delete from public.sale_trade_in_items where sale_id = v_sale_id;
    delete from public.payment_methods where sale_id = v_sale_id;
    delete from public.sale_items where sale_id = v_sale_id;
    delete from public.sales where id = v_sale_id;
  end if;

  perform public.pdv_insert_sale_full_payload(p_payload);
  v_result := public.pdv_hydrate_sale_json(v_sale_id);
  return v_result;
end;
$$;

create or replace function public.update_sale_full(p_sale_id text, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.sales%rowtype;
  v_result jsonb;
begin
  if public.current_role() <> 'admin' then
    raise exception 'Apenas administradores podem editar vendas.' using errcode = '42501';
  end if;

  select * into v_existing from public.sales where id = p_sale_id for update;
  if not found then
    raise exception 'Venda não encontrada: %', p_sale_id using errcode = 'P0002';
  end if;

  perform public.pdv_rebuild_sale_full_payload(p_sale_id, p_payload);
  v_result := public.pdv_hydrate_sale_json(p_sale_id);
  return v_result;
end;
$$;

revoke all on function public.create_sale_full(jsonb) from public;
revoke all on function public.create_sale_full(jsonb) from anon;
grant execute on function public.create_sale_full(jsonb) to authenticated;

revoke all on function public.update_sale_full(text, jsonb) from public;
revoke all on function public.update_sale_full(text, jsonb) from anon;
grant execute on function public.update_sale_full(text, jsonb) to authenticated;

commit;
```

- [ ] **Step 2: Add helper functions in the same migration**

Before `create_sale_full`, add helper function declarations:

```sql
create or replace function public.pdv_hydrate_sale_json(p_sale_id text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select to_jsonb(s)
    || jsonb_build_object(
      'sale_items', coalesce((
        select jsonb_agg(to_jsonb(si) || jsonb_build_object('stock_item', to_jsonb(st)))
        from public.sale_items si
        left join public.stock_items st on st.id = si.stock_item_id
        where si.sale_id = s.id
      ), '[]'::jsonb),
      'payment_methods', coalesce((
        select jsonb_agg(to_jsonb(pm))
        from public.payment_methods pm
        where pm.sale_id = s.id
      ), '[]'::jsonb),
      'sale_trade_in_items', coalesce((
        select jsonb_agg(to_jsonb(sti))
        from public.sale_trade_in_items sti
        where sti.sale_id = s.id
      ), '[]'::jsonb)
    )
  from public.sales s
  where s.id = p_sale_id;
$$;
```

Then add `pdv_insert_sale_full_payload` and `pdv_rebuild_sale_full_payload` as implementation targets in later tasks. Keep them in the same migration so RPCs deploy atomically.

- [ ] **Step 3: Verify migration parses locally**

Run:

```bash
npm run smoke:migrations
```

Expected: migration health passes. If the local smoke command requires Supabase environment variables, document the exact missing variable and continue with SQL review plus unit tests.

---

### Task 4: Implement RPC Payload Insert Helper

**Files:**
- Modify: `supabase/migrations/20260517120000_pdv_sale_full_rpc.sql`

- [ ] **Step 1: Add payload validation helper**

Add a helper before insert/rebuild functions:

```sql
create or replace function public.pdv_assert_sale_payload(p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total numeric := coalesce((p_payload->>'total')::numeric, 0);
  v_payment_total numeric := 0;
begin
  if coalesce(p_payload->>'id', '') = '' then
    raise exception 'ID da venda é obrigatório.' using errcode = '22023';
  end if;
  if coalesce(p_payload->>'customerId', '') = '' then
    raise exception 'Cliente é obrigatório.' using errcode = '22023';
  end if;
  if coalesce(p_payload->>'sellerId', '') = '' then
    raise exception 'Vendedor é obrigatório.' using errcode = '22023';
  end if;
  if jsonb_array_length(coalesce(p_payload->'items', '[]'::jsonb)) = 0 then
    raise exception 'A venda precisa ter ao menos um item.' using errcode = '22023';
  end if;

  select coalesce(sum(coalesce((payment->>'amount')::numeric, 0)), 0)
  into v_payment_total
  from jsonb_array_elements(coalesce(p_payload->'paymentMethods', '[]'::jsonb)) payment;

  if abs(v_payment_total - v_total) > 0.01 then
    raise exception 'A soma dos pagamentos deve ser igual ao total da venda.' using errcode = '22023';
  end if;
end;
$$;
```

- [ ] **Step 2: Add insert helper implementation**

Add `pdv_insert_sale_full_payload(p_payload jsonb)` that:

```sql
create or replace function public.pdv_insert_sale_full_payload(p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale_id text := p_payload->>'id';
  v_sale_date timestamptz := coalesce((p_payload->>'date')::timestamptz, now());
  v_trade_in_value numeric := 0;
  v_gross_total numeric := 0;
  v_client_payment jsonb := coalesce(p_payload->'clientPayment', '{}'::jsonb);
  v_client_payment_amount numeric := coalesce((v_client_payment->>'amount')::numeric, 0);
  v_client_payment_mode text := nullif(v_client_payment->>'mode', '');
  v_row jsonb;
  v_customer public.customers%rowtype;
  v_creditor_id text;
begin
  perform public.pdv_assert_sale_payload(p_payload);

  select coalesce(sum(coalesce((trade_in->>'receivedValue')::numeric, 0)), 0)
  into v_trade_in_value
  from jsonb_array_elements(coalesce(p_payload->'tradeIns', '[]'::jsonb)) trade_in;

  v_gross_total := coalesce((p_payload->>'total')::numeric, 0) + v_trade_in_value;

  insert into public.sales (
    id, customer_id, seller_id, store_id, total, discount, discount_type,
    discount_percent, original_subtotal, negotiated_subtotal, date,
    warranty_expires_at, trade_in_id, trade_in_value, client_payment_amount,
    client_payment_mode, client_payment_account, client_payment_method,
    client_payment_notes, client_payment_due_date
  ) values (
    v_sale_id,
    p_payload->>'customerId',
    p_payload->>'sellerId',
    nullif(p_payload->>'storeId', ''),
    coalesce((p_payload->>'total')::numeric, 0),
    coalesce((p_payload->>'discount')::numeric, 0),
    nullif(p_payload->>'discountType', ''),
    nullif(p_payload->>'discountPercent', '')::numeric,
    coalesce((p_payload->>'originalSubtotal')::numeric, 0),
    coalesce((p_payload->>'negotiatedSubtotal')::numeric, 0),
    v_sale_date,
    nullif(p_payload->>'warrantyExpiresAt', '')::timestamptz,
    null,
    v_trade_in_value,
    nullif(v_client_payment_amount, 0),
    v_client_payment_mode,
    nullif(v_client_payment->>'account', ''),
    nullif(v_client_payment->>'method', ''),
    nullif(v_client_payment->>'notes', ''),
    nullif(v_client_payment->>'dueDate', '')::date
  );

  for v_row in select * from jsonb_array_elements(coalesce(p_payload->'items', '[]'::jsonb)) loop
    insert into public.sale_items (id, sale_id, stock_item_id, price, original_price)
    values (
      'si_' || replace(gen_random_uuid()::text, '-', ''),
      v_sale_id,
      v_row->>'stockItemId',
      coalesce((v_row->>'price')::numeric, 0),
      coalesce((v_row->>'originalPrice')::numeric, coalesce((v_row->>'price')::numeric, 0))
    );

    update public.stock_items
    set status = 'Vendido',
        warranty_end = coalesce(nullif(v_row->>'warrantyExpiresAt', '')::timestamptz, warranty_end),
        updated_at = now()
    where id = v_row->>'stockItemId';
  end loop;

  for v_row in select * from jsonb_array_elements(coalesce(p_payload->'paymentMethods', '[]'::jsonb)) loop
    insert into public.payment_methods (
      id, sale_id, type, amount, account, installments, card_brand,
      customer_amount, fee_rate, fee_amount, debt_due_date, debt_installments, debt_notes
    ) values (
      'pm_' || replace(gen_random_uuid()::text, '-', ''),
      v_sale_id,
      v_row->>'type',
      coalesce((v_row->>'amount')::numeric, 0),
      nullif(v_row->>'account', ''),
      nullif(v_row->>'installments', '')::integer,
      nullif(v_row->>'cardBrand', ''),
      nullif(v_row->>'customerAmount', '')::numeric,
      nullif(v_row->>'feeRate', '')::numeric,
      nullif(v_row->>'feeAmount', '')::numeric,
      nullif(v_row->>'debtDueDate', '')::date,
      nullif(v_row->>'debtInstallments', '')::integer,
      nullif(v_row->>'debtNotes', '')
    );
  end loop;

  perform public.pdv_create_sale_trade_in_rows(v_sale_id, p_payload, v_sale_date);
  perform public.pdv_create_sale_financial_side_effects(v_sale_id);

  if v_client_payment_amount > 0 and v_client_payment_mode = 'immediate' then
    insert into public.transactions (id, type, category, amount, date, description, account, sale_id)
    values (
      'trx_' || replace(gen_random_uuid()::text, '-', ''),
      'OUT',
      'Pagamento de trade-in ao cliente',
      v_client_payment_amount,
      v_sale_date,
      'Diferença trade-in - Venda #' || upper(right(v_sale_id, 6)),
      coalesce(nullif(v_client_payment->>'account', ''), 'Conta Bancária'),
      v_sale_id
    );
  elsif v_client_payment_amount > 0 and v_client_payment_mode = 'payable_debt' then
    select * into v_customer from public.customers where id = p_payload->>'customerId';

    select id into v_creditor_id
    from public.creditors
    where document is not null and document = v_customer.cpf
    limit 1;

    if v_creditor_id is null then
      v_creditor_id := 'crd_' || replace(gen_random_uuid()::text, '-', '');
      insert into public.creditors (id, name, document, document_type, phone, email, notes)
      values (
        v_creditor_id,
        coalesce(v_customer.name, 'Cliente'),
        v_customer.cpf,
        case when v_customer.cpf is null then null else 'CPF' end,
        v_customer.phone,
        v_customer.email,
        'Criado automaticamente por diferença de trade-in no PDV'
      );
    end if;

    insert into public.payable_debts (
      id, creditor_id, creditor_name, creditor_document, creditor_phone,
      original_amount, remaining_amount, status, due_date, first_due_date,
      installments_total, notes, source, sale_id
    ) values (
      'pdbt_' || replace(gen_random_uuid()::text, '-', ''),
      v_creditor_id,
      coalesce(v_customer.name, 'Cliente'),
      v_customer.cpf,
      v_customer.phone,
      v_client_payment_amount,
      v_client_payment_amount,
      'Aberta',
      nullif(v_client_payment->>'dueDate', '')::date,
      nullif(v_client_payment->>'dueDate', '')::date,
      1,
      nullif(v_client_payment->>'notes', ''),
      'pdv',
      v_sale_id
    );
  end if;

  update public.sellers
  set total_sales = coalesce(total_sales, 0) + v_gross_total,
      updated_at = now()
  where id = p_payload->>'sellerId';

  update public.customers
  set purchases = coalesce(purchases, 0) + 1,
      total_spent = coalesce(total_spent, 0) + v_gross_total,
      updated_at = now()
  where id = p_payload->>'customerId';
end;
$$;
```

- [ ] **Step 3: Add helper functions for trade-ins and financial side effects**

Add `pdv_create_sale_trade_in_rows` and `pdv_create_sale_financial_side_effects` in the same migration.

`pdv_create_sale_financial_side_effects` must mirror current trigger behavior:

```sql
create or replace function public.pdv_create_sale_financial_side_effects(p_sale_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale public.sales%rowtype;
  v_payment public.payment_methods%rowtype;
  v_account text;
begin
  select * into v_sale from public.sales where id = p_sale_id;
  if not found then
    raise exception 'Venda não encontrada: %', p_sale_id using errcode = 'P0002';
  end if;

  if coalesce(v_sale.trade_in_value, 0) > 0 then
    insert into public.transactions (id, type, category, amount, date, description, account, sale_id)
    values
      ('trx_' || replace(gen_random_uuid()::text, '-', ''), 'IN', 'Venda', v_sale.trade_in_value, coalesce(v_sale.date, now()), 'Venda (Trade-in) - ' || v_sale.id, 'Conta Bancária', v_sale.id),
      ('trx_' || replace(gen_random_uuid()::text, '-', ''), 'OUT', 'Compra', v_sale.trade_in_value, coalesce(v_sale.date, now()), 'Entrada (Troca) - ' || v_sale.id, 'Conta Bancária', v_sale.id);
  end if;

  for v_payment in select * from public.payment_methods where sale_id = p_sale_id loop
    v_account := coalesce(nullif(v_payment.account, 'Caixa'), 'Conta Bancária');

    if v_payment.type = 'Devedor' then
      insert into public.debts (
        id, customer_id, sale_id, original_amount, remaining_amount, status,
        due_date, first_due_date, installments_total, notes, source
      ) values (
        'debt_' || replace(gen_random_uuid()::text, '-', ''),
        v_sale.customer_id,
        p_sale_id,
        coalesce(v_payment.amount, 0),
        coalesce(v_payment.amount, 0),
        'Aberta',
        v_payment.debt_due_date,
        v_payment.debt_due_date,
        greatest(1, coalesce(v_payment.debt_installments, 1)),
        v_payment.debt_notes,
        'pdv'
      );
    else
      insert into public.transactions (id, type, category, amount, date, description, account, sale_id)
      values (
        'trx_' || replace(gen_random_uuid()::text, '-', ''),
        'IN',
        'Venda',
        coalesce(v_payment.amount, 0),
        coalesce(v_sale.date, now()),
        case
          when v_payment.type in ('Cartão', 'Cartão Débito')
            then 'Venda (' || coalesce(v_payment.type, '') || ') liquido=' || coalesce(v_payment.amount, 0)::text || ' bruto=' || coalesce(v_payment.customer_amount, v_payment.amount, 0)::text || ' taxa=' || coalesce(v_payment.fee_amount, 0)::text || ' - ' || p_sale_id
          else 'Venda (' || coalesce(v_payment.type, '') || ') - ' || p_sale_id
        end,
        v_account,
        p_sale_id
      );
    end if;
  end loop;
end;
$$;
```

For `pdv_create_sale_trade_in_rows`, insert stock rows when no `stockItemId` exists, insert `sale_trade_in_items`, and update `sales.trade_in_id` to the first trade-in stock ID. Use existing field names from `stock_items` and `sale_trade_in_items`.

- [ ] **Step 4: Verify SQL**

Run:

```bash
npm run smoke:migrations
```

Expected: migration health passes or reports only environment setup problems.

---

### Task 5: Retire Conflicting Trigger Side Effects

**Files:**
- Modify: `supabase/migrations/20260517120000_pdv_sale_full_rpc.sql`

- [ ] **Step 1: Disable trigger side-effect duplication**

At the end of the migration before grants, drop triggers that duplicate RPC-owned financial side effects:

```sql
drop trigger if exists trg_sales_after_insert on public.sales;
drop trigger if exists trg_payment_methods_after_insert on public.payment_methods;
```

Keep stock insert and cancellation triggers unless a test proves duplication. The RPC directly marks sold items and inserts financial rows, so sale/payment financial triggers must not also run.

- [ ] **Step 2: Verify cancel flow still owns deletion**

Confirm the migration does not drop:

```sql
trg_sales_before_delete
trg_sale_items_after_insert
```

Run:

```bash
rg -n "drop trigger.*trg_sales_before_delete|drop trigger.*trg_sale_items_after_insert" supabase/migrations/20260517120000_pdv_sale_full_rpc.sql
```

Expected: no matches.

---

### Task 6: Add DataContext RPC Tests Before Frontend Refactor

**Files:**
- Modify: `services/dataContext.test.tsx`

- [ ] **Step 1: Add test for `addSale` using `create_sale_full`**

Add a test in `describe('DataProvider addSale')`:

```tsx
it('creates a PDV sale through the transactional create_sale_full RPC', async () => {
  const onDone = vi.fn();
  rpcMock.mockResolvedValueOnce({
    data: {
      id: 'sale-test-1',
      customer_id: 'cust-1',
      seller_id: 'seller-1',
      store_id: 'store-1',
      total: 390,
      discount: 0,
      trade_in_value: 0,
      trade_in_id: null,
      date: '2026-04-27T18:00:00.000Z',
      warranty_expires_at: '2026-07-26T18:00:00.000Z',
      sale_items: [],
      payment_methods: [],
      sale_trade_in_items: []
    },
    error: null
  });

  initialRowsByTable.sales = [];
  initialRowsByTable.transactions = [];

  render(
    <DataProvider>
      <AddSaleAfterLoad sale={saleWithDraftTradeIn()} onDone={onDone} />
    </DataProvider>
  );

  await waitFor(() => expect(onDone).toHaveBeenCalledWith());
  expect(rpcMock).toHaveBeenCalledWith('create_sale_full', expect.objectContaining({
    p_payload: expect.objectContaining({
      id: 'sale-test-1',
      customerId: 'cust-1',
      sellerId: 'seller-1',
      paymentMethods: expect.any(Array),
      tradeIns: expect.any(Array)
    })
  }));
});
```

- [ ] **Step 2: Add test for zero-total trade-in sale**

Add:

```tsx
it('allows addSale for a sale fully covered by trade-in with no financial payment methods', async () => {
  const onDone = vi.fn();
  const sale = {
    ...saleWithDraftTradeIn(),
    id: 'sale-zero-total-1',
    total: 0,
    tradeInValue: 390,
    paymentMethods: []
  };

  rpcMock.mockResolvedValueOnce({
    data: {
      id: sale.id,
      customer_id: sale.customerId,
      seller_id: sale.sellerId,
      store_id: sale.storeId,
      total: 0,
      discount: 0,
      trade_in_value: 390,
      trade_in_id: null,
      date: sale.date,
      warranty_expires_at: sale.warrantyExpiresAt,
      sale_items: [],
      payment_methods: [],
      sale_trade_in_items: []
    },
    error: null
  });

  render(
    <DataProvider>
      <AddSaleAfterLoad sale={sale} onDone={onDone} />
    </DataProvider>
  );

  await waitFor(() => expect(onDone).toHaveBeenCalledWith());
  expect(rpcMock).toHaveBeenCalledWith('create_sale_full', expect.objectContaining({
    p_payload: expect.objectContaining({
      total: 0,
      paymentMethods: []
    })
  }));
});
```

- [ ] **Step 3: Run tests and verify they fail**

Run:

```bash
npm run test:run -- services/dataContext.test.tsx -t "transactional create_sale_full|fully covered by trade-in"
```

Expected: FAIL because `addSale` still performs direct table inserts.

---

### Task 7: Refactor `dataContext.addSale` To Use RPC

**Files:**
- Modify: `services/dataContext.tsx`

- [ ] **Step 1: Add sale RPC payload mapper**

Near `addSale`, add:

```ts
const buildSaleFullPayload = (sale: Sale) => {
  const normalizedTradeIns = (sale.tradeIns || []).map((tradeIn) => ({
    id: tradeIn.id || newId('sti'),
    stockItemId: tradeIn.stockItemId || null,
    model: tradeIn.model || 'Trade-in',
    capacity: tradeIn.capacity || null,
    color: tradeIn.color || null,
    imei: tradeIn.imei || null,
    condition: tradeIn.condition || null,
    receivedValue: toNumber(tradeIn.receivedValue),
    stockSnapshot: tradeIn.stockSnapshot ? {
      id: tradeIn.stockSnapshot.id,
      type: tradeIn.stockSnapshot.type,
      model: tradeIn.stockSnapshot.model,
      color: tradeIn.stockSnapshot.color,
      hasBox: tradeIn.stockSnapshot.hasBox,
      capacity: tradeIn.stockSnapshot.capacity,
      imei: tradeIn.stockSnapshot.imei,
      condition: tradeIn.stockSnapshot.condition,
      status: tradeIn.stockSnapshot.status,
      simType: tradeIn.stockSnapshot.simType,
      batteryHealth: tradeIn.stockSnapshot.batteryHealth,
      storeId: tradeIn.stockSnapshot.storeId,
      purchasePrice: tradeIn.stockSnapshot.purchasePrice,
      sellPrice: tradeIn.stockSnapshot.sellPrice,
      maxDiscount: tradeIn.stockSnapshot.maxDiscount,
      warrantyType: tradeIn.stockSnapshot.warrantyType,
      warrantyEnd: tradeIn.stockSnapshot.warrantyEnd,
      origin: tradeIn.stockSnapshot.origin,
      notes: tradeIn.stockSnapshot.notes,
      observations: tradeIn.stockSnapshot.observations,
      entryDate: tradeIn.stockSnapshot.entryDate,
      photos: tradeIn.stockSnapshot.photos || []
    } : null
  })).filter((tradeIn) => tradeIn.receivedValue > 0);

  return {
    id: sale.id || newId('sale'),
    customerId: sale.customerId,
    sellerId: sale.sellerId,
    storeId: sale.storeId || sale.items[0]?.storeId || null,
    date: sale.date,
    total: toNumber(sale.total),
    discount: toNumber(sale.discount),
    discountType: sale.discountType || null,
    discountPercent: sale.discountPercent ?? null,
    originalSubtotal: toNumber(
      sale.originalSubtotal,
      sale.items.reduce((acc, item) => acc + toNumber(item.originalSellPrice ?? item.sellPrice), 0)
    ),
    negotiatedSubtotal: toNumber(
      sale.negotiatedSubtotal,
      sale.items.reduce((acc, item) => acc + toNumber(item.sellPrice), 0)
    ),
    warrantyExpiresAt: sale.warrantyExpiresAt,
    items: sale.items.map((item) => ({
      stockItemId: item.id,
      price: toNumber(item.sellPrice),
      originalPrice: toNumber(item.originalSellPrice ?? item.sellPrice),
      warrantyExpiresAt: item.warrantyExpiresAt || item.warrantyEnd || null
    })),
    paymentMethods: sale.paymentMethods.map((payment) => ({
      type: payment.type,
      amount: toNumber(payment.amount),
      account: payment.account ? normalizeFinancialAccount(payment.account) : null,
      installments: payment.installments ?? null,
      cardBrand: payment.cardBrand || null,
      customerAmount: payment.customerAmount ?? null,
      feeRate: payment.feeRate ?? null,
      feeAmount: payment.feeAmount ?? null,
      debtDueDate: payment.debtDueDate || null,
      debtInstallments: payment.debtInstallments ?? null,
      debtNotes: payment.debtNotes || null
    })),
    tradeIns: normalizedTradeIns,
    clientPayment: {
      amount: sale.clientPaymentAmount ?? 0,
      mode: sale.clientPaymentMode ?? null,
      account: sale.clientPaymentAccount ?? null,
      method: sale.clientPaymentMethod ?? null,
      notes: sale.clientPaymentNotes ?? null,
      dueDate: sale.clientPaymentDueDate ?? null
    }
  };
};
```

- [ ] **Step 2: Replace `addSale` persistence body**

Inside `addSale`, call:

```ts
const payload = buildSaleFullPayload(sale);
const { data, error } = await supabase.rpc('create_sale_full', { p_payload: payload });
if (error) throw error;
if (!data) throw new Error('Falha ao registrar venda.');

const saleId = payload.id;
const localSale = mapSaleRef.current(data);

recordPendingSaleMutation(saleId, 'add', localSale);
invalidatePendingFetches();
setSales((prev) => (prev.some((existingSale) => existingSale.id === saleId)
  ? prev.map((existingSale) => (existingSale.id === saleId ? localSale : existingSale))
  : [...prev, localSale]));

await refreshSaleSideEffects(saleId);

if (isAuthenticated) {
  void fetchData({ silent: true, force: true, reason: 'sale-created-follow-up' });
}

logDataEvent('sale_created', 'PDV', { saleId, total: sale.total });
```

Remove direct client-side inserts from the old `addSale` path.

- [ ] **Step 3: Verify**

Run:

```bash
npm run test:run -- services/dataContext.test.tsx -t "transactional create_sale_full|fully covered by trade-in"
npm run test:run -- services/dataContext.test.tsx
```

Expected: targeted tests pass; full `dataContext` suite may expose tests that still expect direct inserts. Update those tests to assert the RPC payload or returned mapped state, not old implementation details.

---

### Task 8: Add Update RPC Tests and Refactor `updateSale`

**Files:**
- Modify: `services/dataContext.test.tsx`
- Modify: `services/dataContext.tsx`
- Modify: `components/SaleCompleteEditModal.tsx`

- [ ] **Step 1: Add failing test for zero-total update**

In `services/dataContext.test.tsx`, add under `describe('DataProvider updateSale')`:

```tsx
it('updates a trade-in-covered sale with no financial payment methods through update_sale_full', async () => {
  const onDone = vi.fn();
  initialRowsByTable.sales = [latestSaleSnapshot()];

  rpcMock.mockResolvedValueOnce({
    data: {
      ...latestSaleSnapshot(),
      total: 0,
      trade_in_value: 390,
      payment_methods: [],
      sale_trade_in_items: [{
        id: 'sti-zero-update-1',
        sale_id: 'sale-existing-1',
        stock_item_id: null,
        model: 'iPhone Trade',
        capacity: '128 GB',
        color: 'Preto',
        imei: 'trade-imei',
        condition: 'Usado',
        received_value: 390
      }]
    },
    error: null
  });

  render(
    <DataProvider>
      <DataLoadProbe />
      <UpdateSaleAfterLoad
        saleId="sale-existing-1"
        updates={{
          total: 0,
          paymentMethods: [],
          tradeInValue: 390,
          tradeIns: [{
            id: 'sti-zero-update-1',
            model: 'iPhone Trade',
            receivedValue: 390
          }]
        }}
        onDone={onDone}
      />
    </DataProvider>
  );

  await waitFor(() => expect(onDone).toHaveBeenCalledWith());
  expect(rpcMock).toHaveBeenCalledWith('update_sale_full', expect.objectContaining({
    p_sale_id: 'sale-existing-1',
    p_payload: expect.objectContaining({
      total: 0,
      paymentMethods: []
    })
  }));
});
```

- [ ] **Step 2: Run test and verify it fails**

Run:

```bash
npm run test:run -- services/dataContext.test.tsx -t "updates a trade-in-covered sale"
```

Expected: FAIL because `updateSale` rejects empty payment methods and does not call RPC.

- [ ] **Step 3: Relax zero-total payment validation**

In `dataContext.updateSale`, replace:

```ts
if (!mergedSale.paymentMethods || mergedSale.paymentMethods.length === 0) {
  throw new Error('A venda precisa ter ao menos uma forma de pagamento.');
}
```

with:

```ts
const preliminaryTradeInValue = (mergedSale.tradeIns || []).reduce((acc, tradeIn) => acc + toNumber(tradeIn.receivedValue), 0);
const preliminaryTotal = toNumber(
  mergedSale.total,
  Math.max(0, toNumber(mergedSale.negotiatedSubtotal) - toNumber(mergedSale.discount) - preliminaryTradeInValue)
);

if (preliminaryTotal > 0 && (!mergedSale.paymentMethods || mergedSale.paymentMethods.length === 0)) {
  throw new Error('A venda precisa ter ao menos uma forma de pagamento.');
}
```

After normalized payments are built, replace:

```ts
if (normalizedPayments.length === 0) {
  throw new Error('Informe ao menos uma forma de pagamento com valor maior que zero.');
}
```

with:

```ts
if (total > 0 && normalizedPayments.length === 0) {
  throw new Error('Informe ao menos uma forma de pagamento com valor maior que zero.');
}
```

- [ ] **Step 4: Refactor update to RPC**

After validation and payload construction, call:

```ts
const payload = buildSaleFullPayload(mergedSale);
const { data, error } = await supabase.rpc('update_sale_full', {
  p_sale_id: saleId,
  p_payload: payload
});
if (error) throw error;
if (!data) throw new Error('Falha ao atualizar venda.');

const mapped = mapSaleRef.current(data);
recordPendingSaleMutation(saleId, 'add', mapped);
invalidatePendingFetches();
setSales((prev) => prev.map((sale) => (sale.id === saleId ? mapped : sale)));
await refreshSaleSideEffects(saleId);

if (isAuthenticated) {
  void fetchData({ silent: true, force: true, reason: 'sale-updated-follow-up' });
}

logDataEvent('sale_updated', 'PDVHistory', { saleId, total: mapped.total + mapped.tradeInValue });
```

Remove the old direct update/delete/reinsert logic from `updateSale` after the RPC path is green.

- [ ] **Step 5: Update edit modal validation if needed**

In `components/SaleCompleteEditModal.tsx`, keep this validation:

```ts
if (netFinancialTotal > 0 && normalizedPayments.length === 0) {
  setFormError('Informe pelo menos uma forma de pagamento com valor maior que zero.');
  return;
}
```

Do not add a blanket `payments.length === 0` check.

- [ ] **Step 6: Verify**

Run:

```bash
npm run test:run -- services/dataContext.test.tsx -t "updates a trade-in-covered sale"
npm run test:run -- services/dataContext.test.tsx
npm run typecheck
```

Expected: all pass.

---

### Task 9: Implement `update_sale_full` Rebuild Helper

**Files:**
- Modify: `supabase/migrations/20260517120000_pdv_sale_full_rpc.sql`

- [ ] **Step 1: Add rebuild helper**

Add:

```sql
create or replace function public.pdv_rebuild_sale_full_payload(p_sale_id text, p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.sales%rowtype;
  v_old_gross_total numeric;
  v_new_trade_in_value numeric := 0;
  v_new_gross_total numeric;
  v_row jsonb;
  v_previous_sold_ids text[];
  v_next_sold_ids text[];
begin
  perform public.pdv_assert_sale_payload(p_payload || jsonb_build_object('id', p_sale_id));

  select * into v_existing from public.sales where id = p_sale_id for update;
  if not found then
    raise exception 'Venda não encontrada: %', p_sale_id using errcode = 'P0002';
  end if;

  select array_agg(stock_item_id)
  into v_previous_sold_ids
  from public.sale_items
  where sale_id = p_sale_id;

  select array_agg(item->>'stockItemId')
  into v_next_sold_ids
  from jsonb_array_elements(coalesce(p_payload->'items', '[]'::jsonb)) item;

  v_old_gross_total := coalesce(v_existing.total, 0) + coalesce(v_existing.trade_in_value, 0);

  select coalesce(sum(coalesce((trade_in->>'receivedValue')::numeric, 0)), 0)
  into v_new_trade_in_value
  from jsonb_array_elements(coalesce(p_payload->'tradeIns', '[]'::jsonb)) trade_in;

  v_new_gross_total := coalesce((p_payload->>'total')::numeric, 0) + v_new_trade_in_value;

  delete from public.debt_payments where debt_id in (select id from public.debts where sale_id = p_sale_id);
  delete from public.debts where sale_id = p_sale_id;
  delete from public.payable_debt_payments where payable_debt_id in (select id from public.payable_debts where sale_id = p_sale_id);
  delete from public.payable_debts where sale_id = p_sale_id;
  delete from public.transactions where sale_id = p_sale_id;
  delete from public.sale_trade_in_items where sale_id = p_sale_id;
  delete from public.payment_methods where sale_id = p_sale_id;
  delete from public.sale_items where sale_id = p_sale_id;

  update public.sales
  set customer_id = p_payload->>'customerId',
      seller_id = p_payload->>'sellerId',
      store_id = nullif(p_payload->>'storeId', ''),
      total = coalesce((p_payload->>'total')::numeric, 0),
      discount = coalesce((p_payload->>'discount')::numeric, 0),
      discount_type = nullif(p_payload->>'discountType', ''),
      discount_percent = nullif(p_payload->>'discountPercent', '')::numeric,
      original_subtotal = coalesce((p_payload->>'originalSubtotal')::numeric, 0),
      negotiated_subtotal = coalesce((p_payload->>'negotiatedSubtotal')::numeric, 0),
      date = coalesce((p_payload->>'date')::timestamptz, date),
      warranty_expires_at = nullif(p_payload->>'warrantyExpiresAt', '')::timestamptz,
      trade_in_value = v_new_trade_in_value,
      client_payment_amount = nullif(coalesce((p_payload#>>'{clientPayment,amount}')::numeric, 0), 0),
      client_payment_mode = nullif(p_payload#>>'{clientPayment,mode}', ''),
      client_payment_account = nullif(p_payload#>>'{clientPayment,account}', ''),
      client_payment_method = nullif(p_payload#>>'{clientPayment,method}', ''),
      client_payment_notes = nullif(p_payload#>>'{clientPayment,notes}', ''),
      client_payment_due_date = nullif(p_payload#>>'{clientPayment,dueDate}', '')::date
  where id = p_sale_id;

  perform public.pdv_insert_sale_children_and_side_effects(p_sale_id, p_payload);

  update public.sellers
  set total_sales = greatest(0, coalesce(total_sales, 0) - v_old_gross_total),
      updated_at = now()
  where id = v_existing.seller_id and v_existing.seller_id <> p_payload->>'sellerId';

  update public.sellers
  set total_sales = greatest(0, coalesce(total_sales, 0) + v_new_gross_total),
      updated_at = now()
  where id = p_payload->>'sellerId' and v_existing.seller_id <> p_payload->>'sellerId';

  update public.sellers
  set total_sales = greatest(0, coalesce(total_sales, 0) + (v_new_gross_total - v_old_gross_total)),
      updated_at = now()
  where id = p_payload->>'sellerId' and v_existing.seller_id = p_payload->>'sellerId';

  update public.customers
  set purchases = greatest(0, coalesce(purchases, 0) - 1),
      total_spent = greatest(0, coalesce(total_spent, 0) - v_old_gross_total),
      updated_at = now()
  where id = v_existing.customer_id and v_existing.customer_id <> p_payload->>'customerId';

  update public.customers
  set purchases = coalesce(purchases, 0) + 1,
      total_spent = coalesce(total_spent, 0) + v_new_gross_total,
      updated_at = now()
  where id = p_payload->>'customerId' and v_existing.customer_id <> p_payload->>'customerId';

  update public.customers
  set total_spent = greatest(0, coalesce(total_spent, 0) + (v_new_gross_total - v_old_gross_total)),
      updated_at = now()
  where id = p_payload->>'customerId' and v_existing.customer_id = p_payload->>'customerId';

  if v_previous_sold_ids is not null then
    update public.stock_items
    set status = 'Disponível',
        updated_at = now()
    where id = any(v_previous_sold_ids)
      and not (id = any(coalesce(v_next_sold_ids, array[]::text[])))
      and not exists (
        select 1 from public.sale_items si
        where si.stock_item_id = stock_items.id
      );
  end if;
end;
$$;
```

If `pdv_insert_sale_full_payload` currently inserts the parent sale, split child/side-effect insertion into `pdv_insert_sale_children_and_side_effects(p_sale_id, p_payload)` and call it from both create and update. Keep parent insert only in `pdv_insert_sale_full_payload`.

- [ ] **Step 2: Verify migration**

Run:

```bash
npm run smoke:migrations
```

Expected: migration health passes or reports environment-only blockers.

---

### Task 10: Final Regression Pass

**Files:**
- No new source files unless previous tasks exposed missing test file.

- [ ] **Step 1: Run focused suites**

Run:

```bash
npm run test:run -- services/dataContext.test.tsx
npm run test:run -- pages/PDV.test.tsx
npm run test:run -- pages/PDVHistory.test.tsx
```

Expected: all tests pass.

- [ ] **Step 2: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: exit code 0.

- [ ] **Step 3: Run migration smoke**

Run:

```bash
npm run smoke:migrations
```

Expected: exit code 0. If local Supabase prerequisites are unavailable, record the exact missing prerequisite in the final implementation notes and do not claim migration smoke passed.

- [ ] **Step 4: Manual smoke checklist**

In the running app, verify:

- Normal Pix sale creates one sale and one IN transaction.
- Mixed Pix + Cartão sale creates correct net/card-fee transaction amounts.
- Devedor sale creates receivable debt and no immediate IN transaction for that portion.
- Trade-in partial sale creates trade-in IN/OUT pair plus payment transaction.
- Trade-in exceeds sale with Pix refund creates one OUT transaction for customer refund.
- Trade-in exceeds sale as dívida ativa creates one payable debt and no refund OUT transaction.
- Editing a trade-in-covered sale with `total = 0` saves.
- Canceling sale reverts sale-linked transactions/debts/payable debts and stock.

- [ ] **Step 5: Commit**

Commit only files changed for this plan:

```bash
git add pages/PDV.tsx pages/PDV.test.tsx components/SaleCompleteEditModal.tsx services/dataContext.tsx services/dataContext.test.tsx supabase/migrations/20260517120000_pdv_sale_full_rpc.sql docs/superpowers/specs/2026-05-17-pdv-finance-transactional-consistency-design.md docs/superpowers/plans/2026-05-17-pdv-finance-transactional-consistency.md
git commit -m "fix: make PDV sale financial writes transactional"
```

Expected: commit succeeds with no unrelated files staged.

---

## Self-Review

- Spec coverage: atomic create, idempotent retry, update reconciliation, zero-total trade-in sale, refund method restriction, draft restore, tests, and migration strategy are covered.
- Placeholder scan: no task relies on "TBD" or an unspecified test command.
- Type consistency: frontend uses existing `Sale`, `PaymentMethod`, `SaleTradeInItem`, `StockItem`, and `FinancialAccount` names.
- Scope: no UI redesign, CRM work, receipt redesign, or unrelated Finance refactor is included.
