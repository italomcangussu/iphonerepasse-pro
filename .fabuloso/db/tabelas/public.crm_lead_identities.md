# public.crm_lead_identities
> tabela · RLS on · ~0 linhas

## Colunas
| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| id | uuid | não | `gen_random_uuid()` |  |
| lead_id | text | não |  |  |
| store_id | text | não |  |  |
| identity_type | text | não |  |  |
| identity_value | text | não |  |  |
| identity_value_normalized | text | sim | `lower(btrim(identity_value))` | gerada |
| is_primary | boolean | não | `false` |  |
| metadata | jsonb | não | `'{}'::jsonb` |  |
| created_at | timestamp with time zone | não | `now()` |  |
| updated_at | timestamp with time zone | não | `now()` |  |

## Chaves e restrições
- PK (id)
- FK (lead_id) → public.crm_leads(id) on delete cascade
- CHECK chk_crm_lead_identities_type: `CHECK ((identity_type = ANY (ARRAY['phone'::text, 'email'::text, 'instagram_igsid'::text, 'instagram_username'::text])))`

## Índices
- crm_lead_identities_store_type_value_unique: `btree (store_id, identity_type, identity_value_normalized)` único
- idx_crm_lead_identities_lead: `btree (lead_id)`

## Políticas RLS
- "crm_lead_identities_store_scope" — ALL para authenticated · using `crm_can_access_store(store_id)` · check `crm_can_access_store(store_id)`

## Gatilhos
- trg_crm_lead_identities_set_updated_at — BEFORE UPDATE → public.crm_set_updated_at()

## Grants
- anon: siud · authenticated: siud (s=select i=insert u=update d=delete)
