# public.care_benefits
> tabela · RLS on · ~0 linhas

## Colunas
| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| id | uuid | não | `gen_random_uuid()` |  |
| name | text | não |  |  |
| kind | text | não | `'produto'::text` |  |
| description | text | sim |  |  |
| reference_cost | numeric(12,2) | sim |  |  |
| active | boolean | não | `true` |  |
| created_at | timestamp with time zone | não | `now()` |  |
| updated_at | timestamp with time zone | não | `now()` |  |

## Chaves e restrições
- PK (id)
- CHECK care_benefits_kind_check: `CHECK ((kind = ANY (ARRAY['produto'::text, 'servico'::text, 'beneficio'::text, 'kit'::text])))`
- CHECK care_benefits_name_check: `CHECK ((char_length(btrim(name)) > 0))`
- CHECK care_benefits_reference_cost_check: `CHECK (((reference_cost IS NULL) OR (reference_cost >= (0)::numeric)))`

## Referenciada por (2)
public.care_contract_benefits.benefit_id, public.care_model_rule_bonuses.benefit_id

## Políticas RLS
- "care_benefits_admin_delete" — DELETE para authenticated · using `(( SELECT "current_role"() AS "current_role") = 'admin'::text)`
- "care_benefits_admin_insert" — INSERT para authenticated · check `(( SELECT "current_role"() AS "current_role") = 'admin'::text)`
- "care_benefits_admin_update" — UPDATE para authenticated · using `(( SELECT "current_role"() AS "current_role") = 'admin'::text)` · check `(( SELECT "current_role"() AS "current_role") = 'admin'::text)`
- "care_benefits_select" — SELECT para authenticated · using `(( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text]))`

## Gatilhos
- care_benefits_audit — AFTER INSERT OR DELETE OR UPDATE → private.care_audit()
- care_benefits_touch — BEFORE UPDATE → private.care_touch_updated_at()

## Grants
- anon: — · authenticated: siud (s=select i=insert u=update d=delete)
