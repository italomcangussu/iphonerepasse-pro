# public.crm_filter_views
> tabela · RLS on · ~0 linhas

## Colunas
| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| id | uuid | não | `gen_random_uuid()` |  |
| user_id | uuid | não |  |  |
| store_id | text | sim |  |  |
| name | text | não |  |  |
| filters_json | jsonb | não | `'{}'::jsonb` |  |
| is_shared | boolean | não | `false` |  |
| created_at | timestamp with time zone | não | `now()` |  |
| updated_at | timestamp with time zone | não | `now()` |  |
| tenant_id | uuid | não |  |  |

## Chaves e restrições
- PK (id)
- FK (tenant_id) → public.tenants(id)
- FK (user_id) → auth.users(id) on delete cascade

## Índices
- crm_filter_views_tenant_idx: `btree (tenant_id)`
- idx_crm_filter_views_shared: `btree (is_shared) WHERE (is_shared = true)`
- idx_crm_filter_views_user: `btree (user_id)`

## Políticas RLS
- "crm_filter_views_delete" — DELETE para authenticated · using `(( SELECT auth.uid() AS uid) = user_id)`
- "crm_filter_views_insert" — INSERT para authenticated · check `(( SELECT auth.uid() AS uid) = user_id)`
- "crm_filter_views_select" — SELECT para authenticated · using `((( SELECT auth.uid() AS uid) = user_id) OR (is_shared = true))`
- "crm_filter_views_update" — UPDATE para authenticated · using `(( SELECT auth.uid() AS uid) = user_id)`
- "tenant_isolation" — ALL para authenticated (restritiva) · using `(tenant_id = ( SELECT current_tenant_id() AS current_tenant_id))` · check `(tenant_id = ( SELECT current_tenant_id() AS current_tenant_id))`

## Gatilhos
- zz_tenant_fill — BEFORE INSERT → private.tenant_fill()
- zz_tenant_guard — BEFORE UPDATE OF tenant_id → private.tenant_guard()

## Grants
- anon: siud · authenticated: siud (s=select i=insert u=update d=delete)
