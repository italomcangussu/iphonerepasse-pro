# public.crm_scheduled_messages
> tabela · RLS on · ~0 linhas

## Colunas
| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| id | uuid | não | `gen_random_uuid()` |  |
| lead_id | text | não |  |  |
| conversation_id | uuid | sim |  |  |
| automation_rule_id | uuid | sim |  |  |
| channel_id | uuid | sim |  |  |
| message_content | text | sim |  |  |
| media_url | text | sim |  |  |
| media_type | text | sim |  |  |
| scheduled_for | timestamp with time zone | não |  |  |
| status | text | sim | `'pending'::text` |  |
| error_message | text | sim |  |  |
| retry_count | integer | sim | `0` |  |
| sent_at | timestamp with time zone | sim |  |  |
| message_id | text | sim |  |  |
| created_at | timestamp with time zone | sim | `now()` |  |
| store_id | text | sim |  |  |
| metadata | jsonb | sim | `'{}'::jsonb` |  |
| updated_at | timestamp with time zone | sim | `now()` |  |

## Chaves e restrições
- PK (id)
- FK (conversation_id) → public.crm_conversations(id) on delete cascade
- FK (lead_id) → public.crm_leads(id) on delete cascade

## Índices
- idx_crm_scheduled_messages_pending: `btree (scheduled_for) WHERE (status = ANY (ARRAY['pending'::text, 'scheduled'::text]))`

## Políticas RLS
- "crm_scheduled_messages_store_scope" — ALL para authenticated · using `crm_can_access_store(store_id)` · check `crm_can_access_store(store_id)`

## Gatilhos
- trg_crm_scheduled_messages_set_updated_at — BEFORE UPDATE → public.crm_set_updated_at()
- trg_crm_scheduled_sync_store — BEFORE INSERT OR UPDATE OF lead_id → public.crm_sync_lead_store_to_related_tables()

## Grants
- anon: siud · authenticated: siud (s=select i=insert u=update d=delete)
