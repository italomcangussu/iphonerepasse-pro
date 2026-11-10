# public.creditors
> tabela · RLS on · ~<100 linhas

## Colunas
| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| id | text | não |  |  |
| name | text | não |  |  |
| document | text | sim |  |  |
| document_type | text | sim |  |  |
| phone | text | sim |  |  |
| email | text | sim |  |  |
| notes | text | sim |  |  |
| created_at | timestamp with time zone | não | `now()` |  |
| updated_at | timestamp with time zone | não | `now()` |  |
| tenant_id | uuid | não |  |  |

## Chaves e restrições
- PK (id)
- FK (tenant_id) → public.tenants(id)
- CHECK creditors_document_type_check: `CHECK ((document_type = ANY (ARRAY['CPF'::text, 'CNPJ'::text])))`

## Referenciada por (1)
public.payable_debts.creditor_id

## Índices
- creditors_tenant_idx: `btree (tenant_id)`
- idx_creditors_name: `btree (name)`

## Políticas RLS
- "creditors_delete" — DELETE para authenticated · using `( SELECT has_app_permission('payable_debts'::text, 'deletable'::text) AS has_app_permission)`
- "creditors_insert" — INSERT para authenticated · check `( SELECT has_app_permission('payable_debts'::text, 'editable'::text) AS has_app_permission)`
- "creditors_select" — SELECT para authenticated · using `( SELECT has_app_permission('payable_debts'::text, 'visible'::text) AS has_app_permission)`
- "creditors_update" — UPDATE para authenticated · using `( SELECT has_app_permission('payable_debts'::text, 'editable'::text) AS has_app_permission)` · check `( SELECT has_app_permission('payable_debts'::text, 'editable'::text) AS has_app_permission)`
- "tenant_isolation" — ALL para authenticated (restritiva) · using `(tenant_id = ( SELECT current_tenant_id() AS current_tenant_id))` · check `(tenant_id = ( SELECT current_tenant_id() AS current_tenant_id))`

## Gatilhos
- set_creditors_updated_at — BEFORE UPDATE → public.tg_set_creditors_updated_at()
- zz_tenant_fill — BEFORE INSERT → private.tenant_fill()
- zz_tenant_guard — BEFORE UPDATE OF tenant_id → private.tenant_guard()

## Grants
- anon: siud · authenticated: siud (s=select i=insert u=update d=delete)
