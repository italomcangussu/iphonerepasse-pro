# public.pdv_quotes
> tabela · RLS on · ~0 linhas

## Colunas
| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| id | uuid | não | `gen_random_uuid()` |  |
| quote_number | bigint | não |  | identity |
| store_id | text | sim |  |  |
| customer_id | text | sim |  |  |
| customer_name | text | sim |  |  |
| customer_phone | text | sim |  |  |
| seller_name | text | sim |  |  |
| items | jsonb | não |  |  |
| payment | jsonb | não | `'{}'::jsonb` |  |
| subtotal | numeric(12,2) | não |  |  |
| discount | numeric(12,2) | não | `0` |  |
| total | numeric(12,2) | não |  |  |
| notes | text | sim |  |  |
| validity_days | integer | não | `1` |  |
| expires_at | timestamp with time zone | não |  |  |
| status | text | não | `'aberto'::text` |  |
| created_by | uuid | sim | `auth.uid()` |  |
| created_at | timestamp with time zone | não | `now()` |  |

## Chaves e restrições
- PK (id)
- FK (created_by) → auth.users(id) on delete set null
- FK (customer_id) → public.customers(id) on delete set null
- FK (store_id) → public.stores(id) on delete set null
- UNIQUE (quote_number)
- CHECK pdv_quotes_discount_check: `CHECK ((discount >= (0)::numeric))`
- CHECK pdv_quotes_items_check: `CHECK (((jsonb_typeof(items) = 'array'::text) AND (jsonb_array_length(items) > 0)))`
- CHECK pdv_quotes_payment_check: `CHECK ((jsonb_typeof(payment) = 'object'::text))`
- CHECK pdv_quotes_status_check: `CHECK ((status = ANY (ARRAY['aberto'::text, 'cancelado'::text])))`
- CHECK pdv_quotes_subtotal_check: `CHECK ((subtotal >= (0)::numeric))`
- CHECK pdv_quotes_total_check: `CHECK ((total >= (0)::numeric))`
- CHECK pdv_quotes_validity_days_check: `CHECK (((validity_days >= 1) AND (validity_days <= 30)))`

## Índices
- idx_pdv_quotes_created_at: `btree (created_at DESC)`
- idx_pdv_quotes_created_by: `btree (created_by)`
- idx_pdv_quotes_customer_id: `btree (customer_id)`
- idx_pdv_quotes_store_id: `btree (store_id)`
- pdv_quotes_quote_number_key: `btree (quote_number)` único

## Políticas RLS
- "pdv_quotes_delete" — DELETE para authenticated · using `( SELECT has_app_permission('pdv'::text, 'deletable'::text) AS has_app_permission)`
- "pdv_quotes_insert" — INSERT para authenticated · check `( SELECT has_app_permission('pdv'::text, 'visible'::text) AS has_app_permission)`
- "pdv_quotes_select" — SELECT para authenticated · using `( SELECT has_app_permission('pdv'::text, 'visible'::text) AS has_app_permission)`
- "pdv_quotes_update" — UPDATE para authenticated · using `( SELECT has_app_permission('pdv'::text, 'visible'::text) AS has_app_permission)` · check `( SELECT has_app_permission('pdv'::text, 'visible'::text) AS has_app_permission)`

## Grants
- anon: — · authenticated: siud (s=select i=insert u=update d=delete)
