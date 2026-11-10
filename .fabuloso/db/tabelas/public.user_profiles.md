# public.user_profiles
> tabela · RLS on · ~<100 linhas

## Colunas
| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| id | uuid | não |  |  |
| role | text | não |  |  |
| seller_id | text | sim |  |  |
| created_at | timestamp with time zone | não | `now()` |  |
| updated_at | timestamp with time zone | não | `now()` |  |
| active_tenant_id | uuid | sim |  |  |

## Chaves e restrições
- PK (id)
- FK (active_tenant_id) → public.tenants(id) on delete set null
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

## Gatilhos
- sync_primary_membership — AFTER INSERT OR UPDATE OF role, seller_id → private.sync_primary_membership()

## Grants
- anon: siud · authenticated: siud (s=select i=insert u=update d=delete)
