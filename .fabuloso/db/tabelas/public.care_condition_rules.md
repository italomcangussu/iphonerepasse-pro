# public.care_condition_rules
> tabela · RLS on · ~0 linhas

## Colunas
| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| condition | text | não |  |  |
| recurring_percent | numeric(7,4) | sim |  |  |
| deductible_modality | text | sim |  |  |
| deductible_value | numeric(12,4) | sim |  |  |
| version | integer | não | `1` |  |
| updated_at | timestamp with time zone | não | `now()` |  |
| updated_by | uuid | sim | `auth.uid()` |  |

## Chaves e restrições
- PK (condition)
- CHECK care_condition_rules_condition_check: `CHECK ((condition = ANY (ARRAY['NOVO'::text, 'SEMINOVO'::text])))`
- CHECK care_condition_rules_deductible_modality_check: `CHECK (((deductible_modality IS NULL) OR (deductible_modality = ANY (ARRAY['PERCENTUAL'::text, 'VALOR_FIXO'::text]))))`
- CHECK care_condition_rules_deductible_pair: `CHECK (((deductible_modality IS NULL) = (deductible_value IS NULL)))`
- CHECK care_condition_rules_deductible_percent: `CHECK (((deductible_modality IS DISTINCT FROM 'PERCENTUAL'::text) OR (deductible_value <= (100)::numeric)))`
- CHECK care_condition_rules_deductible_value_check: `CHECK (((deductible_value IS NULL) OR (deductible_value >= (0)::numeric)))`
- CHECK care_condition_rules_recurring_percent_check: `CHECK (((recurring_percent IS NULL) OR ((recurring_percent >= (0)::numeric) AND (recurring_percent <= (100)::numeric))))`

## Políticas RLS
- "care_condition_rules_admin_update" — UPDATE para authenticated · using `(( SELECT "current_role"() AS "current_role") = 'admin'::text)` · check `(( SELECT "current_role"() AS "current_role") = 'admin'::text)`
- "care_condition_rules_select" — SELECT para authenticated · using `(( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text]))`

## Gatilhos
- care_condition_rules_audit — AFTER INSERT OR DELETE OR UPDATE → private.care_audit()
- care_condition_rules_version — BEFORE UPDATE → private.care_bump_version()

## Grants
- anon: — · authenticated: siud (s=select i=insert u=update d=delete)
