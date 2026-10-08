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

## Chaves e restrições
- PK (id)
- FK (debt_payment_id) → public.debt_payments(id) on delete cascade
- FK (payable_debt_payment_id) → public.payable_debt_payments(id) on delete cascade
- FK (sale_id) → public.sales(id) on delete set null
- CHECK transactions_account_check: `CHECK ((account = ANY (ARRAY['Conta Bancária'::text, 'Cofre'::text, 'Devedores'::text])))`

## Referenciada por (3)
public.payment_methods.reservation_deposit_transaction_id, public.stock_reservations.deposit_refund_transaction_id, public.stock_reservations.deposit_transaction_id

## Índices
- idx_transactions_date_created_at: `btree (date DESC, created_at DESC)`
- idx_transactions_debt_id: `btree (debt_id)`
- idx_transactions_debt_payment_id: `btree (debt_payment_id)`
- idx_transactions_payable_debt_id: `btree (payable_debt_id)`
- idx_transactions_payable_debt_payment_id: `btree (payable_debt_payment_id)`
- idx_transactions_sale_id: `btree (sale_id)`
- idx_transactions_transfer_group_id: `btree (transfer_group_id) WHERE (transfer_group_id IS NOT NULL)`

## Políticas RLS
- "transactions_admin_all" — ALL para authenticated · using `("current_role"() = 'admin'::text)` · check `("current_role"() = 'admin'::text)`

## Gatilhos
- trg_transactions_after_delete — AFTER DELETE → public.handle_transaction_after_delete()

## Grants
- anon: siud · authenticated: siud (s=select i=insert u=update d=delete)
