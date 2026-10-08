# public.crm_conversations
> tabela · RLS on · ~<10k linhas

## Colunas
| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| id | uuid | não | `gen_random_uuid()` |  |
| store_id | text | não |  |  |
| lead_id | text | não |  |  |
| channel_id | uuid | sim |  |  |
| talk_id | text | sim |  |  |
| status | text | sim | `'open'::text` |  |
| assigned_to | uuid | sim |  |  |
| ai_enabled | boolean | sim | `true` |  |
| unread_count | integer | sim | `0` |  |
| message_count | integer | sim | `0` |  |
| last_message_at | timestamp with time zone | sim |  |  |
| last_customer_message_at | timestamp with time zone | sim |  |  |
| last_response_at | timestamp with time zone | sim |  |  |
| created_at | timestamp with time zone | sim | `now()` |  |
| updated_at | timestamp with time zone | sim | `now()` |  |
| is_group | boolean | não | `false` |  |
| group_name | text | sim |  |  |
| group_avatar_url | text | sim |  |  |

## Chaves e restrições
- PK (id)
- FK (channel_id) → public.crm_channels(id) on delete set null
- FK (lead_id) → public.crm_leads(id) on delete cascade

## Referenciada por (7)
public.ai_turn_events.conversation_id, public.crm_broadcast_recipients.conversation_id, public.crm_event_log.conversation_id, public.crm_instagram_comment_events.conversation_id, public.crm_messages.conversation_id, public.crm_scheduled_messages.conversation_id, public.crm_uaz_avatar_jobs.conversation_id

## Índices
- idx_crm_conversations_channel_last: `btree (channel_id, last_message_at DESC NULLS LAST) WHERE (channel_id IS NOT NULL)`
- idx_crm_conversations_group: `btree (store_id, is_group, last_message_at DESC NULLS LAST) WHERE (is_group = true)`
- idx_crm_conversations_lead: `btree (lead_id)`
- idx_crm_conversations_store: `btree (store_id)`
- idx_crm_conversations_store_status_last: `btree (store_id, status, last_message_at DESC NULLS LAST)`
- unique_crm_conversations_store_lead: `btree (store_id, lead_id)` único

## Políticas RLS
- "crm_conversations_store_scope" — ALL para authenticated · using `crm_can_access_store(store_id)` · check `crm_can_access_store(store_id)`

## Gatilhos
- trg_crm_conversations_set_updated_at — BEFORE UPDATE → public.crm_set_updated_at()
- trg_crm_conversations_sync_store — BEFORE INSERT OR UPDATE OF lead_id → public.crm_sync_lead_store_to_related_tables()
- trg_crm_sync_lead_attendance_from_conversation — AFTER INSERT OR UPDATE OF status, ai_enabled → public.crm_sync_lead_attendance_from_conversation()

## Grants
- anon: siud · authenticated: siud (s=select i=insert u=update d=delete)
