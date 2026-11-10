# public.crm_automation_rules
> tabela · RLS on · ~0 linhas

## Colunas
| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| id | uuid | não | `gen_random_uuid()` |  |
| store_id | text | não |  |  |
| channel_id | uuid | sim |  |  |
| description | text | não |  |  |
| trigger_type | text | não |  |  |
| message_content | text | não |  |  |
| delay_minutes | integer | não | `0` |  |
| funnel_stage | text | sim |  |  |
| switch_to_human_handling | boolean | não | `false` |  |
| message_variants | jsonb | não | `'{}'::jsonb` |  |
| metrics | jsonb | não | `'{}'::jsonb` |  |
| is_active | boolean | não | `true` |  |
| created_by | uuid | sim |  |  |
| created_at | timestamp with time zone | não | `now()` |  |
| updated_at | timestamp with time zone | não | `now()` |  |
| tenant_id | uuid | não |  |  |

## Chaves e restrições
- PK (id)
- FK (channel_id) → public.crm_channels(id) on delete set null
- FK (store_id) → public.stores(id) on delete cascade
- FK (tenant_id) → public.tenants(id)

## Índices
- crm_automation_rules_tenant_idx: `btree (tenant_id)`
- idx_crm_automation_rules_store_active: `btree (store_id, is_active)`

## Políticas RLS
- "crm_automation_rules_store_scope" — ALL para authenticated · using `crm_can_access_store(store_id)` · check `crm_can_access_store(store_id)`
- "tenant_isolation" — ALL para authenticated (restritiva) · using `(tenant_id = ( SELECT current_tenant_id() AS current_tenant_id))` · check `(tenant_id = ( SELECT current_tenant_id() AS current_tenant_id))`

## Gatilhos
- trg_crm_automation_rules_set_updated_at — BEFORE UPDATE → public.crm_set_updated_at()
- zz_tenant_fill — BEFORE INSERT → private.tenant_fill()
- zz_tenant_guard — BEFORE UPDATE OF tenant_id → private.tenant_guard()

## Grants
- anon: siud · authenticated: siud (s=select i=insert u=update d=delete)
