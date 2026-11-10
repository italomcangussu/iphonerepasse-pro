# public.simulator_trade_in_adjustments
> tabela · RLS on · ~0 linhas

## Colunas
| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| id | uuid | não | `gen_random_uuid()` |  |
| label | text | não |  |  |
| model | text | sim |  |  |
| capacity | text | sim |  |  |
| amount_delta | numeric(12,2) | não |  |  |
| is_active | boolean | não | `true` |  |
| created_at | timestamp with time zone | não | `now()` |  |
| updated_at | timestamp with time zone | não | `now()` |  |
| tenant_id | uuid | não |  |  |

## Chaves e restrições
- PK (id)
- FK (tenant_id) → public.tenants(id)
- CHECK simulator_trade_in_adjustments_capacity_not_blank: `CHECK (((capacity IS NULL) OR (btrim(capacity) <> ''::text)))`
- CHECK simulator_trade_in_adjustments_label_check: `CHECK ((btrim(label) <> ''::text))`
- CHECK simulator_trade_in_adjustments_model_not_blank: `CHECK (((model IS NULL) OR (btrim(model) <> ''::text)))`

## Índices
- simulator_trade_in_adjustments_lookup_idx: `btree (lower(btrim(COALESCE(model, ''::text))), lower(btrim(COALESCE(capacity, ''::text)))) WHERE is_active`
- simulator_trade_in_adjustments_tenant_idx: `btree (tenant_id)`

## Políticas RLS
- "simulator_trade_in_adjustments_admin_delete" — DELETE para authenticated · using `("current_role"() = 'admin'::text)`
- "simulator_trade_in_adjustments_admin_insert" — INSERT para authenticated · check `("current_role"() = 'admin'::text)`
- "simulator_trade_in_adjustments_admin_update" — UPDATE para authenticated · using `("current_role"() = 'admin'::text)` · check `("current_role"() = 'admin'::text)`
- "simulator_trade_in_adjustments_select" — SELECT para authenticated · using `("current_role"() = ANY (ARRAY['admin'::text, 'seller'::text]))`
- "tenant_isolation" — ALL para authenticated (restritiva) · using `(tenant_id = ( SELECT current_tenant_id() AS current_tenant_id))` · check `(tenant_id = ( SELECT current_tenant_id() AS current_tenant_id))`

## Gatilhos
- set_simulator_trade_in_adjustments_updated_at — BEFORE UPDATE → public.tg_set_simulator_trade_in_updated_at()
- zz_tenant_fill — BEFORE INSERT → private.tenant_fill()
- zz_tenant_guard — BEFORE UPDATE OF tenant_id → private.tenant_guard()

## Grants
- anon: siud · authenticated: siud (s=select i=insert u=update d=delete)
