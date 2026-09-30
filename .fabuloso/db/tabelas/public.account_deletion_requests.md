# public.account_deletion_requests
> tabela · RLS on · ~0 linhas

## Colunas
| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| id | uuid | não | `gen_random_uuid()` |  |
| user_id | uuid | não |  |  |
| requested_at | timestamp with time zone | não | `now()` |  |
| scheduled_delete_at | timestamp with time zone | não | `(now() + '30 days'::interval)` |  |
| cancelled_at | timestamp with time zone | sim |  |  |
| completed_at | timestamp with time zone | sim |  |  |
| reason | text | sim |  |  |

## Chaves e restrições
- PK (id)
- FK (user_id) → auth.users(id) on delete cascade
- UNIQUE (user_id)

## Índices
- account_deletion_requests_user_id_key: `btree (user_id)` único
- deletion_requests_scheduled_idx: `btree (scheduled_delete_at) WHERE ((cancelled_at IS NULL) AND (completed_at IS NULL))`

## Políticas RLS
- "deletion_requests_own" — ALL para authenticated · using `(( SELECT auth.uid() AS uid) = user_id)` · check `(( SELECT auth.uid() AS uid) = user_id)`

## Grants
- anon: — · authenticated: siud (s=select i=insert u=update d=delete)
