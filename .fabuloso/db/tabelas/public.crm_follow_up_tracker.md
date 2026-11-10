# public.crm_follow_up_tracker
> tabela · RLS on · ~0 linhas

## Colunas
| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| id | uuid | não | `gen_random_uuid()` |  |
| lead_id | text | não |  |  |
| automation_rule_id | uuid | sim |  |  |
| attempt_count | integer | sim | `0` |  |
| last_attempt_at | timestamp with time zone | sim |  |  |
| next_attempt_at | timestamp with time zone | sim |  |  |
| max_attempts | integer | sim |  |  |
| is_completed | boolean | sim | `false` |  |
| completed_at | timestamp with time zone | sim |  |  |
| completion_reason | text | sim |  |  |
| created_at | timestamp with time zone | sim | `now()` |  |
| tenant_id | uuid | não |  |  |

## Chaves e restrições
- PK (id)
- FK (lead_id) → public.crm_leads(id) on delete cascade
- FK (tenant_id) → public.tenants(id)

## Índices
- crm_follow_up_tracker_tenant_idx: `btree (tenant_id)`

## Políticas RLS
- "crm_follow_up_tracker_store_scope" — ALL para authenticated · using `(EXISTS ( SELECT 1 FROM crm_leads cl WHERE ((cl.id = crm_follow_up_tracker.lead_id) AND crm_can_access_store(cl.store_id))))` · check `(EXISTS ( SELECT 1 FROM crm_leads cl WHERE ((cl.id = crm_follow_up_tracker.lead_id) AND crm_can_access_store(cl.store_id))))`
- "tenant_isolation" — ALL para authenticated (restritiva) · using `(tenant_id = ( SELECT current_tenant_id() AS current_tenant_id))` · check `(tenant_id = ( SELECT current_tenant_id() AS current_tenant_id))`

## Gatilhos
- zz_tenant_fill — BEFORE INSERT → private.tenant_fill()
- zz_tenant_guard — BEFORE UPDATE OF tenant_id → private.tenant_guard()

## Grants
- anon: siud · authenticated: siud (s=select i=insert u=update d=delete)
