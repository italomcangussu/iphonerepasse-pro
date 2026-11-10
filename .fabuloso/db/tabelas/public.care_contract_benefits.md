# public.care_contract_benefits
> tabela · RLS on · ~0 linhas

## Colunas
| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| id | uuid | não | `gen_random_uuid()` |  |
| contract_id | uuid | não |  |  |
| benefit_id | uuid | sim |  |  |
| name | text | não |  |  |
| kind | text | não |  |  |
| description | text | sim |  |  |
| quantity | integer | não | `1` |  |
| delivery_condition | text | sim |  |  |
| reference_cost | numeric(12,2) | sim |  |  |
| status | text | não | `'pendente'::text` |  |
| released_at | timestamp with time zone | sim |  |  |
| delivered_at | timestamp with time zone | sim |  |  |
| delivered_by | uuid | sim |  |  |
| delivery_notes | text | sim |  |  |
| created_at | timestamp with time zone | não | `now()` |  |
| tenant_id | uuid | não |  |  |

## Chaves e restrições
- PK (id)
- FK (benefit_id) → public.care_benefits(id) on delete set null
- FK (contract_id) → public.care_contracts(id) on delete restrict
- FK (tenant_id) → public.tenants(id)
- CHECK care_contract_benefits_status_check: `CHECK ((status = ANY (ARRAY['pendente'::text, 'liberado'::text, 'entregue'::text, 'cancelado'::text])))`

## Índices
- care_contract_benefits_benefit_idx: `btree (benefit_id)`
- care_contract_benefits_contract_idx: `btree (contract_id)`
- care_contract_benefits_tenant_idx: `btree (tenant_id)`

## Políticas RLS
- "care_contract_benefits_select" — SELECT para authenticated · using `(( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text]))`
- "tenant_isolation" — ALL para authenticated (restritiva) · using `(tenant_id = ( SELECT current_tenant_id() AS current_tenant_id))` · check `(tenant_id = ( SELECT current_tenant_id() AS current_tenant_id))`

## Gatilhos
- care_contract_benefits_audit — AFTER INSERT OR DELETE OR UPDATE → private.care_audit()
- zz_tenant_fill — BEFORE INSERT → private.tenant_fill()
- zz_tenant_guard — BEFORE UPDATE OF tenant_id → private.tenant_guard()

## Grants
- anon: — · authenticated: s (s=select i=insert u=update d=delete)
