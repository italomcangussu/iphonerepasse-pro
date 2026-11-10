# public.finance_categories
> tabela · RLS on · ~<100 linhas

## Colunas
| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| id | text | não |  |  |
| name | text | não |  |  |
| type | text | não |  |  |
| is_default | boolean | não | `false` |  |
| created_at | timestamp with time zone | não | `now()` |  |
| updated_at | timestamp with time zone | não | `now()` |  |
| tenant_id | uuid | não |  |  |

## Chaves e restrições
- PK (id)
- FK (tenant_id) → public.tenants(id)
- CHECK finance_categories_type_check: `CHECK ((type = ANY (ARRAY['IN'::text, 'OUT'::text])))`

## Índices
- finance_categories_tenant_idx: `btree (tenant_id)`

## Políticas RLS
- "finance_categories_delete" — DELETE para authenticated · using `( SELECT has_app_permission('finance'::text, 'deletable'::text) AS has_app_permission)`
- "finance_categories_insert" — INSERT para authenticated · check `( SELECT has_app_permission('finance'::text, 'editable'::text) AS has_app_permission)`
- "finance_categories_select" — SELECT para authenticated · using `true`
- "finance_categories_update" — UPDATE para authenticated · using `( SELECT has_app_permission('finance'::text, 'editable'::text) AS has_app_permission)` · check `( SELECT has_app_permission('finance'::text, 'editable'::text) AS has_app_permission)`
- "tenant_isolation" — ALL para authenticated (restritiva) · using `(tenant_id = ( SELECT current_tenant_id() AS current_tenant_id))` · check `(tenant_id = ( SELECT current_tenant_id() AS current_tenant_id))`

## Gatilhos
- set_finance_categories_updated_at — BEFORE UPDATE → public.tg_set_finance_categories_updated_at()
- zz_tenant_fill — BEFORE INSERT → private.tenant_fill()
- zz_tenant_guard — BEFORE UPDATE OF tenant_id → private.tenant_guard()

## Grants
- anon: siud · authenticated: siud (s=select i=insert u=update d=delete)
