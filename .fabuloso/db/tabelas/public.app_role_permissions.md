# public.app_role_permissions
> tabela · RLS on · ~<100 linhas

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

## Chaves e restrições
- PK (role, permission_key)
- CHECK app_role_permissions_role_check: `CHECK ((role = ANY (ARRAY['admin'::text, 'manager'::text, 'seller'::text])))`

## Políticas RLS
- "app_role_permissions_delete" — DELETE para authenticated · using `(( SELECT "current_role"() AS "current_role") = 'admin'::text)`
- "app_role_permissions_insert" — INSERT para authenticated · check `((( SELECT app_operational_role() AS app_operational_role) = 'admin'::text) OR ((role <> 'admin'::text) AND ( SELECT has_app_permission('permissions_privacy'::text, 'editable'::text) AS has_app_permission)))`
- "app_role_permissions_select" — SELECT para authenticated · using `true`
- "app_role_permissions_update" — UPDATE para authenticated · using `((( SELECT app_operational_role() AS app_operational_role) = 'admin'::text) OR ((role <> 'admin'::text) AND ( SELECT has_app_permission('permissions_privacy'::text, 'editable'::text) AS has_app_permission)))` · check `((( SELECT app_operational_role() AS app_operational_role) = 'admin'::text) OR ((role <> 'admin'::text) AND ( SELECT has_app_permission('permissions_privacy'::text, 'editable'::text) AS has_app_permission)))`

## Gatilhos
- trg_app_role_permissions_set_updated_at — BEFORE UPDATE → public.app_set_updated_at()

## Grants
- anon: siud · authenticated: siud (s=select i=insert u=update d=delete)
