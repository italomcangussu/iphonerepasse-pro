# public.care_contracts
> tabela · RLS on · ~0 linhas

## Colunas
| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| id | uuid | não | `gen_random_uuid()` |  |
| contract_number | bigint | não | `nextval('care_contract_number_seq'::regclass)` |  |
| status | text | não | `'rascunho'::text` |  |
| sale_id | text | não |  |  |
| sale_item_id | text | não |  |  |
| stock_item_id | text | não |  |  |
| customer_id | text | não |  |  |
| store_id | text | sim |  |  |
| seller_id | text | sim |  |  |
| created_by | uuid | sim | `auth.uid()` |  |
| customer_name | text | não |  |  |
| customer_cpf | text | sim |  |  |
| customer_phone | text | não |  |  |
| device_type | text | sim |  |  |
| device_model | text | não |  |  |
| device_capacity | text | sim |  |  |
| device_color | text | sim |  |  |
| device_imei | text | sim |  |  |
| condition | text | não |  |  |
| sale_price | numeric(12,2) | não |  |  |
| first_amount | numeric(12,2) | não |  |  |
| recurring_percent | numeric(7,4) | não |  |  |
| recurring_percent_source | text | não |  |  |
| subsequent_count | integer | não |  |  |
| recurring_amount | numeric(12,2) | não |  |  |
| subsequent_total | numeric(12,2) | não |  |  |
| total_programmed | numeric(12,2) | não |  |  |
| deductible_modality | text | não |  |  |
| deductible_rate | numeric(12,4) | não |  |  |
| deductible_source | text | não |  |  |
| deductible_base | numeric(12,2) | sim |  |  |
| deductible_amount | numeric(12,2) | não |  |  |
| billing_interval_months | integer | não |  |  |
| first_subsequent_due_months | integer | não |  |  |
| services_description | text | sim |  |  |
| usage_limits | text | sim |  |  |
| model_rule_id | uuid | sim |  |  |
| model_rule_version | integer | não |  |  |
| condition_rule_version | integer | não |  |  |
| clauses_version | text | não |  |  |
| quote_snapshot | jsonb | não |  |  |
| signed_at | timestamp with time zone | sim |  |  |
| first_payment_confirmed_at | timestamp with time zone | sim |  |  |
| activated_at | timestamp with time zone | sim |  |  |
| cancelled_at | timestamp with time zone | sim |  |  |
| cancelled_by | uuid | sim |  |  |
| cancel_reason | text | sim |  |  |
| created_at | timestamp with time zone | não | `now()` |  |
| updated_at | timestamp with time zone | não | `now()` |  |

## Chaves e restrições
- PK (id)
- FK (customer_id) → public.customers(id) on delete restrict
- FK (model_rule_id) → public.care_model_rules(id) on delete set null
- FK (sale_id) → public.sales(id) on delete restrict
- FK (sale_item_id) → public.sale_items(id) on delete restrict
- FK (seller_id) → public.sellers(id) on delete set null
- FK (stock_item_id) → public.stock_items(id) on delete restrict
- FK (store_id) → public.stores(id) on delete set null
- UNIQUE (contract_number)
- CHECK care_contracts_condition_check: `CHECK ((condition = ANY (ARRAY['NOVO'::text, 'SEMINOVO'::text])))`
- CHECK care_contracts_deductible_amount_check: `CHECK ((deductible_amount >= (0)::numeric))`
- CHECK care_contracts_deductible_modality_check: `CHECK ((deductible_modality = ANY (ARRAY['PERCENTUAL'::text, 'VALOR_FIXO'::text])))`
- CHECK care_contracts_deductible_rate_check: `CHECK ((deductible_rate >= (0)::numeric))`
- CHECK care_contracts_deductible_source_check: `CHECK ((deductible_source = ANY (ARRAY['MODELO_CONDICAO'::text, 'CONDICAO'::text])))`
- CHECK care_contracts_first_amount_check: `CHECK ((first_amount >= (0)::numeric))`
- CHECK care_contracts_recurring_amount_check: `CHECK ((recurring_amount >= (0)::numeric))`
- CHECK care_contracts_recurring_percent_check: `CHECK ((recurring_percent >= (0)::numeric))`
- CHECK care_contracts_recurring_percent_source_check: `CHECK ((recurring_percent_source = ANY (ARRAY['MODELO_CONDICAO'::text, 'CONDICAO'::text])))`
- CHECK care_contracts_sale_price_check: `CHECK ((sale_price > (0)::numeric))`
- CHECK care_contracts_status_check: `CHECK ((status = ANY (ARRAY['rascunho'::text, 'aguardando_assinatura'::text, 'assinado_aguardando_primeiro_pagamento'::text, 'ativo'::text, 'assinatura_expirada'::text, 'assinatura_recusada'::text, '…`
- CHECK care_contracts_subsequent_count_check: `CHECK ((subsequent_count >= 0))`
- CHECK care_contracts_subsequent_total_check: `CHECK ((subsequent_total >= (0)::numeric))`
- CHECK care_contracts_total_programmed_check: `CHECK ((total_programmed >= (0)::numeric))`

## Referenciada por (6)
public.care_contract_benefits.contract_id, public.care_contract_documents.contract_id, public.care_contract_installments.contract_id, public.care_service_requests.contract_id, public.care_signature_events.contract_id, public.care_signature_sessions.contract_id

## Índices
- care_contracts_contract_number_key: `btree (contract_number)` único
- care_contracts_customer_idx: `btree (customer_id)`
- care_contracts_model_rule_idx: `btree (model_rule_id)`
- care_contracts_one_live_per_item: `btree (sale_item_id) WHERE (status <> ALL (ARRAY['cancelado'::text, 'assinatura_recusada'::text, 'assinatura_expirada'::text, 'encerrado'::…` único
- care_contracts_sale_idx: `btree (sale_id)`
- care_contracts_sale_item_idx: `btree (sale_item_id)`
- care_contracts_seller_idx: `btree (seller_id)`
- care_contracts_status_idx: `btree (status, created_at DESC)`
- care_contracts_stock_item_idx: `btree (stock_item_id)`
- care_contracts_store_idx: `btree (store_id)`

## Políticas RLS
- "care_contracts_select" — SELECT para authenticated · using `(( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text]))`

## Gatilhos
- care_contracts_audit — AFTER INSERT OR DELETE OR UPDATE → private.care_audit()
- care_contracts_guard — BEFORE UPDATE → private.care_contract_guard_snapshot()

## Grants
- anon: — · authenticated: s (s=select i=insert u=update d=delete)
