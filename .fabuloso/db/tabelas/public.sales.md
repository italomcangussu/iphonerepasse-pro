# public.sales
> tabela · RLS on · ~<1k linhas

## Colunas
| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| id | text | não |  |  |
| customer_id | text | sim |  |  |
| seller_id | text | sim |  |  |
| total | numeric | não | `0` |  |
| discount | numeric | sim | `0` |  |
| date | timestamp with time zone | sim | `now()` |  |
| warranty_expires_at | timestamp with time zone | sim |  |  |
| trade_in_id | text | sim |  |  |
| trade_in_value | numeric | sim | `0` |  |
| created_at | timestamp with time zone | sim | `now()` |  |
| updated_at | timestamp with time zone | sim | `now()` |  |
| discount_type | text | sim |  |  |
| discount_percent | numeric | sim |  |  |
| original_subtotal | numeric | não | `0` |  |
| negotiated_subtotal | numeric | não | `0` |  |
| store_id | text | sim |  |  |
| client_payment_amount | numeric | sim |  |  |
| client_payment_mode | text | sim |  |  |
| client_payment_account | text | sim |  |  |
| client_payment_method | text | sim |  |  |
| client_payment_notes | text | sim |  |  |
| client_payment_due_date | date | sim |  |  |
| commission | numeric | não | `0` |  |
| sale_number | bigint | não | `nextval('sales_sale_number_seq'::regclass)` |  |
| crm_lead_id | text | sim |  | Direct CRM Plus lead attribution for ERP sales. Used to prove Ads lead -> real sale conversion. |

## Chaves e restrições
- PK (id)
- FK (crm_lead_id) → public.crm_leads(id) on delete set null
- FK (customer_id) → public.customers(id)
- FK (seller_id) → public.sellers(id)
- FK (store_id) → public.stores(id) on delete set null
- FK (trade_in_id) → public.stock_items(id) on delete set null
- CHECK sales_client_payment_mode_check: `CHECK (((client_payment_mode IS NULL) OR (client_payment_mode = ANY (ARRAY['immediate'::text, 'payable_debt'::text]))))`
- CHECK sales_discount_percent_check: `CHECK (((discount_percent IS NULL) OR ((discount_percent >= (0)::numeric) AND (discount_percent <= (100)::numeric))))`
- CHECK sales_discount_type_check: `CHECK (((discount_type = ANY (ARRAY['amount'::text, 'percent'::text])) OR (discount_type IS NULL)))`
- CHECK sales_negotiated_subtotal_check: `CHECK ((negotiated_subtotal >= (0)::numeric))`
- CHECK sales_original_subtotal_check: `CHECK ((original_subtotal >= (0)::numeric))`

## Referenciada por (8)
public.debts.sale_id, public.payable_debts.sale_id, public.payment_methods.sale_id, public.sale_items.sale_id, public.sale_trade_in_items.sale_id, public.stock_reservations.sold_sale_id, public.transactions.sale_id, public.warranty_public_tokens.sale_id

## Índices
- idx_sales_crm_lead_id: `btree (crm_lead_id) WHERE (crm_lead_id IS NOT NULL)`
- idx_sales_customer_id: `btree (customer_id)`
- idx_sales_customer_store_date: `btree (customer_id, store_id, date DESC NULLS LAST) WHERE (customer_id IS NOT NULL)`
- idx_sales_seller_id: `btree (seller_id)`
- idx_sales_store_id: `btree (store_id)`
- idx_sales_trade_in_id: `btree (trade_in_id)`
- sales_sale_number_key: `btree (sale_number)` único

## Políticas RLS
- "sales_delete" — DELETE para authenticated · using `(( SELECT "current_role"() AS "current_role") = 'admin'::text)`
- "sales_insert" — INSERT para authenticated · check `(( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text]))`
- "sales_select" — SELECT para authenticated · using `(( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text]))`
- "sales_update" — UPDATE para authenticated · using `(( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text]))` · check `(( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text]))`

## Gatilhos
- trg_crm_sales_purchase_sync — AFTER INSERT OR DELETE OR UPDATE → public.crm_sales_purchase_sync_trigger()
- trg_sales_after_delete_cleanup — AFTER DELETE → public.handle_sale_after_delete_cleanup()
- trg_sales_backfill_ads_origin_from_phone_match — AFTER INSERT OR UPDATE OF customer_id, store_id, crm_lead_id, date → public.sales_backfill_ads_origin_from_phone_match()
- trg_sales_before_delete — BEFORE DELETE → public.handle_sale_before_delete()
- trg_sales_set_crm_lead_id — BEFORE INSERT OR UPDATE OF customer_id, store_id, crm_lead_id → public.sales_set_crm_lead_id()

## Grants
- anon: siud · authenticated: siud (s=select i=insert u=update d=delete)
