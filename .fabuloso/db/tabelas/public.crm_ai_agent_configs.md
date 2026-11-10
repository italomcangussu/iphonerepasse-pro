# public.crm_ai_agent_configs
> tabela · RLS on · ~<100 linhas

## Colunas
| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| id | uuid | não | `gen_random_uuid()` |  |
| store_id | text | não |  |  |
| name | text | não |  |  |
| model | text | não | `'gpt-4.1-mini'::text` |  |
| system_prompt | text | sim |  |  |
| config | jsonb | não | `'{}'::jsonb` |  |
| is_active | boolean | não | `false` |  |
| created_at | timestamp with time zone | não | `now()` |  |
| updated_at | timestamp with time zone | não | `now()` |  |
| endpoint_url | text | sim |  |  |
| behavior_modes | text[] | não | `'{}'::text[]` |  |
| auto_send_response | boolean | não | `false` |  |
| require_human_approval | boolean | não | `true` |  |
| trigger_conditions | jsonb | não | `'{}'::jsonb` |  |
| channel_ids | uuid[] | não | `'{}'::uuid[]` |  |
| total_invocations | integer | não | `0` |  |
| total_successes | integer | não | `0` |  |
| total_failures | integer | não | `0` |  |
| routing_mode | text | não | `'priority'::text` |  |
| routing_priority | integer | não | `100` |  |
| traffic_weight | integer | não | `100` |  |
| tenant_id | uuid | não |  |  |

## Chaves e restrições
- PK (id)
- FK (store_id) → public.stores(id) on delete cascade
- FK (tenant_id) → public.tenants(id)

## Referenciada por (1)
public.crm_ai_agent_invocations.agent_config_id

## Índices
- crm_ai_agent_configs_tenant_idx: `btree (tenant_id)`
- idx_crm_ai_agent_configs_store_active: `btree (store_id, is_active)`

## Políticas RLS
- "crm_ai_agent_configs_store_scope" — ALL para authenticated · using `crm_can_access_store(store_id)` · check `crm_can_access_store(store_id)`
- "tenant_isolation" — ALL para authenticated (restritiva) · using `(tenant_id = ( SELECT current_tenant_id() AS current_tenant_id))` · check `(tenant_id = ( SELECT current_tenant_id() AS current_tenant_id))`

## Gatilhos
- trg_crm_ai_agent_configs_set_updated_at — BEFORE UPDATE → public.crm_set_updated_at()
- zz_tenant_fill — BEFORE INSERT → private.tenant_fill()
- zz_tenant_guard — BEFORE UPDATE OF tenant_id → private.tenant_guard()

## Grants
- anon: siud · authenticated: siud (s=select i=insert u=update d=delete)
