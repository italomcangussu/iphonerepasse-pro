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

## Chaves e restrições
- PK (id)
- UNIQUE (name)
- CHECK parts_inventory_name_check: `CHECK ((char_length(TRIM(BOTH FROM name)) > 0))`
- CHECK parts_inventory_quantity_check: `CHECK ((quantity >= 0))`
- CHECK parts_inventory_unit_cost_check: `CHECK ((unit_cost >= (0)::numeric))`

## Referenciada por (1)
public.costs.part_id

## Índices
- parts_inventory_name_idx: `btree (name)`
- parts_inventory_name_key: `btree (name)` único

## Políticas RLS
- "parts_inventory_delete" — DELETE para authenticated · using `(( SELECT "current_role"() AS "current_role") = 'admin'::text)`
- "parts_inventory_insert" — INSERT para authenticated · check `(( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text]))`
- "parts_inventory_select" — SELECT para authenticated · using `(( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text]))`
- "parts_inventory_update" — UPDATE para authenticated · using `(( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text]))` · check `(( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text]))`

## Gatilhos
- set_parts_inventory_updated_at — BEFORE UPDATE → public.tg_set_parts_inventory_updated_at()

## Grants
- anon: siud · authenticated: siud (s=select i=insert u=update d=delete)
