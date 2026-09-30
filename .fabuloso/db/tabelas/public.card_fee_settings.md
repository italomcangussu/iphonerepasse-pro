# public.card_fee_settings
> tabela · RLS on · ~0 linhas

## Colunas
| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| id | text | não | `'default'::text` |  |
| visa_master_rates | jsonb | não |  |  |
| other_rates | jsonb | não |  |  |
| created_at | timestamp with time zone | não | `now()` |  |
| updated_at | timestamp with time zone | não | `now()` |  |
| debit_rate | numeric | não | `1.87` |  |

## Chaves e restrições
- PK (id)
- CHECK card_fee_settings_debit_rate_check: `CHECK (((debit_rate >= (0)::numeric) AND (debit_rate < (100)::numeric)))`
- CHECK card_fee_settings_id_check: `CHECK ((id = 'default'::text))`
- CHECK card_fee_settings_other_rates_check: `CHECK (is_valid_card_fee_rates(other_rates))`
- CHECK card_fee_settings_visa_master_rates_check: `CHECK (is_valid_card_fee_rates(visa_master_rates))`

## Políticas RLS
- "card_fee_settings_delete" — DELETE para authenticated · using `(( SELECT "current_role"() AS "current_role") = 'admin'::text)`
- "card_fee_settings_insert" — INSERT para authenticated · check `(( SELECT "current_role"() AS "current_role") = 'admin'::text)`
- "card_fee_settings_select" — SELECT para authenticated · using `(( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text]))`
- "card_fee_settings_update" — UPDATE para authenticated · using `(( SELECT "current_role"() AS "current_role") = 'admin'::text)` · check `(( SELECT "current_role"() AS "current_role") = 'admin'::text)`

## Gatilhos
- set_card_fee_settings_updated_at — BEFORE UPDATE → public.tg_set_card_fee_settings_updated_at()

## Grants
- anon: siud · authenticated: siud (s=select i=insert u=update d=delete)
