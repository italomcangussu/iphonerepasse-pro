# public.debts
> tabela · RLS on · ~<100 linhas

## Colunas
| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| id | text | não |  |  |
| customer_id | text | não |  |  |
| sale_id | text | sim |  |  |
| original_amount | numeric | não |  |  |
| remaining_amount | numeric | não |  |  |
| status | text | não | `'Aberta'::text` |  |
| due_date | date | sim |  |  |
| notes | text | sim |  |  |
| source | text | não | `'manual'::text` |  |
| created_at | timestamp with time zone | não | `now()` |  |
| updated_at | timestamp with time zone | não | `now()` |  |
| installments_total | integer | não | `1` |  |
| first_due_date | date | sim |  |  |
| custom_badge | text | sim |  |  |
| entry_account | text | sim |  |  |

## Chaves e restrições
- PK (id)
- FK (customer_id) → public.customers(id) on delete restrict
- FK (sale_id) → public.sales(id) on delete set null
- CHECK debts_entry_account_check: `CHECK ((entry_account = ANY (ARRAY['Conta Bancária'::text, 'Cofre'::text])))`
- CHECK debts_installments_total_check: `CHECK ((installments_total >= 1))`
- CHECK debts_original_amount_check: `CHECK ((original_amount > (0)::numeric))`
- CHECK debts_remaining_amount_check: `CHECK ((remaining_amount >= (0)::numeric))`
- CHECK debts_source_check: `CHECK ((source = ANY (ARRAY['manual'::text, 'pdv'::text, 'import_anexo'::text])))`
- CHECK debts_status_check: `CHECK ((status = ANY (ARRAY['Aberta'::text, 'Parcial'::text, 'Quitada'::text])))`

## Referenciada por (1)
public.debt_payments.debt_id

## Índices
- idx_debts_customer_id: `btree (customer_id)`
- idx_debts_due_date: `btree (due_date)`
- idx_debts_sale_id: `btree (sale_id)`
- idx_debts_status: `btree (status)`

## Políticas RLS
- "debts_admin_all" — ALL para authenticated · using `("current_role"() = 'admin'::text)` · check `("current_role"() = 'admin'::text)`

## Gatilhos
- trg_debts_after_delete — AFTER DELETE → public.handle_debt_after_delete()
- trg_debts_after_insert — AFTER INSERT → public.handle_debt_after_insert()
- trg_debts_after_update — AFTER UPDATE → public.handle_debt_after_update()

## Grants
- anon: siud · authenticated: siud (s=select i=insert u=update d=delete)
