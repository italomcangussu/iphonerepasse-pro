# Reservation Deposit PDV Finance Design

## Goal

Make reserved-device sales financially correct end to end.

When a stock item is reserved with a paid deposit, that deposit must enter cash/finance on the payment day as an advance. Later, selling the reserved item from its details view must start the PDV flow with that item and count the already-paid deposit as a registered payment, without duplicating the financial cash-in. If the reservation is canceled, the user must choose whether to refund the deposit or retain it because the customer gave up the purchase.

## Current Behavior

The inventory reservation flow already stores structured reservation data in `stock_reservations`, including `deposit_amount` and `deposit_payment_method`.

Today those deposit fields are informational only:

- reserving with a deposit does not create a finance transaction;
- `Liberar reserva` releases the stock item directly with no refund decision;
- `Vender reservado` only shows a toast and redirects to the PDV history route;
- the regular PDV product picker lists only `StockStatus.AVAILABLE`, which is still the correct default safety behavior.

The sale flow is already transactional through the PDV RPC path. Any reservation-deposit finance behavior must preserve that standard and avoid client-side multi-write gaps.

## Product Rules

Reservation deposit:

- A reservation deposit greater than zero is money already received.
- It must create a financial `IN` transaction on the reservation payment date.
- The transaction represents an advance, not a final sale payment yet.
- The reservation must keep a durable link to the finance transaction so edits, cancellation, and final sale do not duplicate money.

Selling a reserved item:

- From stock details of a reserved item, the existing `Vender reservado` action starts `/#/pdv/nova-venda`.
- The PDV starts with the reserved item in the cart.
- The deposit is shown as an already-paid payment method.
- The deposit reduces the remaining amount to collect.
- The final sale must not create a second financial `IN` transaction for the already-recorded deposit.
- When the sale succeeds, the active reservation is marked as `sold` with `sold_at`.

Canceling a reservation:

- `Liberar reserva` must open a confirmation modal when the active reservation has a paid deposit.
- The modal asks whether to refund the deposit.
- If the user chooses refund, the system creates a financial `OUT` transaction on the cancellation date and releases the stock item.
- If the user chooses not to refund, the system releases the stock item without an `OUT` transaction; the original advance remains in finance as retained revenue.
- If the active reservation has no paid deposit, release can use the current simple confirmation/release behavior.

## Recommended Architecture

Use reservation-specific transactional RPCs for all money-moving reservation actions.

Extend the database model instead of encoding the deposit only in notes:

- add `deposit_transaction_id` to `stock_reservations`;
- add `deposit_refund_transaction_id` to `stock_reservations`;
- add `deposit_refunded_at` to `stock_reservations`;
- add `deposit_retained_at` to `stock_reservations`;
- add optional `sold_sale_id` to `stock_reservations` if useful for traceability.

Add or replace RPCs:

- `reserve_stock_item(p_stock_item_id text, p_payload jsonb)` keeps the existing public contract but creates or updates the linked deposit transaction atomically.
- `release_stock_reservation(p_stock_item_id text, p_refund_deposit boolean)` releases the active reservation, returns the stock item to `Disponível`, and creates the refund transaction when requested.
- `mark_stock_reservation_sold(p_stock_item_id text, p_sale_id text)` can be a helper called from the PDV sale RPC, or the sale RPC can do the update inline.

The frontend should continue calling DataProvider actions rather than writing reservation rows or finance transactions directly.

## Finance Model

Deposit receipt:

- Type: `IN`
- Category: `Adiantamento de reserva`
- Amount: `deposit_amount`
- Date: reservation payment date, defaulting to the save time if no explicit payment date is added.
- Description: `Adiantamento de reserva - {customerName} - {model}`
- Account:
  - `Dinheiro` goes to `Cofre`;
  - `Pix`, `Cartão`, and `Cartão Débito` go to `Conta Bancária`;
  - `Outro` defaults to `Conta Bancária` unless a future account selector is added.

