# public.stock_items
> tabela · RLS on · ~<1k linhas

## Colunas
| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| id | text | não |  |  |
| type | text | não |  |  |
| model | text | não |  |  |
| color | text | sim |  |  |
| capacity | text | sim |  |  |
| imei | text | sim |  |  |
| condition | text | não |  |  |
| status | text | não | `'Disponível'::text` |  |
| battery_health | integer | sim |  |  |
| store_id | text | sim |  |  |
| purchase_price | numeric | sim | `0` |  |
| sell_price | numeric | sim | `0` |  |
| max_discount | numeric | sim | `0` |  |
| warranty_type | text | sim | `'Loja'::text` |  |
| warranty_end | date | sim |  |  |
| origin | text | sim |  |  |
| notes | text | sim |  |  |
| entry_date | timestamp with time zone | sim | `now()` |  |
| photos | text[] | sim | `'{}'::text[]` |  |
| created_at | timestamp with time zone | sim | `now()` |  |
| updated_at | timestamp with time zone | sim | `now()` |  |
| has_box | boolean | não | `false` |  |
| observations | text | sim |  |  |
| sim_type | text | sim |  |  |
| ram | text | sim |  |  |

## Chaves e restrições
- PK (id)
- FK (store_id) → public.stores(id)

## Referenciada por (5)
public.costs.stock_item_id, public.sale_items.stock_item_id, public.sale_trade_in_items.stock_item_id, public.sales.trade_in_id, public.stock_reservations.stock_item_id

## Índices
- idx_stock_items_store_id: `btree (store_id)`

## Políticas RLS
- "stock_items_delete" — DELETE para authenticated · using `(( SELECT "current_role"() AS "current_role") = 'admin'::text)`
- "stock_items_insert" — INSERT para authenticated · check `(( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text]))`
- "stock_items_select" — SELECT para authenticated · using `(( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text]))`
- "stock_items_update" — UPDATE para authenticated · using `(( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text]))` · check `(( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text]))`

## Grants
- anon: siud · authenticated: siud (s=select i=insert u=update d=delete)
