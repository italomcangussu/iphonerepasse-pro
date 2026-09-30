# public.stock_reservations
> tabela · RLS on · ~<100 linhas

## Colunas
| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| id | text | não |  |  |
| stock_item_id | text | não |  |  |
| customer_name | text | não |  |  |
| customer_phone | text | não |  |  |
| reserved_at | timestamp with time zone | não | `now()` |  |
| expires_at | timestamp with time zone | sim |  |  |
| deposit_amount | numeric(10,2) | sim |  |  |
| deposit_payment_method | text | sim |  |  |
| notes | text | sim |  |  |
| status | text | não | `'active'::text` |  |
| released_at | timestamp with time zone | sim |  |  |
| sold_at | timestamp with time zone | sim |  |  |
| created_at | timestamp with time zone | não | `now()` |  |
| updated_at | timestamp with time zone | não | `now()` |  |
| deposit_transaction_id | text | sim |  |  |
| deposit_refund_transaction_id | text | sim |  |  |
| deposit_refunded_at | timestamp with time zone | sim |  |  |
| deposit_retained_at | timestamp with time zone | sim |  |  |
| sold_sale_id | text | sim |  |  |
| seller_id | text | sim |  |  |
| created_by | uuid | sim |  |  |
| seller_name | text | sim |  |  |

## Chaves e restrições
- PK (id)
- FK (created_by) → auth.users(id) on delete set null
- FK (deposit_refund_transaction_id) → public.transactions(id) on delete set null
- FK (deposit_transaction_id) → public.transactions(id) on delete set null
- FK (seller_id) → public.sellers(id) on delete set null
- FK (sold_sale_id) → public.sales(id) on delete set null
- FK (stock_item_id) → public.stock_items(id) on delete cascade
- CHECK stock_reservations_deposit_amount_check: `CHECK (((deposit_amount IS NULL) OR (deposit_amount >= (0)::numeric)))`
- CHECK stock_reservations_status_check: `CHECK ((status = ANY (ARRAY['active'::text, 'released'::text, 'sold'::text])))`

## Referenciada por
- public.payment_methods.reservation_id

## Índices
- idx_stock_reservations_deposit_transaction_id: `btree (deposit_transaction_id)`
- idx_stock_reservations_expires_at: `btree (expires_at) WHERE ((status = 'active'::text) AND (expires_at IS NOT NULL))`
- idx_stock_reservations_one_active: `btree (stock_item_id) WHERE (status = 'active'::text)` único
- idx_stock_reservations_seller_id: `btree (seller_id)`
- idx_stock_reservations_sold_sale_id: `btree (sold_sale_id)`
- idx_stock_reservations_stock_item_id: `btree (stock_item_id)`

## Políticas RLS
- "stock_reservations_store_scope_insert" — INSERT para authenticated · check `(EXISTS ( SELECT 1 FROM stock_items si WHERE ((si.id = stock_reservations.stock_item_id) AND crm_can_access_store(si.store_id))))`
- "stock_reservations_store_scope_select" — SELECT para authenticated · using `(EXISTS ( SELECT 1 FROM stock_items si WHERE ((si.id = stock_reservations.stock_item_id) AND crm_can_access_store(si.store_id))))`
- "stock_reservations_store_scope_update" — UPDATE para authenticated · using `(EXISTS ( SELECT 1 FROM stock_items si WHERE ((si.id = stock_reservations.stock_item_id) AND crm_can_access_store(si.store_id))))` · check `(EXISTS ( SELECT 1 FROM stock_items si WHERE ((si.id = stock_reservations.stock_item_id) AND crm_can_access_store(si.store_id))))`

## Gatilhos
- trg_stock_reservations_set_updated_at — BEFORE UPDATE → public.tg_set_stock_reservations_updated_at()

## Grants
- anon: siud · authenticated: siud (s=select i=insert u=update d=delete)
