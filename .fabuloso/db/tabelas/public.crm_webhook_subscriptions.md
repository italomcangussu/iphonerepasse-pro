# public.crm_webhook_subscriptions
> tabela · RLS on · ~0 linhas

## Colunas
| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| id | uuid | não | `gen_random_uuid()` |  |
| store_id | text | sim |  |  |
| name | text | não |  |  |
| url | text | não |  |  |
| secret | text | sim |  |  |
| subscribed_events | text[] | não | `'{}'::text[]` |  |
| is_active | boolean | não | `true` |  |
| failure_count | integer | não | `0` |  |
| last_success_at | timestamp with time zone | sim |  |  |
| last_error_at | timestamp with time zone | sim |  |  |
| last_error_message | text | sim |  |  |
| created_at | timestamp with time zone | não | `now()` |  |
| updated_at | timestamp with time zone | não | `now()` |  |

## Chaves e restrições
- PK (id)

## Referenciada por
- public.crm_event_log.subscription_id

## Índices
- idx_crm_webhook_subscriptions_store: `btree (store_id, is_active)`

## Políticas RLS
- "crm_webhook_subscriptions_store_scope" — ALL para authenticated · using `((store_id IS NULL) OR crm_can_access_store(store_id))` · check `((store_id IS NULL) OR crm_can_access_store(store_id))`

## Gatilhos
- trg_crm_webhook_subscriptions_set_updated_at — BEFORE UPDATE → public.crm_set_updated_at()

## Grants
- anon: siud · authenticated: siud (s=select i=insert u=update d=delete)
