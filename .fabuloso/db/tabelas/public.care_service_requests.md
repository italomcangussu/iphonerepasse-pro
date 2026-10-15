# public.care_service_requests
> tabela · RLS on · ~0 linhas

## Colunas
| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| id | uuid | não | `gen_random_uuid()` |  |
| request_number | bigint | não | `nextval('care_service_request_number_seq'::regclass)` |  |
| contract_id | uuid | não |  |  |
| service_type | text | não |  |  |
| description | text | sim |  |  |
| status | text | não | `'solicitado'::text` |  |
| deductible_amount | numeric(12,2) | sim |  |  |
| deductible_paid | boolean | não | `false` |  |
| actual_cost | numeric(12,2) | sim |  |  |
| parts_cost | numeric(12,2) | sim |  |  |
| decision_notes | text | sim |  |  |
| opened_by | uuid | sim | `auth.uid()` |  |
| decided_by | uuid | sim |  |  |
| opened_at | timestamp with time zone | não | `now()` |  |
| decided_at | timestamp with time zone | sim |  |  |
| completed_at | timestamp with time zone | sim |  |  |
| updated_at | timestamp with time zone | não | `now()` |  |

## Chaves e restrições
- PK (id)
- FK (contract_id) → public.care_contracts(id) on delete restrict
- UNIQUE (request_number)
- CHECK care_service_requests_actual_cost_check: `CHECK (((actual_cost IS NULL) OR (actual_cost >= (0)::numeric)))`
- CHECK care_service_requests_deductible_amount_check: `CHECK (((deductible_amount IS NULL) OR (deductible_amount >= (0)::numeric)))`
- CHECK care_service_requests_parts_cost_check: `CHECK (((parts_cost IS NULL) OR (parts_cost >= (0)::numeric)))`
- CHECK care_service_requests_service_type_check: `CHECK ((char_length(btrim(service_type)) > 0))`
- CHECK care_service_requests_status_check: `CHECK ((status = ANY (ARRAY['solicitado'::text, 'em_analise'::text, 'aprovado'::text, 'reprovado'::text, 'em_execucao'::text, 'concluido'::text, 'cancelado'::text])))`

## Índices
- care_service_requests_contract_idx: `btree (contract_id)`
- care_service_requests_request_number_key: `btree (request_number)` único
- care_service_requests_status_idx: `btree (status, opened_at DESC)`

## Políticas RLS
- "care_service_requests_select" — SELECT para authenticated · using `(( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text]))`

## Gatilhos
- care_service_requests_audit — AFTER INSERT OR DELETE OR UPDATE → private.care_audit()

## Grants
- anon: — · authenticated: s (s=select i=insert u=update d=delete)
