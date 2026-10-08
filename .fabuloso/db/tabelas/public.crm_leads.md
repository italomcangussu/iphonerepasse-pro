# public.crm_leads
> tabela · RLS on · ~<10k linhas

## Colunas
| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| id | text | não |  |  |
| store_id | text | não |  |  |
| customer_id | text | sim |  |  |
| phone | text | não |  |  |
| name | text | sim |  |  |
| email | text | sim |  |  |
| avatar_url | text | sim |  |  |
| avatar_lead_updated | boolean | sim | `false` |  |
| contact_id | text | sim |  |  |
| entity_id | text | sim |  |  |
| source_channel_id | uuid | sim |  |  |
| utm_source | text | sim |  |  |
| utm_campaign | text | sim |  |  |
| utm_medium | text | sim |  |  |
| utm_content | text | sim |  |  |
| utm_term | text | sim |  |  |
| first_message | text | sim |  |  |
| funnel_id | uuid | sim |  |  |
| funnel_stage | text | sim | `'new_lead'::text` |  |
| lifetime_value | numeric | sim | `0` |  |
| is_customer | boolean | sim | `false` |  |
| tags | text[] | sim | `'{}'::text[]` |  |
| intent | text | sim |  |  |
| last_auto_followup_at | timestamp with time zone | sim |  |  |
| first_contact_at | timestamp with time zone | sim | `now()` |  |
| last_message_at | timestamp with time zone | sim |  |  |
| last_interaction_at | timestamp with time zone | sim |  |  |
| created_at | timestamp with time zone | sim | `now()` |  |
| updated_at | timestamp with time zone | sim | `now()` |  |
| phone_normalized | text | sim | `normalize_phone(phone)` | gerada |
| purchase_count | integer | não | `0` |  |
| last_purchase_at | timestamp with time zone | sim |  |  |
| last_order_id | text | sim |  |  |
| last_order_at | timestamp with time zone | sim |  |  |
| last_order_value | numeric | sim |  |  |
| last_order_summary | text | sim |  |  |
| source | text | sim |  |  |
| source_campaign_id | text | sim |  |  |
| source_campaign_title | text | sim |  |  |
| conversation_status | text | sim |  |  |
| attendance_owner | text | sim |  |  |
| handoff_at | timestamp with time zone | sim |  |  |
| human_started_at | timestamp with time zone | sim |  |  |
| last_agent_type | text | sim |  |  |
| summary_operational | text | sim |  |  |
| summary_short | text | sim |  |  |
| last_message_content | text | sim |  |  |
| first_name | text | sim |  |  |
| sales_stage | text | não | `'entrada'::text` |  |
| last_event_name | text | sim |  |  |
| last_event_at | timestamp with time zone | sim |  |  |
| source_ad_context | jsonb | sim |  | Compact snapshot of the Meta/Instagram ad creative the lead arrived from (externalAdReply): { is_from_ad, source, campaign_id, campaign_title, campaign_body, campaign_name, image_url, source_url, product_hint }. Set once on first inbound detection; carried into the AI payload every turn. |
| avatar_last_checked_at | timestamp with time zone | sim |  | Última consulta de avatar concluída no provedor, inclusive quando não havia foto visível. |
| avatar_refreshed_at | timestamp with time zone | sim |  | Último upload bem-sucedido do avatar do lead no Storage do CRM. |
| avatar_storage_path | text | sim |  | Current crm-media object path for lifecycle deletion; never a provider CDN URL. |
| avatar_content_hash | text | sim |  | SHA-256 of the normalized WebP bytes used to skip identical uploads. |
| avatar_missing_count | integer | não | `0` | Consecutive successful UAZAPI checks without a visible profile image. |
| avatar_missing_since | timestamp with time zone | sim |  |  |

