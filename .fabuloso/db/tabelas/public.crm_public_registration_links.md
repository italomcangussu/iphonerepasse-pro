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
| tenant_id | uuid | não |  |  |

## Chaves e restrições
- PK (id)
- FK (lead_id) → public.crm_leads(id) on delete cascade
- FK (store_id) → public.stores(id) on delete cascade
- FK (tenant_id) → public.tenants(id)
- UNIQUE (token)

## Índices
- crm_public_registration_links_tenant_idx: `btree (tenant_id)`
- crm_public_registration_links_token_key: `btree (token)` único
- idx_crm_public_reg_links_store_lead_created: `btree (store_id, lead_id, created_at DESC)`

## Políticas RLS
- "crm_public_reg_links_store_scope" — ALL para authenticated · using `crm_can_access_store(store_id)` · check `crm_can_access_store(store_id)`
- "tenant_isolation" — ALL para authenticated (restritiva) · using `(tenant_id = ( SELECT current_tenant_id() AS current_tenant_id))` · check `(tenant_id = ( SELECT current_tenant_id() AS current_tenant_id))`

## Gatilhos
- trg_crm_public_reg_links_set_updated_at — BEFORE UPDATE → public.crm_set_updated_at()
- zz_tenant_fill — BEFORE INSERT → private.tenant_fill()
- zz_tenant_guard — BEFORE UPDATE OF tenant_id → private.tenant_guard()

## Grants
- anon: siud · authenticated: siud (s=select i=insert u=update d=delete)
