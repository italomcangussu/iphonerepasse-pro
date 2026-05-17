# PDV Finance Transactional Consistency Design

## Goal

Make PDV sale creation and sale editing financially consistent by moving the business-critical write sequence into transactional Supabase RPCs, while preserving the existing PDV user experience and realtime refresh behavior.

## Current Problems

The current `dataContext.addSale` flow writes `sales`, `sale_items`, `payment_methods`, trade-in stock rows, `sale_trade_in_items`, client-payment transactions, payable debts, local state, and refreshes through several independent client-side calls. If any call fails after `sales.insert`, the database can retain a partial sale and side effects from triggers.

The current `updateSale` flow rebuilds payment methods, sale items, transactions, debts, and trade-ins, but does not reconcile `client_payment_*` fields or the payable debt / immediate OUT transaction generated when trade-in value exceeds the sale total.

The PDV allows valid sales with no financial payment methods when trade-in fully covers or exceeds the sold item value, but `updateSale` rejects empty payment methods.

The PDV draft restore effect can run again after later stock refreshes because it depends on `stock` and does not mark the draft as consumed independently from cart restoration.

## In Scope

- Add a transactional sale creation RPC.
- Add a transactional sale update RPC for completed-sale edits.
- Keep existing `cancel_sale` RPC as the cancellation authority.
- Update `dataContext.addSale` and `dataContext.updateSale` to call the RPCs.
- Keep the PDV UI structure intact.
- Fix PDV draft restore to apply at most once per mounted PDV instance.
- Restrict customer refund methods to `Pix` and `Dinheiro`.
- Add regression tests around partial failures, idempotent retry, trade-in-only sales, client refund reconciliation, and draft restore behavior.

## Out Of Scope

- Redesigning PDV screens.
- Changing pricing, card fee, or installment calculation rules.
- Replacing realtime architecture.
- Reworking CRM, warranty, receipt, or WhatsApp flows except where they consume the sale shape.
- Changing `cancel_sale` behavior unless tests reveal a direct incompatibility with the new RPC outputs.

## Recommended Architecture

Create two Postgres RPCs:

- `public.create_sale_full(p_payload jsonb)`
- `public.update_sale_full(p_sale_id text, p_payload jsonb)`

Both functions run as `security definer`, validate role through existing role helpers, write all sale-related records in one database transaction, and return the fully hydrated sale row shape needed by `SALES_SELECT`.

The frontend remains responsible for user input, field validation, and building a typed sale payload. The database becomes responsible for atomic persistence and derived side effects:

- sale core fields
- sold items
- payment methods
- receivable debts from `Devedor`
- trade-in stock rows and sale trade-in rows
- trade-in IN/OUT transactions
- normal payment IN transactions
- client refund OUT transaction or payable debt
- seller/customer counters

## RPC Payload Contract

The payload should be explicit and stable:

```json
{
  "id": "sale_...",
  "customerId": "cust_...",
  "sellerId": "seller_...",
  "storeId": "store_...",
  "date": "2026-05-17T12:00:00.000Z",
  "total": 3000,
  "discount": 0,
  "discountType": null,
  "discountPercent": null,
  "originalSubtotal": 3000,
  "negotiatedSubtotal": 3000,
  "warrantyExpiresAt": "2026-08-15T12:00:00.000Z",
  "items": [
    {
      "stockItemId": "stk_...",
      "price": 3000,
      "originalPrice": 3000,
      "warrantyExpiresAt": "2026-08-15T12:00:00.000Z"
    }
  ],
  "paymentMethods": [
    {
      "type": "Pix",
      "amount": 3000,
      "account": "Conta Bancária",
      "installments": null,
      "cardBrand": null,
      "customerAmount": null,
      "feeRate": null,
      "feeAmount": null,
      "debtDueDate": null,
      "debtInstallments": null,
      "debtNotes": null
    }
  ],
  "tradeIns": [
    {
      "id": "sti_...",
      "stockItemId": "stk_trade_...",
      "model": "iPhone 12",
      "capacity": "128 GB",
      "color": "Preto",
      "imei": "IMEI...",
      "condition": "Usado",
      "receivedValue": 1000,
      "stockSnapshot": {
        "type": "iPhone",
        "model": "iPhone 12",
        "capacity": "128 GB",
        "color": "Preto",
        "imei": "IMEI...",
        "condition": "Usado",
        "purchasePrice": 1000,
        "sellPrice": 0,
        "storeId": "store_..."
      }
    }
  ],
  "clientPayment": {
    "amount": 0,
    "mode": null,
    "account": null,
    "method": null,
    "notes": null,
    "dueDate": null
  }
}
```

The implementation may normalize camelCase keys inside SQL, but tests should lock the public shape sent by `dataContext`.

## Creation Rules

`create_sale_full` must be idempotent by sale ID:

- If no sale exists, create it and all side effects.
- If the sale exists and appears complete for the same ID, return the hydrated sale without duplicating children or financial rows.
- If the sale exists but is incomplete, delete sale-linked children and rebuild the sale atomically, or raise a clear error. The preferred behavior is rebuild because PDV retries reuse the same sale ID.

