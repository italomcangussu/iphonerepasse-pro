# public.push_subscriptions
> tabela · RLS on · ~<100 linhas — One row per browser/device push subscription. Managed by the push-subscribe edge function.

## Colunas
| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| id | uuid | não | `gen_random_uuid()` |  |
| user_id | uuid | não |  |  |
| store_id | text | sim |  |  |
| endpoint | text | não |  |  |
| p256dh | text | não |  |  |
| auth | text | não |  |  |
| user_agent | text | sim |  |  |
| platform | text | sim |  |  |
| topics | text[] | não | `'{crm_inbox,new_lead,sale}'::text[]` |  |
| is_active | boolean | não | `true` |  |
| last_seen_at | timestamp with time zone | não | `now()` |  |
| last_error_at | timestamp with time zone | sim |  |  |
| last_error_message | text | sim |  |  |
| created_at | timestamp with time zone | não | `now()` |  |
| product | text | não | `'erp'::text` | Which installable PWA this subscription belongs to: erp (iPhoneRepasse Pro) or crmplus (CRM Plus). |
| tenant_id | uuid | não |  |  |

## Chaves e restrições
- PK (id)
- FK (store_id) → public.stores(id) on delete set null
- FK (tenant_id) → public.tenants(id)
- FK (user_id) → auth.users(id) on delete cascade
- UNIQUE (endpoint)
- CHECK push_subscriptions_platform_check: `CHECK ((platform = ANY (ARRAY['ios'::text, 'android'::text, 'desktop'::text])))`
- CHECK push_subscriptions_product_check: `CHECK ((product = ANY (ARRAY['erp'::text, 'crmplus'::text])))`

## Índices
- push_subscriptions_endpoint_key: `btree (endpoint)` único
- push_subscriptions_product_active_idx: `btree (product) WHERE (is_active = true)`
- push_subscriptions_store_active_idx: `btree (store_id) WHERE (is_active = true)`
- push_subscriptions_store_product_active_idx: `btree (store_id, product) WHERE (is_active = true)`
- push_subscriptions_store_topics_idx: `gin (topics) WHERE (is_active = true)`
- push_subscriptions_tenant_idx: `btree (tenant_id)`
- push_subscriptions_user_active_idx: `btree (user_id) WHERE (is_active = true)`

## Políticas RLS
- "tenant_isolation" — ALL para authenticated (restritiva) · using `(tenant_id = ( SELECT current_tenant_id() AS current_tenant_id))` · check `(tenant_id = ( SELECT current_tenant_id() AS current_tenant_id))`
- "users manage own push subscriptions" — ALL para public · using `(( SELECT auth.uid() AS uid) = user_id)` · check `(( SELECT auth.uid() AS uid) = user_id)`

## Gatilhos
- zz_tenant_fill — BEFORE INSERT → private.tenant_fill()
- zz_tenant_guard — BEFORE UPDATE OF tenant_id → private.tenant_guard()

## Grants
- anon: siud · authenticated: siud (s=select i=insert u=update d=delete)
