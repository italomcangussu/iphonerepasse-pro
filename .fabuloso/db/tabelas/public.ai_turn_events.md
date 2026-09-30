# public.ai_turn_events
> tabela · RLS on · ~0 linhas

## Colunas
| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| id | uuid | não | `gen_random_uuid()` |  |
| turn_id | text | não |  |  |
| conversation_id | uuid | sim |  |  |
| lead_id | text | não |  |  |
| store_id | text | não |  |  |
| action | text | não |  |  |
| outcome | text | sim |  |  |
| duration_ms | integer | sim |  |  |
| stage_timings | jsonb | não | `'{}'::jsonb` |  |
| metadata | jsonb | não | `'{}'::jsonb` |  |
| created_at | timestamp with time zone | não | `now()` |  |

## Chaves e restrições
- PK (id)
- FK (conversation_id) → public.crm_conversations(id) on delete set null
- FK (lead_id) → public.crm_leads(id) on delete cascade
- FK (store_id) → public.stores(id) on delete cascade
- UNIQUE (turn_id, action)
- CHECK ai_turn_events_duration_ms_check: `CHECK (((duration_ms IS NULL) OR (duration_ms >= 0)))`

## Índices
- ai_turn_events_turn_id_action_key: `btree (turn_id, action)` único
- idx_ai_turn_events_conversation_created: `btree (conversation_id, created_at DESC) WHERE (conversation_id IS NOT NULL)`
- idx_ai_turn_events_lead_created: `btree (lead_id, created_at DESC)`

## Políticas RLS
- "ai_turn_events_store_scope_select" — SELECT para authenticated · using `crm_can_access_store(store_id)`

## Grants
- anon: siud · authenticated: siud (s=select i=insert u=update d=delete)
