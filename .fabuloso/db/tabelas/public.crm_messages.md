# public.crm_messages
> tabela · RLS on · ~<100k linhas

## Colunas
| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| id | uuid | não | `gen_random_uuid()` |  |
| conversation_id | uuid | não |  |  |
| store_id | text | sim |  |  |
| channel_id | uuid | sim |  |  |
| direction | text | não |  |  |
| sender_type | text | não |  |  |
| content | text | sim |  |  |
| media_url | text | sim |  |  |
| media_type | text | sim |  |  |
| external_id | text | sim |  |  |
| webhook_payload | jsonb | sim |  |  |
| status | text | sim | `'pending'::text` |  |
| error_message | text | sim |  |  |
| sent_at | timestamp with time zone | sim |  |  |
| delivered_at | timestamp with time zone | sim |  |  |
| read_at | timestamp with time zone | sim |  |  |
| created_at | timestamp with time zone | sim | `now()` |  |
| lead_id | text | sim |  |  |
| provider_message_id | text | sim |  |  |
| event_origin | text | sim |  |  |
| provider_error | jsonb | sim |  |  |
| reply_to_provider_message_id | text | sim |  |  |
| reply_preview_text | text | sim |  |  |
| reaction_target_provider_message_id | text | sim |  |  |
| reaction_emoji | text | sim |  |  |
| sender_user_id | uuid | sim |  |  |
| sender_display_name | text | sim |  |  |

## Chaves e restrições
- PK (id)
- FK (conversation_id) → public.crm_conversations(id) on delete cascade
- FK (lead_id) → public.crm_leads(id) on delete set null
- FK (sender_user_id) → auth.users(id) on delete set null
- CHECK crm_messages_sender_type_check: `CHECK ((sender_type = ANY (ARRAY['customer'::text, 'human'::text, 'ai'::text, 'ai_inbound'::text, 'system'::text])))`

## Referenciada por (2)
public.crm_instagram_comment_events.source_message_id, public.crm_meta_ads_attributions.message_id

## Índices
- crm_messages_channel_provider_message_unique: `btree (channel_id, provider_message_id) WHERE (provider_message_id IS NOT NULL)` único
- idx_crm_messages_channel_provider_lookup: `btree (channel_id, provider_message_id) WHERE (provider_message_id IS NOT NULL)`
- idx_crm_messages_content_fts: `gin (to_tsvector('portuguese'::regconfig, COALESCE(content, ''::text)))`
- idx_crm_messages_conversation: `btree (conversation_id)`
- idx_crm_messages_conversation_created: `btree (conversation_id, created_at)`
- idx_crm_messages_lead_outbound_created: `btree (lead_id, created_at DESC) WHERE ((direction = 'outbound'::text) AND (sender_type = ANY (ARRAY['human'::text, 'ai'::text, 'ai_inbound…`
- idx_crm_messages_reaction_provider_target: `btree (conversation_id, reaction_target_provider_message_id) WHERE (reaction_target_provider_message_id IS NOT NULL)`
- idx_crm_messages_reply_provider_target: `btree (conversation_id, reply_to_provider_message_id) WHERE (reply_to_provider_message_id IS NOT NULL)`
- idx_crm_messages_sender_user: `btree (sender_user_id) WHERE (sender_user_id IS NOT NULL)`
- idx_crm_messages_store_created: `btree (store_id, created_at DESC)`

## Políticas RLS
- "crm_messages_store_scope" — ALL para authenticated · using `crm_can_access_store(store_id)` · check `crm_can_access_store(store_id)`

## Gatilhos
- trg_crm_messages_after_insert — AFTER INSERT → public.crm_after_message_insert()
- trg_crm_messages_sync_lead_last_message_content — AFTER INSERT → public.crm_messages_sync_lead_last_message_content()
- trg_crm_messages_sync_store — BEFORE INSERT OR UPDATE OF conversation_id → public.crm_sync_lead_store_to_related_tables()

## Grants
- anon: siud · authenticated: siud (s=select i=insert u=update d=delete)
