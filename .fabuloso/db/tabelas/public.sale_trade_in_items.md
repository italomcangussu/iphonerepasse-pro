# public.sale_trade_in_items
> tabela · RLS on · ~<1k linhas

## Colunas
| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| id | text | não |  |  |
| sale_id | text | não |  |  |
| stock_item_id | text | sim |  |  |
| model | text | não |  |  |
| capacity | text | sim |  |  |
| color | text | sim |  |  |
| imei | text | sim |  |  |
| condition | text | sim |  |  |
| received_value | numeric | não | `0` |  |
| created_at | timestamp with time zone | não | `now()` |  |
| updated_at | timestamp with time zone | não | `now()` |  |

## Chaves e restrições
- PK (id)
- FK (sale_id) → public.sales(id) on delete cascade
- FK (stock_item_id) → public.stock_items(id) on delete set null
- CHECK sale_trade_in_items_received_value_check: `CHECK ((received_value >= (0)::numeric))`

## Índices
- idx_sale_trade_in_items_sale_id: `btree (sale_id)`
- idx_sale_trade_in_items_stock_item_id: `btree (stock_item_id)`

## Políticas RLS
- "sale_trade_in_items_delete" — DELETE para authenticated · using `(( SELECT "current_role"() AS "current_role") = 'admin'::text)`
- "sale_trade_in_items_insert" — INSERT para authenticated · check `(( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text]))`
- "sale_trade_in_items_select" — SELECT para authenticated · using `(( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text]))`
- "sale_trade_in_items_update" — UPDATE para authenticated · using `(( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text]))` · check `(( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text]))`

## Grants
- anon: siud · authenticated: siud (s=select i=insert u=update d=delete)
