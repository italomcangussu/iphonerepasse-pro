# public.user_access_roles
> tabela · RLS on · ~0 linhas

## Colunas
| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| user_id | uuid | não |  |  |
| app_role | text | não |  |  |
| display_name | text | não |  |  |
| email | text | não |  |  |
| created_by | uuid | sim |  |  |
| created_at | timestamp with time zone | não | `now()` |  |
| updated_at | timestamp with time zone | não | `now()` |  |

## Chaves e restrições
- PK (user_id)
- FK (created_by) → auth.users(id) on delete set null
- FK (user_id) → auth.users(id) on delete cascade
- CHECK user_access_roles_app_role_check: `CHECK ((app_role = ANY (ARRAY['admin'::text, 'manager'::text, 'seller'::text])))`

## Políticas RLS
- "user_access_roles_admin_delete" — DELETE para authenticated · using `(( SELECT "current_role"() AS "current_role") = 'admin'::text)`
- "user_access_roles_admin_insert" — INSERT para authenticated · check `(( SELECT "current_role"() AS "current_role") = 'admin'::text)`
- "user_access_roles_admin_update" — UPDATE para authenticated · using `(( SELECT "current_role"() AS "current_role") = 'admin'::text)` · check `(( SELECT "current_role"() AS "current_role") = 'admin'::text)`
- "user_access_roles_select" — SELECT para authenticated · using `((( SELECT "current_role"() AS "current_role") = 'admin'::text) OR (( SELECT auth.uid() AS uid) = user_id))`

## Gatilhos
- trg_user_access_roles_set_updated_at — BEFORE UPDATE → public.app_set_updated_at()

## Grants
- anon: siud · authenticated: siud (s=select i=insert u=update d=delete)
