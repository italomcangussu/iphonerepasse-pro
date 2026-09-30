# public.crm_lead_custom_field_values
> tabela · RLS on · ~0 linhas

## Colunas
| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| id | uuid | não | `gen_random_uuid()` |  |
| store_id | text | não |  |  |
| lead_id | text | não |  |  |
| field_id | uuid | não |  |  |
| value | jsonb | não |  |  |
| created_at | timestamp with time zone | não | `now()` |  |
| updated_at | timestamp with time zone | não | `now()` |  |

## Chaves e restrições
- PK (id)
- FK (field_id) → public.crm_custom_fields(id) on delete cascade
- FK (lead_id) → public.crm_leads(id) on delete cascade
- FK (store_id) → public.stores(id) on delete cascade
- UNIQUE (lead_id, field_id)

## Índices
- crm_lead_custom_field_values_lead_id_field_id_key: `btree (lead_id, field_id)` único
- idx_crm_custom_values_lead: `btree (lead_id)`

## Políticas RLS
- "crm_custom_values_store_scope" — ALL para authenticated · using `crm_can_access_store(store_id)` · check `crm_can_access_store(store_id)`

## Gatilhos
- trg_crm_custom_values_set_updated_at — BEFORE UPDATE → public.crm_set_updated_at()

## Grants
- anon: siud · authenticated: siud (s=select i=insert u=update d=delete)
