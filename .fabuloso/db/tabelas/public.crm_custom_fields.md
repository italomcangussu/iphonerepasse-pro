# public.crm_custom_fields
> tabela · RLS on · ~0 linhas

## Colunas
| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| id | uuid | não | `gen_random_uuid()` |  |
| store_id | text | não |  |  |
| key | text | não |  |  |
| label | text | não |  |  |
| field_type | text | não | `'text'::text` |  |
| options | jsonb | não | `'{}'::jsonb` |  |
| is_required | boolean | não | `false` |  |
| is_active | boolean | não | `true` |  |
| created_at | timestamp with time zone | não | `now()` |  |
| updated_at | timestamp with time zone | não | `now()` |  |

## Chaves e restrições
- PK (id)
- FK (store_id) → public.stores(id) on delete cascade
- UNIQUE (store_id, key)
- CHECK chk_crm_custom_fields_type: `CHECK ((field_type = ANY (ARRAY['text'::text, 'number'::text, 'boolean'::text, 'date'::text, 'select'::text, 'json'::text])))`

## Referenciada por (1)
public.crm_lead_custom_field_values.field_id

## Índices
- crm_custom_fields_store_id_key_key: `btree (store_id, key)` único
- idx_crm_custom_fields_store_active: `btree (store_id, is_active)`

## Políticas RLS
- "crm_custom_fields_store_scope" — ALL para authenticated · using `crm_can_access_store(store_id)` · check `crm_can_access_store(store_id)`

## Gatilhos
- trg_crm_custom_fields_set_updated_at — BEFORE UPDATE → public.crm_set_updated_at()

## Grants
- anon: siud · authenticated: siud (s=select i=insert u=update d=delete)
