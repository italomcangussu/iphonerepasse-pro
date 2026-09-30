# public.crm_instagram_comment_events
> tabela · RLS on · ~0 linhas

## Colunas
| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| id | uuid | não | `gen_random_uuid()` |  |
| store_id | text | não |  |  |
| channel_id | uuid | não |  |  |
| lead_id | text | sim |  |  |
| conversation_id | uuid | sim |  |  |
| source_message_id | uuid | sim |  |  |
| comment_id | text | não |  |  |
| parent_comment_id | text | sim |  |  |
| media_id | text | sim |  |  |
| media_surface | text | sim |  |  |
| actor_igscoped_id | text | sim |  |  |
| actor_username | text | sim |  |  |
| direction | text | não | `'inbound'::text` |  |
| event_type | text | não | `'comment'::text` |  |
| reply_mode | text | sim |  |  |
| status | text | não | `'received'::text` |  |
| content | text | sim |  |  |
| provider_message_id | text | sim |  |  |
| external_id | text | sim |  |  |
| webhook_payload | jsonb | sim |  |  |
| metadata | jsonb | não | `'{}'::jsonb` |  |
| provider_error | jsonb | sim |  |  |
| event_created_at | timestamp with time zone | sim |  |  |
| created_at | timestamp with time zone | não | `now()` |  |
| updated_at | timestamp with time zone | não | `now()` |  |

## Chaves e restrições
- PK (id)
- FK (channel_id) → public.crm_channels(id) on delete cascade
- FK (conversation_id) → public.crm_conversations(id) on delete set null
- FK (lead_id) → public.crm_leads(id) on delete set null
- FK (source_message_id) → public.crm_messages(id) on delete set null
- FK (store_id) → public.stores(id) on delete cascade
- CHECK chk_crm_instagram_comment_direction: `CHECK ((direction = ANY (ARRAY['inbound'::text, 'outbound'::text])))`
- CHECK chk_crm_instagram_comment_status: `CHECK ((status = ANY (ARRAY['received'::text, 'queued'::text, 'replied'::text, 'failed'::text])))`

## Índices
- idx_crm_ig_comment_events_store_created: `btree (store_id, event_created_at DESC NULLS LAST)`

## Políticas RLS
- "crm_ig_comments_store_scope" — ALL para authenticated · using `crm_can_access_store(store_id)` · check `crm_can_access_store(store_id)`

## Gatilhos
- trg_crm_ig_comments_set_updated_at — BEFORE UPDATE → public.crm_set_updated_at()

## Grants
- anon: siud · authenticated: siud (s=select i=insert u=update d=delete)
