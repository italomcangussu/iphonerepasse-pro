# public.care_contract_inspections
> tabela · RLS on · ~0 linhas

## Colunas
| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| id | uuid | não | `gen_random_uuid()` |  |
| contract_id | uuid | não |  |  |
| inspected_at | timestamp with time zone | não | `now()` |  |
| inspected_by | uuid | sim | `auth.uid()` |  |
| result | text | não |  |  |
| findings | text | sim |  |  |
| tenant_id | uuid | não |  |  |

## Chaves e restrições
- PK (id)
- FK (contract_id) → public.care_contracts(id) on delete restrict
- FK (tenant_id) → public.tenants(id)
- CHECK care_contract_inspections_result_check: `CHECK ((result = ANY (ARRAY['sem_avarias'::text, 'avarias_excluidas'::text])))`
- CHECK care_inspections_findings_when_damage: `CHECK (((result = 'sem_avarias'::text) OR (char_length(btrim(COALESCE(findings, ''::text))) > 0)))`

## Índices
- care_contract_inspections_contract_idx: `btree (contract_id, inspected_at DESC)`
- care_contract_inspections_tenant_idx: `btree (tenant_id)`

## Políticas RLS
- "care_contract_inspections_select" — SELECT para authenticated · using `(( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text]))`
- "tenant_isolation" — ALL para authenticated (restritiva) · using `(tenant_id = ( SELECT current_tenant_id() AS current_tenant_id))` · check `(tenant_id = ( SELECT current_tenant_id() AS current_tenant_id))`

## Gatilhos
- care_contract_inspections_audit — AFTER INSERT OR DELETE OR UPDATE → private.care_audit()
- zz_tenant_fill — BEFORE INSERT → private.tenant_fill()
- zz_tenant_guard — BEFORE UPDATE OF tenant_id → private.tenant_guard()

## Grants
- anon: — · authenticated: s (s=select i=insert u=update d=delete)
