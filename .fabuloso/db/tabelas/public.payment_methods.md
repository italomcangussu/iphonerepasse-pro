# public.payment_methods
> tabela · RLS on · ~<1k linhas

## Colunas
| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| id | text | não |  |  |
| sale_id | text | sim |  |  |
| type | text | não |  |  |
| amount | numeric | não |  |  |
| installments | integer | sim |  |  |
| created_at | timestamp with time zone | sim | `now()` |  |
| debt_due_date | date | sim |  |  |
| debt_notes | text | sim |  |  |
| account | text | sim |  |  |
| card_brand | text | sim |  |  |
| customer_amount | numeric | sim |  |  |
| fee_rate | numeric | sim |  |  |
| fee_amount | numeric | sim |  |  |
| debt_installments | integer | sim |  |  |
| source | text | sim |  |  |
| reservation_id | text | sim |  |  |
| reservation_deposit_transaction_id | text | sim |  |  |

## Chaves e restrições
- PK (id)
- FK (reservation_deposit_transaction_id) → public.transactions(id) on delete set null
- FK (reservation_id) → public.stock_reservations(id) on delete set null
- FK (sale_id) → public.sales(id) on delete cascade
- CHECK payment_methods_account_check: `CHECK (((account = ANY (ARRAY['Conta Bancária'::text, 'Cofre'::text, 'Devedores'::text])) OR (account IS NULL)))`
- CHECK payment_methods_card_brand_check: `CHECK (((card_brand = ANY (ARRAY['visa_master'::text, 'outras'::text])) OR (card_brand IS NULL)))`
- CHECK payment_methods_customer_amount_check: `CHECK (((customer_amount IS NULL) OR (customer_amount >= (0)::numeric)))`
- CHECK payment_methods_debt_installments_check: `CHECK (((debt_installments IS NULL) OR (debt_installments >= 1)))`
- CHECK payment_methods_fee_amount_check: `CHECK (((fee_amount IS NULL) OR (fee_amount >= (0)::numeric)))`
- CHECK payment_methods_fee_rate_check: `CHECK (((fee_rate IS NULL) OR ((fee_rate >= (0)::numeric) AND (fee_rate < (100)::numeric))))`
- CHECK payment_methods_source_check: `CHECK (((source IS NULL) OR (source = ANY (ARRAY['pdv'::text, 'reservation_deposit'::text]))))`
- CHECK payment_methods_type_check: `CHECK ((type = ANY (ARRAY['Pix'::text, 'Dinheiro'::text, 'Cartão'::text, 'Cartão Débito'::text, 'Devedor'::text])))`

## Índices
- idx_payment_methods_reservation_deposit_transaction_id: `btree (reservation_deposit_transaction_id)`
- idx_payment_methods_reservation_id: `btree (reservation_id)`
- idx_payment_methods_sale_id: `btree (sale_id)`

## Políticas RLS
- "payment_methods_delete" — DELETE para authenticated · using `(( SELECT "current_role"() AS "current_role") = 'admin'::text)`
- "payment_methods_insert" — INSERT para authenticated · check `(( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text]))`
- "payment_methods_select" — SELECT para authenticated · using `(( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text]))`
- "payment_methods_update" — UPDATE para authenticated · using `(( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text]))` · check `(( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text]))`

## Grants
- anon: siud · authenticated: siud (s=select i=insert u=update d=delete)
