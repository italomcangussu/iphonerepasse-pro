# public.sale_items
> tabela · RLS on · ~<1k linhas

## Colunas
| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| id | text | não |  |  |
| sale_id | text | sim |  |  |
| stock_item_id | text | sim |  |  |
| price | numeric | não |  |  |
| created_at | timestamp with time zone | sim | `now()` |  |
| original_price | numeric | sim |  |  |
| tenant_id | uuid | não |  |  |

## Chaves e restrições
- PK (id)
- FK (sale_id) → public.sales(id) on delete cascade
- FK (stock_item_id) → public.stock_items(id)
- FK (tenant_id) → public.tenants(id)
- CHECK sale_items_original_price_check: `CHECK (((original_price IS NULL) OR (original_price >= (0)::numeric)))`

## Referenciada por (1)
public.care_contracts.sale_item_id

## Índices
- idx_sale_items_sale_id: `btree (sale_id)`
- idx_sale_items_stock_item_id: `btree (stock_item_id)`
- sale_items_tenant_idx: `btree (tenant_id)`

## Políticas RLS
- "sale_items_delete" — DELETE para authenticated · using `( SELECT has_app_permission('pdv'::text, 'deletable'::text) AS has_app_permission)`
- "sale_items_insert" — INSERT para authenticated · check `(( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text]))`
- "sale_items_select" — SELECT para authenticated · using `(( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text]))`
- "sale_items_update" — UPDATE para authenticated · using `(( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text]))` · check `(( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text]))`
- "tenant_isolation" — ALL para authenticated (restritiva) · using `(tenant_id = ( SELECT current_tenant_id() AS current_tenant_id))` · check `(tenant_id = ( SELECT current_tenant_id() AS current_tenant_id))`

## Gatilhos
- trg_sale_items_after_insert — AFTER INSERT → public.handle_sale_item_after_insert()
- zz_tenant_fill — BEFORE INSERT → private.tenant_fill()
- zz_tenant_guard — BEFORE UPDATE OF tenant_id → private.tenant_guard()

## Grants
- anon: siud · authenticated: siud (s=select i=insert u=update d=delete)
