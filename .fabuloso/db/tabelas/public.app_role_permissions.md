# public.app_role_permissions
> tabela · RLS on · ~<1k linhas

## Colunas
| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| role | text | não |  |  |
| permission_key | text | não |  |  |
| label | text | não |  |  |
| is_visible | boolean | não | `false` |  |
| is_editable | boolean | não | `false` |  |
| is_deletable | boolean | não | `false` |  |
| created_at | timestamp with time zone | não | `now()` |  |
| updated_at | timestamp with time zone | não | `now()` |  |
| tenant_id | uuid | não |  |  |

## Chaves e restrições
- PK (tenant_id, role, permission_key)
- FK (tenant_id) → public.tenants(id)
- CHECK app_role_permissions_role_check: `CHECK ((role = ANY (ARRAY['admin'::text, 'manager'::text, 'seller'::text])))`

## Índices
- app_role_permissions_tenant_idx: `btree (tenant_id)`

## Políticas RLS
- "app_role_permissions_delete" — DELETE para authenticated · using `(( SELECT "current_role"() AS "current_role") = 'admin'::text)`
- "app_role_permissions_insert" — INSERT para authenticated · check `((( SELECT app_operational_role() AS app_operational_role) = 'admin'::text) OR ((role <> 'admin'::text) AND ( SELECT has_app_permission('permissions_privacy'::text, 'editable'::text) AS has_app_permission)))`
- "app_role_permissions_select" — SELECT para authenticated · using `true`
- "app_role_permissions_update" — UPDATE para authenticated · using `((( SELECT app_operational_role() AS app_operational_role) = 'admin'::text) OR ((role <> 'admin'::text) AND ( SELECT has_app_permission('permissions_privacy'::text, 'editable'::text) AS has_app_permission)))` · check `((( SELECT app_operational_role() AS app_operational_role) = 'admin'::text) OR ((role <> 'admin'::text) AND ( SELECT has_app_permission('permissions_privacy'::text, 'editable'::text) AS has_app_permission)))`
- "tenant_isolation" — ALL para authenticated (restritiva) · using `(tenant_id = ( SELECT current_tenant_id() AS current_tenant_id))` · check `(tenant_id = ( SELECT current_tenant_id() AS current_tenant_id))`

## Gatilhos
- trg_app_role_permissions_set_updated_at — BEFORE UPDATE → public.app_set_updated_at()
- zz_tenant_fill — BEFORE INSERT → private.tenant_fill()
- zz_tenant_guard — BEFORE UPDATE OF tenant_id → private.tenant_guard()

## Grants
- anon: siud · authenticated: siud (s=select i=insert u=update d=delete)