Deposit refund:

- Type: `OUT`
- Category: `Estorno de reserva`
- Amount: original paid deposit amount
- Date: cancellation date
- Description: `Estorno de reserva - {customerName} - {model}`
- Account: same account as the original deposit transaction when possible.

Retained deposit:

- No new transaction is created.
- The original `IN` remains in finance.
- The reservation records `deposit_retained_at` for auditability.

Finance categories should be seeded through a forward migration:

- `Adiantamento de reserva` as `IN`;
- `Estorno de reserva` as `OUT`.

## PDV Payment Model

The PDV must distinguish normal sale payments from reservation deposits that are already in finance.

Extend the payment model with optional metadata:

```ts
type PaymentSource = 'pdv' | 'reservation_deposit';

interface PaymentMethod {
  type: 'Pix' | 'Dinheiro' | 'Cartão' | 'Cartão Débito' | 'Devedor';
  amount: number;
  account?: FinancialAccount;
  source?: PaymentSource;
  reservationId?: string;
  reservationDepositTransactionId?: string;
}
```

The concrete code should preserve the existing runtime labels and only add the source metadata.

Rules:

- `calculatePdvTotals` counts reservation deposit payments in `totalPaidNet`.
- The PDV payment list renders them as read-only or clearly marked `Sinal já recebido`.
- Removing the reserved item from the cart removes the linked deposit payment.
- User-added payments remain editable/removable as today.
- The sale RPC persists the reservation deposit as a `payment_methods` row for sale history and receipts.
- The sale RPC skips finance transaction creation for `payment_methods.source = 'reservation_deposit'`.
- Payment validation still uses the sum of all payment methods, including the reservation deposit.

## Opening PDV From Reserved Details

Use the existing PDV draft/prefill path, but make the reservation intent explicit so normal saved drafts do not get confused with reserved-sale starts.

Add a focused prefill payload, either by extending `PdvDraft` or adding a new key:

```ts
type ReservedSalePrefill = {
  stockItemId: string;
  reservationId: string;
  selectedStore: string;
  selectedClient?: string;
  depositPayment?: PaymentMethod;
};
```

Inventory behavior:

- `handleSellReserved(item)` writes the prefill payload.
- It navigates to `/#/pdv/nova-venda`.
- It closes the details modal.

PDV behavior:

- On mount, read the reserved-sale prefill once.
- Wait for stock and customers to load.
- Validate the item still exists and is still `Reservado`.
- Add the item to cart even though the regular picker still excludes reserved stock.
- Set selected store from the item.
- Set selected client when the reservation can be matched to a customer by name and phone; otherwise leave client selection for the user.
- Add a reservation-deposit payment when the active reservation has `deposit_amount > 0`.
- Clear the prefill after applying it, so refreshes do not reapply stale state.

The regular product picker remains limited to `Disponível` devices.

## Sale RPC Changes

When creating or updating a sale, the RPC must:

- accept payment method source metadata;
- insert the reservation deposit payment row;
- skip creating a finance `IN` transaction for reservation deposit payments;
- validate that a reservation-deposit payment references an active reservation for one of the sold stock items;
- validate that the linked reservation deposit transaction exists and matches amount enough to prevent accidental reuse;
- mark the reservation as `sold` after successful sale creation;
- avoid marking a reservation as sold if the sale fails.

For sale updates:

- Editing an existing sale with a reservation deposit should keep the no-duplicate-finance rule.
- Removing the reserved item or its reservation-deposit payment should be blocked unless a clear future refund/retention workflow is designed. This scope should keep completed-sale edits conservative.

For sale cancellation:

- Existing sale cancellation restores sold stock to `Disponível`.
- If the canceled sale came from a reservation, the reservation should not become active again automatically in this scope.
- The linked deposit remains historically received unless a separate finance correction is performed. Automatic refund-on-sale-cancel is out of scope because it is a different business decision from canceling the reservation before sale.

## UI Changes

Inventory details:

