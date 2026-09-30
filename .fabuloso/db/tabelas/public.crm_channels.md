# public.crm_channels
> tabela · RLS on · ~<100 linhas

## Colunas
| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| id | uuid | não | `gen_random_uuid()` |  |
| store_id | text | não |  |  |
| name | text | não |  |  |
| phone_number | text | não |  |  |
| api_endpoint | text | sim |  |  |
| api_key | text | sim |  |  |
| is_active | boolean | sim | `true` |  |
| created_at | timestamp with time zone | sim | `now()` |  |
| updated_at | timestamp with time zone | sim | `now()` |  |
| provider | text | não | `'uazapi'::text` |  |
| uaz_subdomain | text | não | `'api'::text` |  |
| webhook_secret | text | sim |  |  |
| instagram_verify_token | text | sim |  |  |
| instagram_ig_user_id | text | sim |  |  |
| instagram_username | text | sim |  |  |
| instagram_access_token | text | sim |  |  |
| use_for_manual | boolean | não | `true` |  |
| use_for_automation | boolean | não | `true` |  |
| inbound_funnel_id | uuid | sim |  |  |
| inbound_funnel_stage | text | sim |  |  |
| uaz_instance_token | text | sim |  |  |
| uaz_admin_token | text | sim |  |  |
| uaz_instance_name | text | sim |  |  |
| uaz_webhook_id | text | sim |  |  |
| uaz_connection_status | text | não | `'unknown'::text` |  |
| uaz_last_status | jsonb | não | `'{}'::jsonb` |  |
| uaz_last_status_at | timestamp with time zone | sim |  |  |
| ai_resume_webhook_url | text | sim |  |  |
| ai_entry_mode | text | não | `'inherit'::text` |  |
| is_admin_console | boolean | não | `false` |  |

## Chaves e restrições
- PK (id)
- FK (inbound_funnel_id) → public.crm_funnels(id) on delete set null
- CHECK chk_crm_channels_ai_entry_mode: `CHECK ((ai_entry_mode = ANY (ARRAY['inherit'::text, 'force_ai'::text, 'force_human'::text])))`
- CHECK crm_channels_provider_check: `CHECK ((provider = ANY (ARRAY['uazapi'::text, 'instagram_official'::text])))`
- CHECK crm_channels_uaz_connection_status_check: `CHECK ((uaz_connection_status = ANY (ARRAY['unknown'::text, 'connecting'::text, 'connected'::text, 'disconnected'::text, 'error'::text])))`
- CHECK crm_channels_uaz_subdomain_check: `CHECK ((uaz_subdomain ~ '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$'::text))`

## Referenciada por
- public.crm_automation_rules.channel_id
- public.crm_broadcast_recipients.channel_id
- public.crm_broadcasts.channel_id
- public.crm_channel_store_links.channel_id
- public.crm_conversations.channel_id
- public.crm_event_log.channel_id
- public.crm_instagram_comment_events.channel_id
- public.crm_instagram_media_snapshots.channel_id
- public.crm_leads.source_channel_id
- public.crm_message_templates.channel_id
- public.crm_uaz_avatar_jobs.channel_id
- public.crm_utm_config.default_channel_id

## Índices
- crm_channels_store_instagram_ig_user_unique: `btree (store_id, instagram_ig_user_id) WHERE ((provider = 'instagram_official'::text) AND (instagram_ig_user_id IS NOT NULL) AND (btrim(ins…` único
- idx_crm_channels_ai_resume_webhook: `btree (store_id) WHERE ((ai_resume_webhook_url IS NOT NULL) AND (btrim(ai_resume_webhook_url) <> ''::text))`
- idx_crm_channels_provider_store: `btree (provider, store_id)`
- idx_crm_channels_store_automation_active: `btree (store_id, provider) WHERE ((is_active = true) AND (use_for_automation = true))`
- idx_crm_channels_store_id: `btree (store_id)`
- idx_crm_channels_store_manual_active: `btree (store_id, provider) WHERE ((is_active = true) AND (use_for_manual = true))`

## Políticas RLS
- "crm_channels_store_scope" — ALL para authenticated · using `(crm_can_access_store(store_id) OR (EXISTS ( SELECT 1 FROM crm_channel_store_links l WHERE ((l.channel_id = crm_channels.id) AND (l.is_active = true) AND crm_can_access_store(l.store_id)))))` · check `crm_can_access_store(store_id)`

## Gatilhos
- trg_crm_channels_set_updated_at — BEFORE UPDATE → public.crm_set_updated_at()

## Grants
- anon: siud · authenticated: siud (s=select i=insert u=update d=delete)
