# public.tenants
> tabela · RLS on · ~0 linhas

## Colunas
| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| id | uuid | não | `gen_random_uuid()` |  |
| name | text | não |  |  |
| is_primary | boolean | não | `false` |  |
| created_by | uuid | sim |  |  |
| created_at | timestamp with time zone | não | `now()` |  |
| updated_at | timestamp with time zone | não | `now()` |  |

## Chaves e restrições
- PK (id)
- FK (created_by) → auth.users(id) on delete set null
- CHECK tenants_name_check: `CHECK ((btrim(name) <> ''::text))`

## Referenciada por (81)
public.ai_turn_events.tenant_id, public.app_role_permissions.tenant_id, public.app_user_activity_logs.tenant_id, public.business_profile.tenant_id, public.card_fee_settings.tenant_id, public.care_audit_log.tenant_id, public.care_benefits.tenant_id, public.care_condition_rules.tenant_id, public.care_contract_benefits.tenant_id, public.care_contract_documents.tenant_id, public.care_contract_inspections.tenant_id, public.care_contract_installments.tenant_id, public.care_contracts.tenant_id, public.care_model_rule_bonuses.tenant_id, public.care_model_rules.tenant_id, public.care_service_requests.tenant_id, public.care_settings.tenant_id, public.care_signature_events.tenant_id, public.care_signature_sessions.tenant_id, public.cost_history.tenant_id, public.costs.tenant_id, public.creditors.tenant_id, public.crm_ai_agent_configs.tenant_id, public.crm_ai_agent_invocations.tenant_id, public.crm_ai_entry_settings.tenant_id, …

## Índices
- tenants_one_primary: `btree (is_primary) WHERE is_primary` único

## Políticas RLS
- "tenants_select" — SELECT para authenticated · using `(tenant_role(id) IS NOT NULL)`

## Grants
- anon: siud · authenticated: siud (s=select i=insert u=update d=delete)
