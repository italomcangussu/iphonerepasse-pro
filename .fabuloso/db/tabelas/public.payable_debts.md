# public.payable_debts
> tabela · RLS on · ~<100 linhas

## Colunas
| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| id | text | não |  |  |
| creditor_id | text | não |  |  |
| creditor_name | text | não |  |  |
| creditor_document | text | sim |  |  |
| creditor_phone | text | sim |  |  |
| original_amount | numeric | não |  |  |
| remaining_amount | numeric | não |  |  |
| status | text | não | `'Aberta'::text` |  |
| due_date | date | sim |  |  |
| first_due_date | date | sim |  |  |
| installments_total | integer | não | `1` |  |
| notes | text | sim |  |  |
| source | text | não | `'manual'::text` |  |
| created_at | timestamp with time zone | não | `now()` |  |
| updated_at | timestamp with time zone | não | `now()` |  |
| sale_id | text | sim |  |  |
| entry_account | text | sim |  |  |

## Chaves e restrições
- PK (id)
- FK (creditor_id) → public.creditors(id) on delete restrict
- FK (sale_id) → public.sales(id) on delete set null
- CHECK payable_debts_entry_account_check: `CHECK ((entry_account = ANY (ARRAY['Conta Bancária'::text, 'Cofre'::text])))`
- CHECK payable_debts_installments_total_check: `CHECK ((installments_total >= 1))`
- CHECK payable_debts_original_amount_check: `CHECK ((original_amount > (0)::numeric))`
- CHECK payable_debts_remaining_amount_check: `CHECK ((remaining_amount >= (0)::numeric))`
- CHECK payable_debts_source_check: `CHECK ((source = ANY (ARRAY['manual'::text, 'import_anexo'::text, 'pdv'::text])))`
- CHECK payable_debts_status_check: `CHECK ((status = ANY (ARRAY['Aberta'::text, 'Parcial'::text, 'Quitada'::text])))`

## Referenciada por
- public.payable_debt_payments.payable_debt_id

## Índices
- idx_payable_debts_creditor_id: `btree (creditor_id)`
- idx_payable_debts_due_date: `btree (due_date)`
- idx_payable_debts_sale_id: `btree (sale_id)`
- idx_payable_debts_status: `btree (status)`

## Políticas RLS
- "payable_debts_admin_all" — ALL para authenticated · using `("current_role"() = 'admin'::text)` · check `("current_role"() = 'admin'::text)`

## Gatilhos
- set_payable_debts_updated_at — BEFORE UPDATE → public.tg_set_payable_debts_updated_at()
- trg_payable_debts_after_delete — AFTER DELETE → public.handle_payable_debt_after_delete()
- trg_payable_debts_after_insert — AFTER INSERT → public.handle_payable_debt_after_insert()
- trg_payable_debts_after_update — AFTER UPDATE → public.handle_payable_debt_after_update()

## Grants
- anon: siud · authenticated: siud (s=select i=insert u=update d=delete)
