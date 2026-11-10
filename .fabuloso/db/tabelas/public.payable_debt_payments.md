# public.payable_debt_payments
> tabela · RLS on · ~<100 linhas

## Colunas
| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| id | text | não |  |  |
| payable_debt_id | text | não |  |  |
| amount | numeric | não |  |  |
| payment_method | text | não |  |  |
| account | text | não |  |  |
| paid_at | timestamp with time zone | não | `now()` |  |
| notes | text | sim |  |  |
| attachment_path | text | sim |  |  |
| attachment_mime | text | sim |  |  |
| attachment_name | text | sim |  |  |
| attachment_size | integer | sim |  |  |
| created_at | timestamp with time zone | não | `now()` |  |
| tenant_id | uuid | não |  |  |

## Chaves e restrições
- PK (id)
- FK (payable_debt_id) → public.payable_debts(id) on delete cascade
- FK (tenant_id) → public.tenants(id)
- CHECK payable_debt_payments_account_check: `CHECK ((account = ANY (ARRAY['Conta Bancária'::text, 'Cofre'::text])))`
- CHECK payable_debt_payments_amount_check: `CHECK ((amount > (0)::numeric))`
- CHECK payable_debt_payments_payment_method_check: `CHECK ((payment_method = ANY (ARRAY['Pix'::text, 'Dinheiro'::text, 'Cartão'::text, 'Cartão Débito'::text])))`

## Referenciada por (1)
public.transactions.payable_debt_payment_id

## Índices
- idx_payable_debt_payments_debt_id: `btree (payable_debt_id)`
- idx_payable_debt_payments_paid_at: `btree (paid_at)`
- payable_debt_payments_tenant_idx: `btree (tenant_id)`

## Políticas RLS
- "payable_debt_payments_delete" — DELETE para authenticated · using `( SELECT has_app_permission('payable_debts'::text, 'deletable'::text) AS has_app_permission)`
- "payable_debt_payments_insert" — INSERT para authenticated · check `( SELECT has_app_permission('payable_debts'::text, 'editable'::text) AS has_app_permission)`
- "payable_debt_payments_select" — SELECT para authenticated · using `( SELECT has_app_permission('payable_debts'::text, 'visible'::text) AS has_app_permission)`
- "payable_debt_payments_update" — UPDATE para authenticated · using `( SELECT has_app_permission('payable_debts'::text, 'editable'::text) AS has_app_permission)` · check `( SELECT has_app_permission('payable_debts'::text, 'editable'::text) AS has_app_permission)`
- "tenant_isolation" — ALL para authenticated (restritiva) · using `(tenant_id = ( SELECT current_tenant_id() AS current_tenant_id))` · check `(tenant_id = ( SELECT current_tenant_id() AS current_tenant_id))`

## Gatilhos
- trg_payable_debt_payments_after_delete — AFTER DELETE → public.handle_payable_debt_payment_after_delete()
- trg_payable_debt_payments_after_insert — AFTER INSERT → public.handle_payable_debt_payment_after_insert()
- zz_tenant_fill — BEFORE INSERT → private.tenant_fill()
- zz_tenant_guard — BEFORE UPDATE OF tenant_id → private.tenant_guard()

## Grants
- anon: siud · authenticated: siud (s=select i=insert u=update d=delete)
