# public.crm_ai_entry_settings
> tabela · RLS on · ~<100 linhas

## Colunas
| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| id | uuid | não | `gen_random_uuid()` |  |
| store_id | text | não |  |  |
| is_enabled | boolean | não | `false` |  |
| fallback_mode | text | não | `'keep_current'::text` |  |
| reopen_hours | integer | não | `24` |  |
| business_hours | jsonb | não | `'{}'::jsonb` |  |
| special_business_hours | jsonb | não | `'{}'::jsonb` |  |
| rules | jsonb | não | `'[]'::jsonb` |  |
| created_at | timestamp with time zone | não | `now()` |  |
| updated_at | timestamp with time zone | não | `now()` |  |
| tenant_id | uuid | não |  |  |

## Chaves e restrições
- PK (id)
- FK (store_id) → public.stores(id) on delete cascade
- FK (tenant_id) → public.tenants(id)
- UNIQUE (store_id)
- CHECK crm_ai_entry_settings_fallback_mode_check: `CHECK ((fallback_mode = ANY (ARRAY['keep_current'::text, 'force_human'::text, 'force_ai'::text])))`
- CHECK crm_ai_entry_settings_reopen_hours_check: `CHECK (((reopen_hours >= 1) AND (reopen_hours <= 720)))`

## Índices
- crm_ai_entry_settings_store_id_key: `btree (store_id)` único
- crm_ai_entry_settings_tenant_idx: `btree (tenant_id)`
- idx_crm_ai_entry_settings_store_id: `btree (store_id)`

## Políticas RLS
- "crm_ai_entry_settings_store_scope" — ALL para authenticated · using `crm_can_access_store(store_id)` · check `crm_can_access_store(store_id)`
- "tenant_isolation" — ALL para authenticated (restritiva) · using `(tenant_id = ( SELECT current_tenant_id() AS current_tenant_id))` · check `(tenant_id = ( SELECT current_tenant_id() AS current_tenant_id))`

## Gatilhos
- zz_tenant_fill — BEFORE INSERT → private.tenant_fill()
- zz_tenant_guard — BEFORE UPDATE OF tenant_id → private.tenant_guard()

## Grants
- anon: siud · authenticated: siud (s=select i=insert u=update d=delete)
