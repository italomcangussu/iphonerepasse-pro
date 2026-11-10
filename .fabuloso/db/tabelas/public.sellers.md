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
| tenant_id | uuid | não |  |  |

## Chaves e restrições
- PK (id)
- FK (auth_user_id) → auth.users(id)
- FK (store_id) → public.stores(id) on delete set null
- FK (tenant_id) → public.tenants(id)
- UNIQUE (tenant_id, auth_user_id)
- UNIQUE (tenant_id, email)

## Referenciada por (6)
public.care_contracts.seller_id, public.sales.seller_id, public.stock_reservations.seller_id, public.tenant_members.seller_id, public.transactions.payee_seller_id, public.user_profiles.seller_id

## Índices
- idx_sellers_store_id: `btree (store_id)`
- sellers_tenant_auth_user_key: `btree (tenant_id, auth_user_id)` único
- sellers_tenant_email_key: `btree (tenant_id, email)` único
- sellers_tenant_idx: `btree (tenant_id)`

## Políticas RLS
- "sellers_delete" — DELETE para authenticated · using `( SELECT has_app_permission('sellers'::text, 'deletable'::text) AS has_app_permission)`
- "sellers_insert" — INSERT para authenticated · check `( SELECT has_app_permission('sellers'::text, 'editable'::text) AS has_app_permission)`
- "sellers_select" — SELECT para authenticated · using `(( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text]))`
- "sellers_update" — UPDATE para authenticated · using `( SELECT has_app_permission('sellers'::text, 'editable'::text) AS has_app_permission)` · check `( SELECT has_app_permission('sellers'::text, 'editable'::text) AS has_app_permission)`
- "tenant_isolation" — ALL para authenticated (restritiva) · using `(tenant_id = ( SELECT current_tenant_id() AS current_tenant_id))` · check `(tenant_id = ( SELECT current_tenant_id() AS current_tenant_id))`

## Gatilhos
- zz_tenant_fill — BEFORE INSERT → private.tenant_fill()
- zz_tenant_guard — BEFORE UPDATE OF tenant_id → private.tenant_guard()

## Grants
- anon: siud · authenticated: siud (s=select i=insert u=update d=delete)
