# public.device_catalog
> tabela · RLS on · ~<100 linhas

## Colunas
| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| id | text | não |  |  |
| type | text | não |  |  |
| model | text | não |  |  |
| color | text | não | `''::text` |  |
| created_by | uuid | sim | `auth.uid()` |  |
| created_at | timestamp with time zone | não | `now()` |  |
| updated_at | timestamp with time zone | não | `now()` |  |

## Chaves e restrições
- PK (id)
- FK (created_by) → auth.users(id) on delete set null
- UNIQUE (type, model, color)
- CHECK device_catalog_model_check: `CHECK ((char_length(TRIM(BOTH FROM model)) > 0))`
- CHECK device_catalog_type_check: `CHECK ((type = ANY (ARRAY['iPhone'::text, 'iPad'::text, 'Macbook'::text, 'Apple Watch'::text, 'Acessório'::text])))`

## Índices
- device_catalog_type_model_color_key: `btree (type, model, color)` único
- device_catalog_type_model_idx: `btree (type, model)`

## Políticas RLS
- "device_catalog_delete" — DELETE para authenticated · using `(( SELECT "current_role"() AS "current_role") = 'admin'::text)`
- "device_catalog_insert" — INSERT para authenticated · check `(( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text]))`
- "device_catalog_select" — SELECT para authenticated · using `(( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text]))`
- "device_catalog_update" — UPDATE para authenticated · using `(( SELECT "current_role"() AS "current_role") = 'admin'::text)` · check `(( SELECT "current_role"() AS "current_role") = 'admin'::text)`

## Gatilhos
- set_device_catalog_updated_at — BEFORE UPDATE → public.tg_set_device_catalog_updated_at()

## Grants
- anon: siud · authenticated: siud (s=select i=insert u=update d=delete)
