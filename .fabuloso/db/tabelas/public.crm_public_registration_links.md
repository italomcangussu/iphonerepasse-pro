# public.crm_public_registration_links
> tabela · RLS on · ~0 linhas

## Colunas
| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| id | uuid | não | `gen_random_uuid()` |  |
| store_id | text | não |  |  |
| lead_id | text | não |  |  |
| token | text | não |  |  |
| slug | text | não |  |  |
| utm_source | text | sim |  |  |
| utm_campaign | text | sim |  |  |
| is_active | boolean | não | `true` |  |
| expires_at | timestamp with time zone | sim |  |  |
| metadata | jsonb | não | `'{}'::jsonb` |  |
| created_at | timestamp with time zone | não | `now()` |  |
| updated_at | timestamp with time zone | não | `now()` |  |

## Chaves e restrições
- PK (id)
- FK (lead_id) → public.crm_leads(id) on delete cascade
- FK (store_id) → public.stores(id) on delete cascade
- UNIQUE (token)

## Índices
- crm_public_registration_links_token_key: `btree (token)` único
- idx_crm_public_reg_links_store_lead_created: `btree (store_id, lead_id, created_at DESC)`

## Políticas RLS
- "crm_public_reg_links_store_scope" — ALL para authenticated · using `crm_can_access_store(store_id)` · check `crm_can_access_store(store_id)`

## Gatilhos
- trg_crm_public_reg_links_set_updated_at — BEFORE UPDATE → public.crm_set_updated_at()

## Grants
- anon: siud · authenticated: siud (s=select i=insert u=update d=delete)
