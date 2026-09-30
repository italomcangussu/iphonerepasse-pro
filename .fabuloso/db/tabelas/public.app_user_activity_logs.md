# public.app_user_activity_logs
> tabela · RLS on · ~<100k linhas

## Colunas
| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| id | bigint | não | `nextval('app_user_activity_logs_id_seq'::regclass)` |  |
| user_id | uuid | não |  |  |
| user_email | text | sim |  |  |
| app_role | text | não |  |  |
| category | text | não |  |  |
| action | text | não |  |  |
| screen | text | sim |  |  |
| metadata | jsonb | não | `'{}'::jsonb` |  |
| occurred_at | timestamp with time zone | não | `now()` |  |

## Chaves e restrições
- PK (id)
- FK (user_id) → auth.users(id) on delete cascade
- CHECK app_user_activity_logs_app_role_check: `CHECK ((app_role = ANY (ARRAY['admin'::text, 'manager'::text, 'seller'::text])))`

## Índices
- idx_app_user_activity_logs_category_date: `btree (category, occurred_at DESC)`
- idx_app_user_activity_logs_user_date: `btree (user_id, occurred_at DESC)`

## Políticas RLS
- "app_user_activity_logs_select" — SELECT para authenticated · using `((( SELECT "current_role"() AS "current_role") = 'admin'::text) OR (( SELECT auth.uid() AS uid) = user_id))`
- "app_user_activity_logs_self_insert" — INSERT para authenticated · check `(( SELECT auth.uid() AS uid) = user_id)`

## Grants
- anon: siud · authenticated: siud (s=select i=insert u=update d=delete)
