# public.crm_utm_config
> tabela · RLS on · ~0 linhas

## Colunas
| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| id | uuid | não | `gen_random_uuid()` |  |
| store_id | text | não |  |  |
| source_key | text | não |  |  |
| campaign_key | text | não |  |  |
| medium_key | text | sim |  |  |
| default_channel_id | uuid | sim |  |  |
| is_active | boolean | não | `true` |  |
| created_at | timestamp with time zone | não | `now()` |  |
| updated_at | timestamp with time zone | não | `now()` |  |

## Chaves e restrições
- PK (id)
- FK (default_channel_id) → public.crm_channels(id) on delete set null
- FK (store_id) → public.stores(id) on delete cascade
- UNIQUE (store_id, source_key, campaign_key)

## Índices
- crm_utm_config_store_id_source_key_campaign_key_key: `btree (store_id, source_key, campaign_key)` único
- idx_crm_utm_config_store_active: `btree (store_id, is_active)`

## Políticas RLS
- "crm_utm_config_store_scope" — ALL para authenticated · using `crm_can_access_store(store_id)` · check `crm_can_access_store(store_id)`

## Gatilhos
- trg_crm_utm_config_set_updated_at — BEFORE UPDATE → public.crm_set_updated_at()

## Grants
- anon: siud · authenticated: siud (s=select i=insert u=update d=delete)
