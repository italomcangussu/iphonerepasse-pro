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
| tenant_id | uuid | não |  |  |

## Chaves e restrições
- PK (id)
- FK (store_id) → public.stores(id) on delete cascade
- FK (tenant_id) → public.tenants(id)
- UNIQUE (store_id, key)
- CHECK chk_crm_custom_fields_type: `CHECK ((field_type = ANY (ARRAY['text'::text, 'number'::text, 'boolean'::text, 'date'::text, 'select'::text, 'json'::text])))`

## Referenciada por (1)
public.crm_lead_custom_field_values.field_id

## Índices
- crm_custom_fields_store_id_key_key: `btree (store_id, key)` único
- crm_custom_fields_tenant_idx: `btree (tenant_id)`
- idx_crm_custom_fields_store_active: `btree (store_id, is_active)`

## Políticas RLS
- "crm_custom_fields_store_scope" — ALL para authenticated · using `crm_can_access_store(store_id)` · check `crm_can_access_store(store_id)`
- "tenant_isolation" — ALL para authenticated (restritiva) · using `(tenant_id = ( SELECT current_tenant_id() AS current_tenant_id))` · check `(tenant_id = ( SELECT current_tenant_id() AS current_tenant_id))`

## Gatilhos
- trg_crm_custom_fields_set_updated_at — BEFORE UPDATE → public.crm_set_updated_at()
- zz_tenant_fill — BEFORE INSERT → private.tenant_fill()
- zz_tenant_guard — BEFORE UPDATE OF tenant_id → private.tenant_guard()

## Grants
- anon: siud · authenticated: siud (s=select i=insert u=update d=delete)