Payment validation:

- `sum(paymentMethods.amount) === total` when `total > 0`.
- `paymentMethods` may be empty when `total === 0`.
- `tradeInValue` is the sum of trade-in `receivedValue`.
- `clientPayment.amount === max(0, tradeInValue - (negotiatedSubtotal - discount))`.

## Update Rules

`update_sale_full` should update a completed sale by rebuilding all sale-linked generated rows in one transaction:

- Lock the sale row.
- Validate trade-in stock was not resold before removing or replacing it.
- Remove generated receivable debts for payment methods from this sale.
- Remove generated payable debts for client refund from this sale.
- Remove direct transactions linked to this sale.
- Replace `sale_items`, `payment_methods`, and `sale_trade_in_items`.
- Recreate generated side effects according to the new payload.
- Restore previously sold stock items that are no longer in the sale unless sold elsewhere.
- Mark newly sold stock items as sold.
- Recompute seller/customer counters using gross total (`total + tradeInValue`) delta.

For `clientPayment`:

- `mode = "immediate"` creates exactly one OUT transaction linked to `sale_id`.
- `mode = "payable_debt"` creates exactly one payable debt linked to `sale_id`.
- No client payment removes any previous sale-linked refund transaction/payable debt.

## Frontend Data Flow

`pages/PDV.tsx` continues to assemble a `Sale` object from the UI, but `dataContext.addSale` transforms it into the RPC payload. After RPC success:

- call `recordPendingSaleMutation(saleId, "add", hydratedSale)`
- call `invalidatePendingFetches()`
- apply the returned sale to local `sales`
- call `refreshSaleSideEffects(saleId)` or use returned side effects if the RPC returns them
- schedule silent `fetchData` as a follow-up

`dataContext.updateSale` transforms modal updates into the same payload shape and calls `update_sale_full`. It should allow empty payment methods when final `total` is `0`.

## PDV UI Adjustments

The customer refund method picker should expose only:

- `Pix`
- `Dinheiro`

The draft restore effect should use a consumed flag independent of `stock` updates:

- read localStorage once on mount
- store pending draft in a ref or state
- apply cart items once after stock is available
- never reapply that draft after the user starts editing the current sale flow

## Error Handling

RPC errors should be surfaced as plain user-facing messages through existing `useAsyncHandler` behavior.

Expected explicit error cases:

- sale not found on update
- permission denied
- stock item unavailable or already sold by another sale
- trade-in stock already resold during update/cancel-sensitive operations
- payment total mismatch
- invalid client refund mode or method

No partial database state should remain after these errors.

## Testing Strategy

Use TDD for each behavior.

Database/dataContext tests:

- `create_sale_full` partial failure does not leave sale/transactions/debts.
- `addSale` retry with the same sale ID does not duplicate rows.
- sale with `total = 0` and empty `paymentMethods` persists.
- client refund immediate creates one OUT transaction and survives refetch.
- client refund payable debt creates one payable debt and no immediate OUT transaction.
- update from immediate refund to payable debt removes the old OUT transaction and creates payable debt.
- update from payable debt to no refund removes the payable debt.
- update of trade-in-only sale does not require financial payment methods.
- stale focus resync does not remove newly returned sale side effects.

PDV tests:

- refund method picker only shows Pix and Dinheiro.
- draft restore applies once and does not overwrite later user edits after stock refresh.
- existing submit-in-flight guard still submits once.
- existing retry test still reuses the same sale ID.

Regression tests:

- `pages/PDV.test.tsx`
- `pages/PDVHistory.test.tsx`
- `services/dataContext.test.tsx`
- `components/SaleCompleteEditModal` tests if present or add focused coverage if absent
- `npm run typecheck`

## Migration Strategy

Create new migrations instead of editing historical migrations.

Recommended migration order:

1. Add helper functions for payload parsing if needed.
2. Add `create_sale_full`.
3. Add `update_sale_full`.
4. Grant execute to authenticated users.
5. Keep existing triggers temporarily, but prevent duplicated side effects by either:
   - moving side-effect creation fully into RPC and disabling conflicting triggers for RPC-managed writes, or
   - letting existing triggers handle sale/payment side effects and ensuring the RPC does not duplicate them.

The preferred choice is to centralize side effects inside the RPC and retire conflicting trigger behavior for sale/payment creation. This makes behavior explicit and easier to test.

## Acceptance Criteria

- A failed PDV finalization cannot leave a partial sale or orphan financial records.
- Retrying a sale finalization with the same `saleId` is safe.
- Sales fully covered by trade-in can be created and edited.
- Client refund changes are reflected exactly once in Finance.
- Realtime/refetch does not temporarily hide newly created financial rows.
- Existing cancellation behavior remains intact.
- All targeted tests and typecheck pass.

## Self-Review

- No placeholder requirements remain.
- Scope is limited to PDV sale persistence, sale editing, client refund, draft restore, and tests.
- The design intentionally avoids UI redesign and broad refactors.
- The RPC-vs-trigger ownership decision is explicit: prefer RPC-owned side effects and retire conflicting trigger behavior through a forward migration.
