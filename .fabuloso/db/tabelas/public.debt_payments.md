# public.debt_payments
> tabela · RLS on · ~<1k linhas

## Colunas
| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| id | text | não |  |  |
| debt_id | text | não |  |  |
| amount | numeric | não |  |  |
| payment_method | text | não |  |  |
| account | text | não |  |  |
| paid_at | timestamp with time zone | não | `now()` |  |
| notes | text | sim |  |  |
| created_at | timestamp with time zone | não | `now()` |  |

## Chaves e restrições
- PK (id)
- FK (debt_id) → public.debts(id) on delete cascade
- CHECK debt_payments_account_check: `CHECK ((account = ANY (ARRAY['Conta Bancária'::text, 'Cofre'::text, 'Devedores'::text])))`
- CHECK debt_payments_amount_check: `CHECK ((amount > (0)::numeric))`
- CHECK debt_payments_payment_method_check: `CHECK ((payment_method = ANY (ARRAY['Pix'::text, 'Dinheiro'::text, 'Cartão'::text, 'Cartão Débito'::text])))`

## Referenciada por (1)
public.transactions.debt_payment_id

## Índices
- idx_debt_payments_debt_id: `btree (debt_id)`
- idx_debt_payments_paid_at: `btree (paid_at)`

## Políticas RLS
- "debt_payments_admin_all" — ALL para authenticated · using `("current_role"() = 'admin'::text)` · check `("current_role"() = 'admin'::text)`

## Gatilhos
- trg_debt_payments_after_delete — AFTER DELETE → public.handle_debt_payment_after_delete()
- trg_debt_payments_after_insert — AFTER INSERT → public.handle_debt_payment_after_insert()

## Grants
- anon: siud · authenticated: siud (s=select i=insert u=update d=delete)
