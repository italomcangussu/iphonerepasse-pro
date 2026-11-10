# public.customers
> tabela · RLS on · ~<1k linhas

## Colunas
| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| id | text | não |  |  |
| name | text | não |  |  |
| cpf | text | sim |  |  |
| phone | text | sim |  |  |
| email | text | sim |  |  |
| birth_date | text | sim |  |  |
| purchases | integer | sim | `0` |  |
| total_spent | numeric | sim | `0` |  |
| created_at | timestamp with time zone | sim | `now()` |  |
| updated_at | timestamp with time zone | sim | `now()` |  |
| alternative_phone | text | sim |  | Telefone alternativo opcional do cliente, usado em cadastros ERP. |
| tenant_id | uuid | não |  |  |

## Chaves e restrições
- PK (id)
- FK (tenant_id) → public.tenants(id)
- UNIQUE (tenant_id, cpf)
- CHECK customers_birth_date_day_month_check: `CHECK (((birth_date IS NULL) OR (birth_date = private.normalize_birth_day_month(birth_date))))`

## Referenciada por (4)
public.care_contracts.customer_id, public.debts.customer_id, public.pdv_quotes.customer_id, public.sales.customer_id

## Índices
- customers_cpf_normalized_idx: `btree (regexp_replace(COALESCE(cpf, ''::text), '\D'::text, ''::text, 'g'::text))`
- customers_tenant_cpf_key: `btree (tenant_id, cpf)` único
- customers_tenant_idx: `btree (tenant_id)`

## Políticas RLS
- "customers_delete" — DELETE para authenticated · using `( SELECT has_app_permission('clients'::text, 'deletable'::text) AS has_app_permission)`
- "customers_insert" — INSERT para authenticated · check `(( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text]))`
- "customers_select" — SELECT para authenticated · using `(( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text]))`
- "customers_update" — UPDATE para authenticated · using `(( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text]))` · check `(( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text]))`
- "tenant_isolation" — ALL para authenticated (restritiva) · using `(tenant_id = ( SELECT current_tenant_id() AS current_tenant_id))` · check `(tenant_id = ( SELECT current_tenant_id() AS current_tenant_id))`

## Gatilhos
- customers_normalize_birth_date — BEFORE INSERT OR UPDATE OF birth_date → private.customers_normalize_birth_date()
- zz_tenant_fill — BEFORE INSERT → private.tenant_fill()
- zz_tenant_guard — BEFORE UPDATE OF tenant_id → private.tenant_guard()

## Grants
- anon: siud · authenticated: siud (s=select i=insert u=update d=delete)
