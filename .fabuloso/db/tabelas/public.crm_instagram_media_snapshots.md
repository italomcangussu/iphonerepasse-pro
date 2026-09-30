# public.crm_instagram_media_snapshots
> tabela · RLS on · ~0 linhas

## Colunas
| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| id | uuid | não | `gen_random_uuid()` |  |
| store_id | text | não |  |  |
| channel_id | uuid | não |  |  |
| media_id | text | não |  |  |
| media_type | text | sim |  |  |
| surface | text | sim |  |  |
| caption | text | sim |  |  |
| permalink | text | sim |  |  |
| media_url | text | sim |  |  |
| thumbnail_url | text | sim |  |  |
| metadata | jsonb | não | `'{}'::jsonb` |  |
| created_at | timestamp with time zone | não | `now()` |  |
| updated_at | timestamp with time zone | não | `now()` |  |

## Chaves e restrições
- PK (id)
- FK (channel_id) → public.crm_channels(id) on delete cascade
- FK (store_id) → public.stores(id) on delete cascade
- UNIQUE (channel_id, media_id)

## Índices
- crm_instagram_media_snapshots_channel_id_media_id_key: `btree (channel_id, media_id)` único

## Políticas RLS
- "crm_ig_media_store_scope" — ALL para authenticated · using `crm_can_access_store(store_id)` · check `crm_can_access_store(store_id)`

## Gatilhos
- trg_crm_ig_media_set_updated_at — BEFORE UPDATE → public.crm_set_updated_at()

## Grants
- anon: siud · authenticated: siud (s=select i=insert u=update d=delete)
