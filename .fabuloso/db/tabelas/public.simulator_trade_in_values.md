# public.simulator_trade_in_values
> tabela · RLS on · ~0 linhas

## Colunas
| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| id | uuid | não | `gen_random_uuid()` |  |
| model | text | não |  |  |
| capacity | text | não |  |  |
| base_value | numeric(12,2) | não |  |  |
| is_active | boolean | não | `true` |  |
| created_at | timestamp with time zone | não | `now()` |  |
| updated_at | timestamp with time zone | não | `now()` |  |

## Chaves e restrições
- PK (id)
- CHECK simulator_trade_in_values_base_value_check: `CHECK ((base_value >= (0)::numeric))`
- CHECK simulator_trade_in_values_capacity_check: `CHECK ((btrim(capacity) <> ''::text))`
- CHECK simulator_trade_in_values_model_check: `CHECK ((btrim(model) <> ''::text))`

## Índices
- simulator_trade_in_values_active_unique: `btree (lower(btrim(model)), lower(btrim(capacity))) WHERE is_active` único
- simulator_trade_in_values_lookup_idx: `btree (lower(btrim(model)), lower(btrim(capacity)))`

## Políticas RLS
- "simulator_trade_in_values_admin_delete" — DELETE para authenticated · using `("current_role"() = 'admin'::text)`
- "simulator_trade_in_values_admin_insert" — INSERT para authenticated · check `("current_role"() = 'admin'::text)`
- "simulator_trade_in_values_admin_update" — UPDATE para authenticated · using `("current_role"() = 'admin'::text)` · check `("current_role"() = 'admin'::text)`
- "simulator_trade_in_values_select" — SELECT para authenticated · using `("current_role"() = ANY (ARRAY['admin'::text, 'seller'::text]))`

## Gatilhos
- set_simulator_trade_in_values_updated_at — BEFORE UPDATE → public.tg_set_simulator_trade_in_updated_at()

## Grants
- anon: siud · authenticated: siud (s=select i=insert u=update d=delete)
