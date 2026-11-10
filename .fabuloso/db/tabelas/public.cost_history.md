# public.cost_history
> tabela · RLS on · ~<1k linhas

## Colunas
| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| id | text | não |  |  |
| model | text | não |  |  |
| description | text | não |  |  |
| amount | numeric | não |  |  |
| count | integer | sim | `1` |  |
| last_used | timestamp with time zone | sim | `now()` |  |
| created_at | timestamp with time zone | sim | `now()` |  |
| updated_at | timestamp with time zone | sim | `now()` |  |
| tenant_id | uuid | não |  |  |

## Chaves e restrições
- PK (id)
- FK (tenant_id) → public.tenants(id)

## Índices
- cost_history_tenant_idx: `btree (tenant_id)`

## Políticas RLS
- "cost_history_delete" — DELETE para authenticated · using `( SELECT has_app_permission('inventory'::text, 'deletable'::text) AS has_app_permission)`
- "cost_history_insert" — INSERT para authenticated · check `(( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text]))`
- "cost_history_select" — SELECT para authenticated · using `(( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text]))`
- "cost_history_update" — UPDATE para authenticated · using `(( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text]))` · check `(( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text]))`
- "tenant_isolation" — ALL para authenticated (restritiva) · using `(tenant_id = ( SELECT current_tenant_id() AS current_tenant_id))` · check `(tenant_id = ( SELECT current_tenant_id() AS current_tenant_id))`

## Gatilhos
- zz_tenant_fill — BEFORE INSERT → private.tenant_fill()
- zz_tenant_guard — BEFORE UPDATE OF tenant_id → private.tenant_guard()

## Grants
- anon: siud · authenticated: siud (s=select i=insert u=update d=delete)
