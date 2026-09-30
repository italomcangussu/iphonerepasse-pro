# public.user_profiles
> tabela · RLS on · ~0 linhas

## Colunas
| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| id | uuid | não |  |  |
| role | text | não |  |  |
| seller_id | text | sim |  |  |
| created_at | timestamp with time zone | não | `now()` |  |
| updated_at | timestamp with time zone | não | `now()` |  |

## Chaves e restrições
- PK (id)
- FK (id) → auth.users(id) on delete cascade
- FK (seller_id) → public.sellers(id) on delete set null
- UNIQUE (seller_id)
- CHECK user_profiles_role_check: `CHECK ((role = ANY (ARRAY['admin'::text, 'seller'::text])))`

## Índices
- user_profiles_seller_id_key: `btree (seller_id)` único

## Políticas RLS
- "user_profiles_admin_delete" — DELETE para authenticated · using `(( SELECT "current_role"() AS "current_role") = 'admin'::text)`
- "user_profiles_admin_insert" — INSERT para authenticated · check `(( SELECT "current_role"() AS "current_role") = 'admin'::text)`
- "user_profiles_admin_update" — UPDATE para authenticated · using `(( SELECT "current_role"() AS "current_role") = 'admin'::text)` · check `(( SELECT "current_role"() AS "current_role") = 'admin'::text)`
- "user_profiles_select" — SELECT para authenticated · using `((( SELECT "current_role"() AS "current_role") = 'admin'::text) OR (( SELECT auth.uid() AS uid) = id))`

## Grants
- anon: siud · authenticated: siud (s=select i=insert u=update d=delete)
