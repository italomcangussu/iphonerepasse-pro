# Inventory Reserved Tab Design

## Context

The inventory page currently exposes two operational tabs: `Disponíveis` and `Em Preparação`. The codebase already has `StockStatus.RESERVED = 'Reservado'`, and `stock_items.status` is stored as text, so no enum migration is required just to use the status.

The current `Disponíveis` tab uses `DEFAULT_LIST_STATUSES = [StockStatus.AVAILABLE, StockStatus.RESERVED]`, which means reserved devices can appear together with available stock. The new behavior must separate reserved devices into their own tab so they are not treated as generally available for sale.

The PDV default product list currently filters only `StockStatus.AVAILABLE`, which is the correct default safety behavior for this feature.

## Goal

Add a dedicated `Reservado` inventory tab for devices separated for a customer, usually after a possible deposit, while keeping those devices out of the normal available-for-sale list.

## Approved Product Direction

Use a lightweight structured reservation model.

Each reservation is linked to a stock item and stores:

- customer name
- customer phone/contact
- reservation date
- optional expiration date
- optional deposit amount
- optional deposit payment method
- reservation notes
- reservation lifecycle status

Deposit amount and deposit payment method are informational in this first scope. They must not create financial transactions automatically.

## Inventory Tabs

The main inventory segmented control should become:

`Disponíveis` | `Reservado` | `Em Preparação`

Tab behavior:

- `Disponíveis` lists only `StockStatus.AVAILABLE`.
- `Reservado` lists only `StockStatus.RESERVED`.
- `Em Preparação` lists only `StockStatus.PREPARATION`.

Condition and store filters should keep the existing behavior where possible. The preparation tab can continue hiding condition filters. The reserved tab should behave like available stock for search/store/condition filtering because these devices are still sale inventory, just separated.

## Reservation Flow

From a device in `Disponíveis`, users with inventory edit permission can choose `Reservar`.

The reservation modal collects:

- customer name, required
- customer phone/contact, required
- expiration date, optional
- deposit amount, optional
- deposit payment method, required only when deposit amount is greater than zero
- notes, optional

On save:

- create or update the active reservation for the stock item
- update `stock_items.status` to `Reservado`
- move the user to the `Reservado` tab or leave a clear success toast

## Reserved Device Actions

Inside the `Reservado` tab and device details, a reserved item should expose:

- `Editar reserva`
- `Liberar para venda`
- `Vender`

`Editar reserva` updates the structured reservation data and keeps the item reserved.

`Liberar para venda` changes `stock_items.status` back to `Disponível` and closes the active reservation as released/canceled. It does not delete the historical reservation record.

`Vender` must be explicit from the reserved item. The standard PDV inventory picker should continue listing only `Disponível` devices so reserved devices are not sold accidentally. A sale started from the reserved item may pass that item intentionally into the PDV flow or use an explicit reserved-item sale path.

## Expiration Rule

Expiration date is optional.

When a reserved item has an expiration date before today, the interface should show it as expired/overdue in the `Reservado` tab and details view. The system must not automatically release the device.

This keeps the final decision with the team and avoids accidentally making a still-negotiated device available.

## Data Model

Create a reservation structure linked to `stock_items.id`.

Recommended table:

```sql
public.stock_reservations (
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
  updated_at timestamptz not null default now()
)
```

Reservation statuses:

- `active`
- `released`
- `sold`

Only one active reservation should exist per stock item. Enforce this with a partial unique index on `(stock_item_id)` where `status = 'active'`.

RLS should follow the same store-access boundary as stock items by checking the linked stock item store.

## Data Flow

Frontend data context should load active reservation data with stock items or expose a separate reservation collection keyed by `stockItemId`.

The inventory page should derive:

- available rows from stock status
- reserved rows from stock status plus active reservation details
- expired-reservation visual state from `expires_at`

Actions should be explicit methods rather than ad hoc status updates:

- `reserveStockItem(stockItemId, reservationInput)`
- `updateStockReservation(reservationId, reservationInput)`
- `releaseStockReservation(stockItemId)`

These methods should keep the stock item status and reservation lifecycle in sync.

## Error Handling

If reservation save succeeds but status update fails, the operation should surface an error and avoid showing the item as successfully reserved.

If a reservation exists but the stock item is no longer available, the modal should block creating a new active reservation and tell the user the current status.

If releasing fails, keep the item in `Reservado` and show an error toast/banner.

## Out Of Scope

This first version does not include:

- automatic deposit transactions in Finance
- automatic CRM reservation creation
- automatic release on expiration
- payment confirmation workflow
- customer table linking
- multi-device reservation bundles

These can be added later without changing the core status separation.

## Test Plan

Unit/component tests:

- `Disponíveis` does not render `StockStatus.RESERVED` rows.
- `Reservado` renders only `StockStatus.RESERVED` rows.
- reserving an available item calls the reservation save path and updates status to `Reservado`.
- releasing a reserved item updates status to `Disponível`.
- expired reserved rows are visually marked, with no automatic status change.
- standard PDV stock picker continues listing only `StockStatus.AVAILABLE`.

Data tests:

- reservation mapping handles optional deposit amount and optional payment method.
- creating a reservation without customer name or phone is blocked.
- payment method is required only when deposit amount is greater than zero.
- only one active reservation per stock item is allowed.

Regression checks:

- `Em Preparação` remains isolated from available/reserved lists.
- complete share list should not include reserved devices unless the product decision changes.
- sale cancellation still restores sold stock to `Disponível`, not `Reservado`.

