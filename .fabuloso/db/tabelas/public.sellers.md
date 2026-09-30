# public.sellers
> tabela · RLS on · ~<100 linhas

## Colunas
| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| id | text | não |  |  |
| name | text | não |  |  |
| total_sales | numeric | sim | `0` |  |
| created_at | timestamp with time zone | sim | `now()` |  |
| updated_at | timestamp with time zone | sim | `now()` |  |
| email | text | sim |  |  |
| auth_user_id | uuid | sim |  |  |
| store_id | text | sim |  |  |

## Chaves e restrições
- PK (id)
- FK (auth_user_id) → auth.users(id)
- FK (store_id) → public.stores(id) on delete set null
- UNIQUE (auth_user_id)
- UNIQUE (email)

## Referenciada por
- public.sales.seller_id
- public.stock_reservations.seller_id
- public.user_profiles.seller_id

## Índices
- idx_sellers_store_id: `btree (store_id)`
- sellers_auth_user_id_key: `btree (auth_user_id)` único
- sellers_email_key: `btree (email)` único

## Políticas RLS
- "sellers_delete" — DELETE para authenticated · using `(( SELECT "current_role"() AS "current_role") = 'admin'::text)`
- "sellers_insert" — INSERT para authenticated · check `(( SELECT "current_role"() AS "current_role") = 'admin'::text)`
- "sellers_select" — SELECT para authenticated · using `(( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text]))`
- "sellers_update" — UPDATE para authenticated · using `(( SELECT "current_role"() AS "current_role") = 'admin'::text)` · check `(( SELECT "current_role"() AS "current_role") = 'admin'::text)`

## Grants
- anon: siud · authenticated: siud (s=select i=insert u=update d=delete)
