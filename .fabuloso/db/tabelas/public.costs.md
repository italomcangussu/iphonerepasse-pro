# public.costs
> tabela · RLS on · ~<1k linhas

## Colunas
| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| id | text | não |  |  |
| stock_item_id | text | sim |  |  |
| description | text | não |  |  |
| amount | numeric | não |  |  |
| date | timestamp with time zone | sim | `now()` |  |
| created_at | timestamp with time zone | sim | `now()` |  |
| part_id | text | sim |  |  |
| part_quantity | numeric | sim |  |  |
| tenant_id | uuid | não |  |  |

## Chaves e restrições
- PK (id)
- FK (part_id) → public.parts_inventory(id) on delete set null
- FK (stock_item_id) → public.stock_items(id) on delete cascade
- FK (tenant_id) → public.tenants(id)
- CHECK costs_part_quantity_check: `CHECK (((part_quantity IS NULL) OR (part_quantity > (0)::numeric)))`

## Índices
- costs_tenant_idx: `btree (tenant_id)`
- idx_costs_part_id: `btree (part_id)`
- idx_costs_stock_item_id: `btree (stock_item_id)`

## Políticas RLS
- "costs_delete" — DELETE para authenticated · using `( SELECT has_app_permission('inventory'::text, 'deletable'::text) AS has_app_permission)`
- "costs_insert" — INSERT para authenticated · check `(( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text]))`
- "costs_select" — SELECT para authenticated · using `(( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text]))`
- "costs_update" — UPDATE para authenticated · using `(( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text]))` · check `(( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text]))`
- "tenant_isolation" — ALL para authenticated (restritiva) · using `(tenant_id = ( SELECT current_tenant_id() AS current_tenant_id))` · check `(tenant_id = ( SELECT current_tenant_id() AS current_tenant_id))`

## Gatilhos
- zz_tenant_fill — BEFORE INSERT → private.tenant_fill()
- zz_tenant_guard — BEFORE UPDATE OF tenant_id → private.tenant_guard()

## Grants
- anon: siud · authenticated: siud (s=select i=insert u=update d=delete)
