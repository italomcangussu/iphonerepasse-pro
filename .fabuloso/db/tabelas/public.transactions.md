# public.transactions
> tabela · RLS on · ~<10k linhas

## Colunas
| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| id | text | não |  |  |
| type | text | não |  |  |
| category | text | não |  |  |
| amount | numeric | não | `0` |  |
| date | timestamp with time zone | sim | `now()` |  |
| description | text | sim |  |  |
| account | text | não |  |  |
| sale_id | text | sim |  |  |
| created_at | timestamp with time zone | sim | `now()` |  |
| updated_at | timestamp with time zone | sim | `now()` |  |
| debt_payment_id | text | sim |  |  |
| payable_debt_payment_id | text | sim |  |  |
| payable_debt_id | text | sim |  |  |
| transfer_group_id | text | sim |  |  |
| debt_id | text | sim |  |  |
| payee_seller_id | text | sim |  |  |
| tenant_id | uuid | não |  |  |

## Chaves e restrições
- PK (id)
- FK (debt_payment_id) → public.debt_payments(id) on delete cascade
- FK (payable_debt_payment_id) → public.payable_debt_payments(id) on delete cascade
- FK (payee_seller_id) → public.sellers(id) on delete set null
- FK (sale_id) → public.sales(id) on delete set null
- FK (tenant_id) → public.tenants(id)
- CHECK transactions_account_check: `CHECK ((account = ANY (ARRAY['Conta Bancária'::text, 'Cofre'::text, 'Devedores'::text])))`

## Referenciada por (4)
public.care_contract_installments.transaction_id, public.payment_methods.reservation_deposit_transaction_id, public.stock_reservations.deposit_refund_transaction_id, public.stock_reservations.deposit_transaction_id

## Índices
- idx_transactions_date_created_at: `btree (date DESC, created_at DESC)`
- idx_transactions_debt_id: `btree (debt_id)`
- idx_transactions_debt_payment_id: `btree (debt_payment_id)`
- idx_transactions_payable_debt_id: `btree (payable_debt_id)`
- idx_transactions_payable_debt_payment_id: `btree (payable_debt_payment_id)`
- idx_transactions_payee_seller_id: `btree (payee_seller_id) WHERE (payee_seller_id IS NOT NULL)`
- idx_transactions_sale_id: `btree (sale_id)`
- idx_transactions_transfer_group_id: `btree (transfer_group_id) WHERE (transfer_group_id IS NOT NULL)`
- transactions_tenant_idx: `btree (tenant_id)`

## Políticas RLS
- "tenant_isolation" — ALL para authenticated (restritiva) · using `(tenant_id = ( SELECT current_tenant_id() AS current_tenant_id))` · check `(tenant_id = ( SELECT current_tenant_id() AS current_tenant_id))`
- "transactions_delete" — DELETE para authenticated · using `( SELECT has_app_permission('finance'::text, 'deletable'::text) AS has_app_permission)`
- "transactions_insert" — INSERT para authenticated · check `( SELECT has_app_permission('finance'::text, 'editable'::text) AS has_app_permission)`
- "transactions_select" — SELECT para authenticated · using `( SELECT has_app_permission('finance'::text, 'visible'::text) AS has_app_permission)`
- "transactions_update" — UPDATE para authenticated · using `( SELECT has_app_permission('finance'::text, 'editable'::text) AS has_app_permission)` · check `( SELECT has_app_permission('finance'::text, 'editable'::text) AS has_app_permission)`

## Gatilhos
- trg_transactions_after_delete — AFTER DELETE → public.handle_transaction_after_delete()
- zz_tenant_fill — BEFORE INSERT → private.tenant_fill()
- zz_tenant_guard — BEFORE UPDATE OF tenant_id → private.tenant_guard()

## Grants
- anon: siud · authenticated: siud (s=select i=insert u=update d=delete)
