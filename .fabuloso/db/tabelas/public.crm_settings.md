# public.crm_settings
> tabela · RLS on · ~0 linhas

## Colunas
| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| id | text | não | `'centralized_service'::text` |  |
| value_bool | boolean | não | `false` |  |
| updated_at | timestamp with time zone | não | `now()` |  |
| value_text | text | sim |  |  |

## Chaves e restrições
- PK (id)

## Políticas RLS
- "crm_settings_delete" — DELETE para authenticated · using `(( SELECT "current_role"() AS "current_role") = 'admin'::text)`
- "crm_settings_insert" — INSERT para authenticated · check `(( SELECT "current_role"() AS "current_role") = 'admin'::text)`
- "crm_settings_select" — SELECT para authenticated · using `true`
- "crm_settings_update" — UPDATE para authenticated · using `(( SELECT "current_role"() AS "current_role") = 'admin'::text)` · check `(( SELECT "current_role"() AS "current_role") = 'admin'::text)`

## Grants
- anon: siud · authenticated: siud (s=select i=insert u=update d=delete)
