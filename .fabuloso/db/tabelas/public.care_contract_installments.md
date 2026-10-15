# public.care_contract_installments
> tabela · RLS on · ~0 linhas

## Colunas
| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| id | uuid | não | `gen_random_uuid()` |  |
| contract_id | uuid | não |  |  |
| sequence_number | integer | não |  |  |
| kind | text | não |  |  |
| amount | numeric(12,2) | não |  |  |
| due_date | date | sim |  |  |
| status | text | não | `'programada'::text` |  |
| paid_at | timestamp with time zone | sim |  |  |
| payment_method | text | sim |  |  |
| payment_account | text | sim |  |  |
| payment_reference | text | sim |  |  |
| transaction_id | text | sim |  |  |
| confirmed_by | uuid | sim |  |  |
| created_at | timestamp with time zone | não | `now()` |  |
| updated_at | timestamp with time zone | não | `now()` |  |

## Chaves e restrições
- PK (id)
- FK (contract_id) → public.care_contracts(id) on delete restrict
- FK (transaction_id) → public.transactions(id) on delete set null
- UNIQUE (contract_id, sequence_number)
- CHECK care_contract_installments_amount_check: `CHECK ((amount >= (0)::numeric))`
- CHECK care_contract_installments_kind_check: `CHECK ((kind = ANY (ARRAY['primeira'::text, 'recorrente'::text])))`
- CHECK care_contract_installments_sequence_number_check: `CHECK ((sequence_number >= 1))`
- CHECK care_contract_installments_status_check: `CHECK ((status = ANY (ARRAY['programada'::text, 'paga'::text, 'cancelada'::text])))`
- CHECK care_installments_kind_sequence: `CHECK (((kind = 'primeira'::text) = (sequence_number = 1)))`

## Índices
- care_contract_installments_contract_id_sequence_number_key: `btree (contract_id, sequence_number)` único
- care_installments_due_idx: `btree (status, due_date)`
- care_installments_transaction_idx: `btree (transaction_id)`

## Políticas RLS
- "care_contract_installments_select" — SELECT para authenticated · using `(( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text]))`

## Gatilhos
- care_contract_installments_audit — AFTER INSERT OR DELETE OR UPDATE → private.care_audit()

## Grants
- anon: — · authenticated: s (s=select i=insert u=update d=delete)
