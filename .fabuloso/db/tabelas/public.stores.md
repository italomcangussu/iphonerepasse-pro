# public.stores
> tabela · RLS on · ~0 linhas

## Colunas
| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| id | text | não |  |  |
| name | text | não |  |  |
| city | text | não |  |  |
| created_at | timestamp with time zone | sim | `now()` |  |
| updated_at | timestamp with time zone | sim | `now()` |  |

## Chaves e restrições
- PK (id)

## Referenciada por
- public.ai_turn_events.store_id
- public.crm_ai_agent_configs.store_id
- public.crm_ai_agent_invocations.store_id
- public.crm_ai_entry_settings.store_id
- public.crm_attendance_scripts.store_id
- public.crm_automation_rules.store_id
- public.crm_broadcasts.store_id
- public.crm_channel_store_links.store_id
- public.crm_custom_fields.store_id
- public.crm_instagram_comment_events.store_id
- public.crm_instagram_media_snapshots.store_id
- public.crm_lead_custom_field_values.store_id
- public.crm_message_templates.store_id
- public.crm_meta_ads_attributions.store_id
- public.crm_meta_ads_groups.store_id
- public.crm_public_registration_links.store_id
- public.crm_uaz_avatar_jobs.store_id
- public.crm_utm_config.store_id
- public.push_subscriptions.store_id
- public.sales.store_id
- public.sellers.store_id
- public.stock_items.store_id

## Políticas RLS
- "stores_delete" — DELETE para authenticated · using `(( SELECT "current_role"() AS "current_role") = 'admin'::text)`
- "stores_insert" — INSERT para authenticated · check `(( SELECT "current_role"() AS "current_role") = 'admin'::text)`
- "stores_select" — SELECT para authenticated · using `(( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text]))`
- "stores_update" — UPDATE para authenticated · using `(( SELECT "current_role"() AS "current_role") = 'admin'::text)` · check `(( SELECT "current_role"() AS "current_role") = 'admin'::text)`

## Grants
- anon: siud · authenticated: siud (s=select i=insert u=update d=delete)
