# public.crm_uaz_avatar_jobs
> tabela · RLS on · ~<10k linhas — Durable, coalesced UAZAPI lead avatar work. Browser roles have no access.

## Colunas
| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| id | uuid | não | `gen_random_uuid()` |  |
| store_id | text | não |  |  |
| lead_id | text | não |  |  |
| channel_id | uuid | não |  |  |
| conversation_id | uuid | sim |  |  |
| talk_id | text | não |  |  |
| status | text | não | `'pending'::text` |  |
| attempts | integer | não | `0` |  |
| force_refresh | boolean | não | `false` |  |
| available_at | timestamp with time zone | não | `now()` |  |
| lease_expires_at | timestamp with time zone | sim |  |  |
| last_error_code | text | sim |  |  |
| created_at | timestamp with time zone | não | `now()` |  |
| updated_at | timestamp with time zone | não | `now()` |  |
| tenant_id | uuid | não |  |  |

## Chaves e restrições
- PK (id)
- FK (channel_id) → public.crm_channels(id) on delete cascade
- FK (conversation_id) → public.crm_conversations(id) on delete set null
- FK (lead_id) → public.crm_leads(id) on delete cascade
- FK (store_id) → public.stores(id) on delete cascade
- FK (tenant_id) → public.tenants(id)
- UNIQUE (lead_id)
- CHECK crm_uaz_avatar_jobs_attempts_check: `CHECK ((attempts >= 0))`
- CHECK crm_uaz_avatar_jobs_status_check: `CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'retry'::text, 'completed'::text, 'failed'::text])))`

## Índices
- crm_uaz_avatar_jobs_due_idx: `btree (available_at, created_at) WHERE (status = ANY (ARRAY['pending'::text, 'retry'::text]))`
- crm_uaz_avatar_jobs_expired_lease_idx: `btree (lease_expires_at) WHERE (status = 'processing'::text)`
- crm_uaz_avatar_jobs_lead_id_key: `btree (lead_id)` único
- crm_uaz_avatar_jobs_store_idx: `btree (store_id)`
- crm_uaz_avatar_jobs_tenant_idx: `btree (tenant_id)`

## Políticas RLS
- "tenant_isolation" — ALL para authenticated (restritiva) · using `(tenant_id = ( SELECT current_tenant_id() AS current_tenant_id))` · check `(tenant_id = ( SELECT current_tenant_id() AS current_tenant_id))`

## Gatilhos
- zz_tenant_fill — BEFORE INSERT → private.tenant_fill()
- zz_tenant_guard — BEFORE UPDATE OF tenant_id → private.tenant_guard()

## Grants
- anon: — · authenticated: — (s=select i=insert u=update d=delete)