- `Vender reservado` becomes the primary path to start the PDV flow for a reserved item.
- The reservation card should make the deposit status visible:
  - no signal;
  - signal recebido;
  - signal estornado;
  - signal retido;
  - vendido.

Release confirmation modal:

- Title: `Liberar reserva`
- If deposit exists:
  - show customer, item, deposit amount, and payment method;
  - primary action for the common/recommended business-safe choice can be `Estornar sinal`;
  - secondary action can be `Liberar sem estorno`;
  - cancel keeps the reservation unchanged.
- If no deposit exists, keep a simpler confirmation or direct action consistent with current UX patterns.

PDV:

- Show a non-editable payment row for the reservation deposit.
- Label it clearly as `Sinal já recebido`.
- The remaining amount should already subtract that value.
- The finish-sale guard must accept the sale when normal payments plus reservation deposit match the total.

## Error Handling

Expected errors should surface through existing toast/inline error behavior:

- reservation no longer active;
- stock item no longer reserved;
- deposit transaction missing or amount mismatch;
- user tries to refund an already refunded deposit;
- sale tries to reuse a reservation deposit already sold;
- finance transaction insert fails.

The RPCs must keep stock status, reservation lifecycle, and transactions atomic. A failed reservation save, release, refund, or sale must not leave partial money movement.

## Tests

Use TDD for implementation.

Data and RPC tests:

- reserving with a deposit creates one linked `IN` transaction;
- reserving without a deposit creates no transaction;
- editing reservation details without changing the deposit does not duplicate the transaction;
- changing the deposit on an active, unsold, unreleased reservation updates the linked `IN` transaction in place;
- changing the deposit to zero on an active, unsold, unreleased reservation removes the linked `IN` transaction;
- changing deposit fields is blocked after the reservation is sold, refunded, retained, or released;
- release with refund creates one linked `OUT` transaction and sets `deposit_refunded_at`;
- release without refund creates no `OUT` transaction and sets `deposit_retained_at`;
- release without deposit does not ask for refund metadata at the data layer;
- sale creation with reservation deposit inserts a payment method but does not insert a second sale `IN` for that amount;
- successful sale marks reservation as `sold`;
- failed sale leaves reservation active and stock reserved.

Frontend tests:

- `Vender reservado` writes the reserved-sale prefill and navigates to `/#/pdv/nova-venda`;
- PDV applies reserved-sale prefill once;
- PDV can add a reserved item through prefill while the standard product picker still excludes reserved items;
- PDV shows the deposit as `Sinal já recebido`;
- PDV remaining balance subtracts the deposit;
- removing the reserved item removes the reservation deposit payment;
- release modal asks whether to refund when a paid deposit exists;
- choosing refund calls release with refund enabled;
- choosing no refund calls release with refund disabled.

Regression checks:

- `services/dataContext.test.tsx`
- `pages/Inventory.test.tsx`
- `pages/PDV.test.tsx`
- `pages/pdv/pdvCalculations.test.ts`
- `pages/pdv/buildSalePayload.test.ts`
- `npm run test:run` when feasible
- `npm run lint`
- `npm run typecheck`

## Out Of Scope

- CRM/n8n reservation automation.
- Automatic release on expiration.
- Multi-device reservation bundles.
- A separate account selector in the reservation modal.
- Automatic refund when canceling a completed sale.
- Reopening a historical reservation when a completed sale is canceled.

## Acceptance Criteria

- A paid reservation immediately appears in Finance on the reservation payment date.
- Selling a reserved item starts the PDV with that item selected intentionally.
- The paid reservation deposit reduces the PDV remaining balance.
- Finalizing the reserved sale does not duplicate the deposit in Finance.
- Canceling a paid reservation asks whether to refund.
- Choosing refund creates a finance `OUT` transaction.
- Choosing no refund keeps the original advance and creates no refund transaction.
- Reservation lifecycle, stock status, payment rows, and finance transactions remain transactionally consistent.
