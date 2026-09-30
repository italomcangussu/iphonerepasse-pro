# public.crm_meta_ads_attributions
> tabela · RLS on · ~<1k linhas

## Colunas
| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| id | uuid | não | `gen_random_uuid()` |  |
| store_id | text | não |  |  |
| lead_id | text | sim |  |  |
| message_id | uuid | sim |  |  |
| group_key | uuid | não |  |  |
| source_app | text | não | `'instagram'::text` |  |
| raw_source_id | text | sim |  |  |
| detected_at | timestamp with time zone | não | `now()` |  |
| metadata | jsonb | não | `'{}'::jsonb` |  |
| created_at | timestamp with time zone | não | `now()` |  |

## Chaves e restrições
- PK (id)
- FK (group_key) → public.crm_meta_ads_groups(group_key) on delete cascade
- FK (lead_id) → public.crm_leads(id) on delete set null
- FK (message_id) → public.crm_messages(id) on delete set null
- FK (store_id) → public.stores(id) on delete cascade
- UNIQUE (message_id)
- CHECK chk_crm_meta_ads_attr_source_app: `CHECK ((source_app = ANY (ARRAY['instagram'::text, 'facebook'::text])))`

## Índices
- crm_meta_ads_attributions_message_id_key: `btree (message_id)` único
- idx_crm_meta_ads_attr_store_group: `btree (store_id, group_key, detected_at DESC)`

## Políticas RLS
- "crm_meta_ads_attr_store_scope" — ALL para authenticated · using `crm_can_access_store(store_id)` · check `crm_can_access_store(store_id)`

## Grants
- anon: siud · authenticated: siud (s=select i=insert u=update d=delete)
