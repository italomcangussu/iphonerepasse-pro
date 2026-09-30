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

## Chaves e restrições
- PK (id)
- FK (sale_id) → public.sales(id) on delete cascade
- FK (stock_item_id) → public.stock_items(id)
- CHECK sale_items_original_price_check: `CHECK (((original_price IS NULL) OR (original_price >= (0)::numeric)))`

## Índices
- idx_sale_items_sale_id: `btree (sale_id)`
- idx_sale_items_stock_item_id: `btree (stock_item_id)`

## Políticas RLS
- "sale_items_delete" — DELETE para authenticated · using `(( SELECT "current_role"() AS "current_role") = 'admin'::text)`
- "sale_items_insert" — INSERT para authenticated · check `(( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text]))`
- "sale_items_select" — SELECT para authenticated · using `(( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text]))`
- "sale_items_update" — UPDATE para authenticated · using `(( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text]))` · check `(( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text]))`

## Gatilhos
- trg_sale_items_after_insert — AFTER INSERT → public.handle_sale_item_after_insert()

## Grants
- anon: siud · authenticated: siud (s=select i=insert u=update d=delete)
