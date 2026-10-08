# public.crm_meta_ads_groups
> tabela · RLS on · ~<100 linhas

## Colunas
| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| id | uuid | não | `gen_random_uuid()` |  |
| store_id | text | não |  |  |
| group_key | uuid | não | `gen_random_uuid()` |  |
| creative_signature | text | não |  |  |
| source_app | text | não | `'instagram'::text` |  |
| auto_name | text | sim |  |  |
| status | text | não | `'pending_review'::text` |  |
| sample_title | text | sim |  |  |
| sample_body | text | sim |  |  |
| sample_media_url | text | sim |  |  |
| sample_source_url | text | sim |  |  |
| sample_thumbnail_url | text | sim |  |  |
| first_seen_at | timestamp with time zone | sim |  |  |
| last_seen_at | timestamp with time zone | sim |  |  |
| total_attributions | integer | não | `0` |  |
| metrics | jsonb | não | `'{}'::jsonb` |  |
| created_at | timestamp with time zone | não | `now()` |  |
| updated_at | timestamp with time zone | não | `now()` |  |

## Chaves e restrições
- PK (id)
- FK (store_id) → public.stores(id) on delete cascade
- UNIQUE (group_key)
- UNIQUE (store_id, creative_signature)
- CHECK chk_crm_meta_ads_source_app: `CHECK ((source_app = ANY (ARRAY['instagram'::text, 'facebook'::text])))`
- CHECK chk_crm_meta_ads_status: `CHECK ((status = ANY (ARRAY['pending_review'::text, 'approved'::text, 'ignored'::text, 'merged'::text])))`

## Referenciada por (1)
public.crm_meta_ads_attributions.group_key

## Índices
- crm_meta_ads_groups_group_key_key: `btree (group_key)` único
- crm_meta_ads_groups_store_id_creative_signature_key: `btree (store_id, creative_signature)` único
- idx_crm_meta_ads_groups_store_status: `btree (store_id, status, last_seen_at DESC NULLS LAST)`

## Políticas RLS
- "crm_meta_ads_groups_store_scope" — ALL para authenticated · using `crm_can_access_store(store_id)` · check `crm_can_access_store(store_id)`

## Gatilhos
- trg_crm_meta_ads_groups_set_updated_at — BEFORE UPDATE → public.crm_set_updated_at()

## Grants
- anon: siud · authenticated: siud (s=select i=insert u=update d=delete)
