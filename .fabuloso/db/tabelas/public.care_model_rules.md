# public.care_model_rules
> tabela · RLS on · ~0 linhas

## Colunas
| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| id | uuid | não | `gen_random_uuid()` |  |
| model | text | não |  |  |
| condition | text | não |  |  |
| active | boolean | não | `true` |  |
| first_installment_amount | numeric(12,2) | não |  |  |
| subsequent_installment_count | integer | não |  |  |
| recurring_percent_override | numeric(7,4) | sim |  |  |
| deductible_modality | text | sim |  |  |
| deductible_value | numeric(12,4) | sim |  |  |
| billing_interval_months | integer | não |  |  |
| first_subsequent_due_months | integer | não |  |  |
| services_description | text | sim |  |  |
| usage_limits | text | sim |  |  |
| notes | text | sim |  |  |
| version | integer | não | `1` |  |
| effective_from | timestamp with time zone | não | `now()` |  |
| created_at | timestamp with time zone | não | `now()` |  |
| created_by | uuid | sim | `auth.uid()` |  |
| updated_at | timestamp with time zone | não | `now()` |  |
| updated_by | uuid | sim | `auth.uid()` |  |

## Chaves e restrições
- PK (id)
- CHECK care_model_rules_billing_interval_months_check: `CHECK (((billing_interval_months >= 1) AND (billing_interval_months <= 12)))`
- CHECK care_model_rules_condition_check: `CHECK ((condition = ANY (ARRAY['NOVO'::text, 'SEMINOVO'::text])))`
- CHECK care_model_rules_deductible_modality_check: `CHECK (((deductible_modality IS NULL) OR (deductible_modality = ANY (ARRAY['PERCENTUAL'::text, 'VALOR_FIXO'::text]))))`
- CHECK care_model_rules_deductible_pair: `CHECK (((deductible_modality IS NULL) = (deductible_value IS NULL)))`
- CHECK care_model_rules_deductible_percent: `CHECK (((deductible_modality IS DISTINCT FROM 'PERCENTUAL'::text) OR (deductible_value <= (100)::numeric)))`
- CHECK care_model_rules_deductible_value_check: `CHECK (((deductible_value IS NULL) OR (deductible_value >= (0)::numeric)))`
- CHECK care_model_rules_first_installment_amount_check: `CHECK ((first_installment_amount >= (0)::numeric))`
- CHECK care_model_rules_first_subsequent_due_months_check: `CHECK (((first_subsequent_due_months >= 0) AND (first_subsequent_due_months <= 12)))`
- CHECK care_model_rules_model_check: `CHECK ((char_length(btrim(model)) > 0))`
- CHECK care_model_rules_recurring_percent_override_check: `CHECK (((recurring_percent_override IS NULL) OR ((recurring_percent_override >= (0)::numeric) AND (recurring_percent_override <= (100)::numeric))))`
- CHECK care_model_rules_subsequent_installment_count_check: `CHECK (((subsequent_installment_count >= 0) AND (subsequent_installment_count <= 120)))`

## Referenciada por (2)
public.care_contracts.model_rule_id, public.care_model_rule_bonuses.rule_id

## Índices
- care_model_rules_key: `btree (lower(btrim(model)), condition)` único

## Políticas RLS
- "care_model_rules_admin_delete" — DELETE para authenticated · using `(( SELECT "current_role"() AS "current_role") = 'admin'::text)`
- "care_model_rules_admin_insert" — INSERT para authenticated · check `(( SELECT "current_role"() AS "current_role") = 'admin'::text)`
- "care_model_rules_admin_update" — UPDATE para authenticated · using `(( SELECT "current_role"() AS "current_role") = 'admin'::text)` · check `(( SELECT "current_role"() AS "current_role") = 'admin'::text)`
- "care_model_rules_select" — SELECT para authenticated · using `(( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text]))`

## Gatilhos
- care_model_rules_audit — AFTER INSERT OR DELETE OR UPDATE → private.care_audit()
- care_model_rules_version — BEFORE UPDATE → private.care_bump_version()

## Grants
- anon: — · authenticated: siud (s=select i=insert u=update d=delete)
