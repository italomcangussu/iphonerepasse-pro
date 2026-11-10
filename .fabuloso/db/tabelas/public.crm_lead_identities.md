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
| tenant_id | uuid | não |  |  |

## Chaves e restrições
- PK (id)
- FK (lead_id) → public.crm_leads(id) on delete cascade
- FK (tenant_id) → public.tenants(id)
- CHECK chk_crm_lead_identities_type: `CHECK ((identity_type = ANY (ARRAY['phone'::text, 'email'::text, 'instagram_igsid'::text, 'instagram_username'::text])))`

## Índices
- crm_lead_identities_store_type_value_unique: `btree (store_id, identity_type, identity_value_normalized)` único
- crm_lead_identities_tenant_idx: `btree (tenant_id)`
- idx_crm_lead_identities_lead: `btree (lead_id)`

## Políticas RLS
- "crm_lead_identities_store_scope" — ALL para authenticated · using `crm_can_access_store(store_id)` · check `crm_can_access_store(store_id)`
- "tenant_isolation" — ALL para authenticated (restritiva) · using `(tenant_id = ( SELECT current_tenant_id() AS current_tenant_id))` · check `(tenant_id = ( SELECT current_tenant_id() AS current_tenant_id))`

## Gatilhos
- trg_crm_lead_identities_set_updated_at — BEFORE UPDATE → public.crm_set_updated_at()
- zz_tenant_fill — BEFORE INSERT → private.tenant_fill()
- zz_tenant_guard — BEFORE UPDATE OF tenant_id → private.tenant_guard()

## Grants
- anon: siud · authenticated: siud (s=select i=insert u=update d=delete)
