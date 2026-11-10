# public.business_profile
> tabela · RLS on · ~<100 linhas

## Colunas
| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| id | text | não |  |  |
| name | text | não |  |  |
| cnpj | text | sim |  |  |
| phone | text | sim |  |  |
| email | text | sim |  |  |
| address | text | sim |  |  |
| instagram | text | sim |  |  |
| logo_url | text | sim |  |  |
| primary_color | text | sim |  |  |
| created_at | timestamp with time zone | sim | `now()` |  |
| updated_at | timestamp with time zone | sim | `now()` |  |
| tenant_id | uuid | não |  |  |

## Chaves e restrições
- PK (tenant_id, id)
- FK (tenant_id) → public.tenants(id)

## Índices
- business_profile_tenant_idx: `btree (tenant_id)`

## Políticas RLS
- "business_profile_delete" — DELETE para authenticated · using `(( SELECT "current_role"() AS "current_role") = 'admin'::text)`
- "business_profile_insert" — INSERT para authenticated · check `( SELECT has_app_permission('profile_store'::text, 'editable'::text) AS has_app_permission)`
- "business_profile_select" — SELECT para authenticated · using `(( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text]))`
- "business_profile_update" — UPDATE para authenticated · using `( SELECT has_app_permission('profile_store'::text, 'editable'::text) AS has_app_permission)` · check `( SELECT has_app_permission('profile_store'::text, 'editable'::text) AS has_app_permission)`
- "tenant_isolation" — ALL para authenticated (restritiva) · using `(tenant_id = ( SELECT current_tenant_id() AS current_tenant_id))` · check `(tenant_id = ( SELECT current_tenant_id() AS current_tenant_id))`

## Gatilhos
- zz_tenant_fill — BEFORE INSERT → private.tenant_fill()
- zz_tenant_guard — BEFORE UPDATE OF tenant_id → private.tenant_guard()

## Grants
- anon: siud · authenticated: siud (s=select i=insert u=update d=delete)
