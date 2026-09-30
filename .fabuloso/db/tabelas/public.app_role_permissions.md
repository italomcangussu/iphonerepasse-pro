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
- "app_role_permissions_insert" — INSERT para authenticated · check `(( SELECT "current_role"() AS "current_role") = 'admin'::text)`
- "app_role_permissions_select" — SELECT para authenticated · using `true`
- "app_role_permissions_update" — UPDATE para authenticated · using `(( SELECT "current_role"() AS "current_role") = 'admin'::text)` · check `(( SELECT "current_role"() AS "current_role") = 'admin'::text)`

## Gatilhos
- trg_app_role_permissions_set_updated_at — BEFORE UPDATE → public.app_set_updated_at()

## Grants
- anon: siud · authenticated: siud (s=select i=insert u=update d=delete)
