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

## Chaves e restrições
- PK (id)
- CHECK simulator_trade_in_adjustments_capacity_not_blank: `CHECK (((capacity IS NULL) OR (btrim(capacity) <> ''::text)))`
- CHECK simulator_trade_in_adjustments_label_check: `CHECK ((btrim(label) <> ''::text))`
- CHECK simulator_trade_in_adjustments_model_not_blank: `CHECK (((model IS NULL) OR (btrim(model) <> ''::text)))`

## Índices
- simulator_trade_in_adjustments_lookup_idx: `btree (lower(btrim(COALESCE(model, ''::text))), lower(btrim(COALESCE(capacity, ''::text)))) WHERE is_active`

## Políticas RLS
- "simulator_trade_in_adjustments_admin_delete" — DELETE para authenticated · using `("current_role"() = 'admin'::text)`
- "simulator_trade_in_adjustments_admin_insert" — INSERT para authenticated · check `("current_role"() = 'admin'::text)`
- "simulator_trade_in_adjustments_admin_update" — UPDATE para authenticated · using `("current_role"() = 'admin'::text)` · check `("current_role"() = 'admin'::text)`
- "simulator_trade_in_adjustments_select" — SELECT para authenticated · using `("current_role"() = ANY (ARRAY['admin'::text, 'seller'::text]))`

## Gatilhos
- set_simulator_trade_in_adjustments_updated_at — BEFORE UPDATE → public.tg_set_simulator_trade_in_updated_at()

## Grants
- anon: siud · authenticated: siud (s=select i=insert u=update d=delete)
