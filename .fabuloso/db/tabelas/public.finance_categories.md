# public.finance_categories
> tabela · RLS on · ~<100 linhas

## Colunas
| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| id | text | não |  |  |
| name | text | não |  |  |
| type | text | não |  |  |
| is_default | boolean | não | `false` |  |
| created_at | timestamp with time zone | não | `now()` |  |
| updated_at | timestamp with time zone | não | `now()` |  |

## Chaves e restrições
- PK (id)
- CHECK finance_categories_type_check: `CHECK ((type = ANY (ARRAY['IN'::text, 'OUT'::text])))`

## Políticas RLS
- "finance_categories_delete" — DELETE para authenticated · using `( SELECT has_app_permission('finance'::text, 'deletable'::text) AS has_app_permission)`
- "finance_categories_insert" — INSERT para authenticated · check `( SELECT has_app_permission('finance'::text, 'editable'::text) AS has_app_permission)`
- "finance_categories_select" — SELECT para authenticated · using `true`
- "finance_categories_update" — UPDATE para authenticated · using `( SELECT has_app_permission('finance'::text, 'editable'::text) AS has_app_permission)` · check `( SELECT has_app_permission('finance'::text, 'editable'::text) AS has_app_permission)`

## Gatilhos
- set_finance_categories_updated_at — BEFORE UPDATE → public.tg_set_finance_categories_updated_at()

## Grants
- anon: siud · authenticated: siud (s=select i=insert u=update d=delete)
