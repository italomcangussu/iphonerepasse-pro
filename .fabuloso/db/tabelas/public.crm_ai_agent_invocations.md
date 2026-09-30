# public.crm_ai_agent_invocations
> tabela · RLS on · ~0 linhas

## Colunas
| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| id | uuid | não | `gen_random_uuid()` |  |
| store_id | text | não |  |  |
| agent_config_id | uuid | sim |  |  |
| routing_rule_id | uuid | sim |  |  |
| source | text | não | `'inbound'::text` |  |
| status | text | não | `'success'::text` |  |
| routing_reason | text | sim |  |  |
| metadata | jsonb | não | `'{}'::jsonb` |  |
| created_at | timestamp with time zone | não | `now()` |  |

## Chaves e restrições
- PK (id)
- FK (agent_config_id) → public.crm_ai_agent_configs(id) on delete set null
- FK (store_id) → public.stores(id) on delete cascade
- CHECK crm_ai_agent_invocations_source_check: `CHECK ((source = ANY (ARRAY['manual_test'::text, 'inbound'::text, 'manual_handoff'::text])))`
- CHECK crm_ai_agent_invocations_status_check: `CHECK ((status = ANY (ARRAY['success'::text, 'failure'::text])))`

## Índices
- idx_crm_ai_agent_invocations_agent_created: `btree (agent_config_id, created_at DESC)`
- idx_crm_ai_agent_invocations_store_created: `btree (store_id, created_at DESC)`

## Políticas RLS
- "crm_ai_agent_invocations_store_insert" — INSERT para authenticated · check `crm_can_access_store(store_id)`
- "crm_ai_agent_invocations_store_read" — SELECT para authenticated · using `crm_can_access_store(store_id)`

## Grants
- anon: siud · authenticated: siud (s=select i=insert u=update d=delete)
