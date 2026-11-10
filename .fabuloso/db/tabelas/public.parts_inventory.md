# public.parts_inventory
> tabela · RLS on · ~0 linhas

## Colunas
| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| id | text | não |  |  |
| name | text | não |  |  |
| quantity | integer | não |  |  |
| unit_cost | numeric | não |  |  |
| created_at | timestamp with time zone | não | `now()` |  |
| updated_at | timestamp with time zone | não | `now()` |  |
| tenant_id | uuid | não |  |  |

## Chaves e restrições
- PK (id)
- FK (tenant_id) → public.tenants(id)
- UNIQUE (tenant_id, name)
- CHECK parts_inventory_name_check: `CHECK ((char_length(TRIM(BOTH FROM name)) > 0))`
- CHECK parts_inventory_quantity_check: `CHECK ((quantity >= 0))`
- CHECK parts_inventory_unit_cost_check: `CHECK ((unit_cost >= (0)::numeric))`

## Referenciada por (1)
public.costs.part_id

## Índices
- parts_inventory_name_idx: `btree (name)`
- parts_inventory_tenant_idx: `btree (tenant_id)`
- parts_inventory_tenant_name_key: `btree (tenant_id, name)` único

## Políticas RLS
- "parts_inventory_delete" — DELETE para authenticated · using `( SELECT has_app_permission('parts_stock'::text, 'deletable'::text) AS has_app_permission)`
- "parts_inventory_insert" — INSERT para authenticated · check `(( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text]))`
- "parts_inventory_select" — SELECT para authenticated · using `(( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text]))`
- "parts_inventory_update" — UPDATE para authenticated · using `(( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text]))` · check `(( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text]))`
- "tenant_isolation" — ALL para authenticated (restritiva) · using `(tenant_id = ( SELECT current_tenant_id() AS current_tenant_id))` · check `(tenant_id = ( SELECT current_tenant_id() AS current_tenant_id))`

## Gatilhos
- set_parts_inventory_updated_at — BEFORE UPDATE → public.tg_set_parts_inventory_updated_at()
- zz_tenant_fill — BEFORE INSERT → private.tenant_fill()
- zz_tenant_guard — BEFORE UPDATE OF tenant_id → private.tenant_guard()

## Grants
- anon: siud · authenticated: siud (s=select i=insert u=update d=delete)