## Chaves e restrições
- PK (id)
- FK (source_channel_id) → public.crm_channels(id) on delete set null
- UNIQUE (phone, store_id)
- CHECK chk_crm_leads_attendance_owner: `CHECK (((attendance_owner IS NULL) OR (attendance_owner = ANY (ARRAY['ia'::text, 'humano_loja'::text, 'tecnico_especialista'::text]))))`
- CHECK chk_crm_leads_conversation_status: `CHECK (((conversation_status IS NULL) OR (conversation_status = ANY (ARRAY['em_atendimento_ia'::text, 'em_atendimento_humano'::text, 'transferencia_pendente'::text, 'encerrado'::text]))))`
- CHECK chk_crm_leads_last_agent_type: `CHECK (((last_agent_type IS NULL) OR (last_agent_type = ANY (ARRAY['classifier'::text, 'alana'::text, 'evento'::text, 'humano'::text]))))`
- CHECK chk_crm_leads_sales_stage: `CHECK ((sales_stage = ANY (ARRAY['entrada'::text, 'triagem'::text, 'qualificado'::text, 'cotacao'::text, 'negociacao'::text, 'interesse_confirmado'::text, 'reserva_pendente'::text, 'reservado'::text,…`
- CHECK crm_leads_avatar_missing_count_nonnegative: `CHECK ((avatar_missing_count >= 0))`

## Referenciada por (16)
public.ai_turn_events.lead_id, public.crm_broadcast_recipients.lead_id, public.crm_conversations.lead_id, public.crm_event_log.lead_id, public.crm_follow_up_tracker.lead_id, public.crm_instagram_comment_events.lead_id, public.crm_lead_custom_field_values.lead_id, public.crm_lead_identities.lead_id, public.crm_lead_stage_history.lead_id, public.crm_messages.lead_id, public.crm_meta_ads_attributions.lead_id, public.crm_public_registration_links.lead_id, public.crm_scheduled_messages.lead_id, public.crm_uaz_avatar_jobs.lead_id, public.lead_state.lead_id, public.sales.crm_lead_id

## Índices
- idx_crm_leads_br_phone_match_key: `btree (crm_br_phone_match_key(COALESCE(phone_normalized, phone, id)))`
- idx_crm_leads_is_customer: `btree (store_id, is_customer)`
- idx_crm_leads_last_event_at: `btree (last_event_at DESC NULLS LAST)`
- idx_crm_leads_last_purchase_at: `btree (last_purchase_at DESC NULLS LAST)`
- idx_crm_leads_phone: `btree (phone)`
- idx_crm_leads_source: `btree (source) WHERE (source IS NOT NULL)`
- idx_crm_leads_source_campaign: `btree (source_campaign_id) WHERE (source_campaign_id IS NOT NULL)`
- idx_crm_leads_source_channel_id: `btree (source_channel_id)`
- idx_crm_leads_store: `btree (store_id)`
- idx_crm_leads_store_phone_normalized: `btree (store_id, phone_normalized) WHERE (phone_normalized IS NOT NULL)`
- idx_crm_leads_store_sales_stage: `btree (store_id, sales_stage)`
- unique_lead_per_store: `btree (phone, store_id)` único
- unique_lead_per_store_phone: `btree (store_id, phone_normalized) WHERE (phone_normalized IS NOT NULL)` único

## Políticas RLS
- "crm_leads_store_scope" — ALL para authenticated · using `crm_can_access_store(store_id)` · check `crm_can_access_store(store_id)`

## Gatilhos
- on_lead_created_or_updated — AFTER INSERT OR UPDATE → public.trigger_new_lead_avatar() ⚡ efeito externo
- set_composite_lead_id — BEFORE INSERT → public.generate_composite_lead_id()
- tr_crm_set_default_funnel_fields — BEFORE INSERT → public.crm_set_default_funnel_fields()
- trg_crm_attribute_lead_ad — AFTER INSERT OR UPDATE OF source, source_ad_context, source_campaign_id, source_campaign_title → public.crm_trg_attribute_lead_ad()
- trg_crm_lead_purchase_sync — AFTER INSERT OR UPDATE OF customer_id, phone → public.crm_lead_purchase_sync_trigger()
- trg_crm_leads_set_updated_at — BEFORE UPDATE → public.crm_set_updated_at()
- trg_crm_leads_sync_enriched_columns — BEFORE INSERT OR UPDATE OF name, sales_stage, funnel_stage → public.crm_leads_sync_enriched_columns()

## Grants
- anon: siud · authenticated: siud (s=select i=insert u=update d=delete)
