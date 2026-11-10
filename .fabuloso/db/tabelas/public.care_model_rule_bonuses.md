# public.care_model_rule_bonuses
> tabela · RLS on · ~0 linhas

## Colunas
| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| rule_id | uuid | não |  |  |
| benefit_id | uuid | não |  |  |
| quantity | integer | não | `1` |  |
| delivery_condition | text | sim |  |  |
| tenant_id | uuid | não |  |  |

## Chaves e restrições
- PK (rule_id, benefit_id)
- FK (benefit_id) → public.care_benefits(id) on delete restrict
- FK (rule_id) → public.care_model_rules(id) on delete cascade
- FK (tenant_id) → public.tenants(id)
- CHECK care_model_rule_bonuses_quantity_check: `CHECK ((quantity > 0))`

## Índices
- care_model_rule_bonuses_benefit_idx: `btree (benefit_id)`
- care_model_rule_bonuses_tenant_idx: `btree (tenant_id)`

## Políticas RLS
- "care_model_rule_bonuses_admin_delete" — DELETE para authenticated · using `(( SELECT "current_role"() AS "current_role") = 'admin'::text)`
- "care_model_rule_bonuses_admin_insert" — INSERT para authenticated · check `(( SELECT "current_role"() AS "current_role") = 'admin'::text)`
- "care_model_rule_bonuses_admin_update" — UPDATE para authenticated · using `(( SELECT "current_role"() AS "current_role") = 'admin'::text)` · check `(( SELECT "current_role"() AS "current_role") = 'admin'::text)`
- "care_model_rule_bonuses_select" — SELECT para authenticated · using `(( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text]))`
- "tenant_isolation" — ALL para authenticated (restritiva) · using `(tenant_id = ( SELECT current_tenant_id() AS current_tenant_id))` · check `(tenant_id = ( SELECT current_tenant_id() AS current_tenant_id))`

## Gatilhos
- care_model_rule_bonuses_audit — AFTER INSERT OR DELETE OR UPDATE → private.care_audit()
- care_model_rule_bonuses_touch — AFTER INSERT OR DELETE OR UPDATE → private.care_bonus_touch_rule()
- zz_tenant_fill — BEFORE INSERT → private.tenant_fill()
- zz_tenant_guard — BEFORE UPDATE OF tenant_id → private.tenant_guard()

## Grants
- anon: — · authenticated: siud (s=select i=insert u=update d=delete)
