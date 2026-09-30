# public.lead_state
> tabela · RLS on · ~<100 linhas

## Colunas
| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| lead_id | text | não |  |  |
| interest_type | text | sim |  |  |
| desired_model | text | sim |  |  |
| desired_capacity | text | sim |  |  |
| desired_color | text | sim |  |  |
| desired_condition | text | sim |  |  |
| has_tradein | boolean | não | `false` |  |
| tradein_model | text | sim |  |  |
| tradein_model_accepted | boolean | sim |  |  |
| tradein_rejected_reason | text | sim |  |  |
| tradein_capacity | text | sim |  |  |
| tradein_color | text | sim |  |  |
| tradein_scratches | boolean | sim |  |  |
| tradein_liquid_contact | boolean | sim |  |  |
| tradein_side_marks | boolean | sim |  |  |
| tradein_parts_swapped | boolean | sim |  |  |
| tradein_has_box_cable | text | sim |  |  |
| tradein_battery_pct | integer | sim |  |  |
| tradein_battery_suspect | boolean | não | `false` |  |
| tradein_apple_warranty | boolean | sim |  |  |
| tradein_warranty_until | text | sim |  |  |
| tradein_disqualified | boolean | não | `false` |  |
| preferred_city | text | sim |  |  |
| stock_city | text | sim |  |  |
| cross_city_situation | boolean | não | `false` |  |
| stock_item_id | text | sim |  |  |
| hdi_city_needed | boolean | não | `false` |  |
| client_outside_ce | boolean | não | `false` |  |
| card_brand | text | sim |  |  |
| simulation_done | boolean | não | `false` |  |
| simulation_count | integer | não | `0` |  |
| last_simulation_total | numeric(10,2) | sim |  |  |
| secondary_color_simulation | text | sim |  |  |
| proposal_accepted | boolean | não | `false` |  |
| reservation_intent | boolean | não | `false` |  |
| pix_data_sent | boolean | não | `false` |  |
| pix_paid | boolean | não | `false` |  |
| pix_amount | numeric(10,2) | sim |  |  |
| pickup_datetime | timestamp with time zone | sim |  |  |
| pickup_city | text | sim |  |  |
| cadastro_solicitado | boolean | não | `false` |  |
| cadastro_nome_completo | text | sim |  |  |
| cadastro_data_nascimento | text | sim |  |  |
| cadastro_cpf | text | sim |  |  |
| cadastro_contato | text | sim |  |  |
| cadastro_completo | boolean | não | `false` |  |
| created_at | timestamp with time zone | não | `now()` |  |
| updated_at | timestamp with time zone | não | `now()` |  |
| commerce_state | jsonb | não | `'{}'::jsonb` |  |
| tradein_assessment | jsonb | não | `'{}'::jsonb` |  |
| quote_versions | jsonb | não | `'[]'::jsonb` |  |
| state_version | bigint | não | `0` |  |
| cash_entry_asked | boolean | não | `false` |  |
| cash_entry_intent | boolean | sim |  |  |
| cash_entry_amount | numeric(10,2) | sim |  |  |
| tradein_asked | boolean | não | `false` |  |

## Chaves e restrições
- PK (lead_id)
- FK (lead_id) → public.crm_leads(id) on delete cascade
- CHECK lead_state_card_brand_check: `CHECK (((card_brand IS NULL) OR (card_brand = ANY (ARRAY['visa_master'::text, 'elo'::text, 'amex'::text, 'hipercard'::text]))))`
- CHECK lead_state_desired_condition_check: `CHECK (((desired_condition IS NULL) OR (desired_condition = ANY (ARRAY['Novo'::text, 'Seminovo'::text]))))`
- CHECK lead_state_interest_type_check: `CHECK (((interest_type IS NULL) OR (interest_type = ANY (ARRAY['comprar'::text, 'vender'::text, 'trocar'::text, 'avaliar'::text, 'duvida'::text]))))`
- CHECK lead_state_last_simulation_total_check: `CHECK (((last_simulation_total IS NULL) OR (last_simulation_total >= (0)::numeric)))`
- CHECK lead_state_pix_amount_check: `CHECK (((pix_amount IS NULL) OR (pix_amount >= (0)::numeric)))`
- CHECK lead_state_simulation_count_check: `CHECK (((simulation_count >= 0) AND (simulation_count <= 3)))`
- CHECK lead_state_tradein_battery_pct_check: `CHECK (((tradein_battery_pct IS NULL) OR ((tradein_battery_pct >= 0) AND (tradein_battery_pct <= 100))))`
- CHECK lead_state_tradein_rejected_reason_check: `CHECK (((tradein_rejected_reason IS NULL) OR (tradein_rejected_reason = 'modelo_nao_aceito'::text)))`

## Índices
- idx_lead_state_pickup_datetime: `btree (pickup_datetime) WHERE (pickup_datetime IS NOT NULL)`
- idx_lead_state_preferred_city: `btree (preferred_city) WHERE (preferred_city IS NOT NULL)`
- idx_lead_state_stock_item_id: `btree (stock_item_id) WHERE (stock_item_id IS NOT NULL)`

## Políticas RLS
- "lead_state_store_scope_insert" — INSERT para authenticated · check `(EXISTS ( SELECT 1 FROM crm_leads l WHERE ((l.id = lead_state.lead_id) AND crm_can_access_store(l.store_id))))`
- "lead_state_store_scope_select" — SELECT para authenticated · using `(EXISTS ( SELECT 1 FROM crm_leads l WHERE ((l.id = lead_state.lead_id) AND crm_can_access_store(l.store_id))))`
- "lead_state_store_scope_update" — UPDATE para authenticated · using `(EXISTS ( SELECT 1 FROM crm_leads l WHERE ((l.id = lead_state.lead_id) AND crm_can_access_store(l.store_id))))` · check `(EXISTS ( SELECT 1 FROM crm_leads l WHERE ((l.id = lead_state.lead_id) AND crm_can_access_store(l.store_id))))`

## Gatilhos
- trg_lead_state_set_updated_at — BEFORE UPDATE → public.tg_set_lead_state_updated_at()

## Grants
- anon: siud · authenticated: siud (s=select i=insert u=update d=delete)
