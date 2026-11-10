# public.crm_event_log
> tabela · RLS on · ~<1M linhas

## Colunas
| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| id | uuid | não | `gen_random_uuid()` |  |
| store_id | text | não |  |  |
| event_type | text | não |  |  |
| payload | jsonb | sim |  |  |
| is_outbound | boolean | sim | `false` |  |
| created_at | timestamp with time zone | sim | `now()` |  |
| webhook_url | text | sim |  |  |
| sent | boolean | sim | `false` |  |
| sent_at | timestamp with time zone | sim |  |  |
| error_message | text | sim |  |  |
| retry_count | integer | sim | `0` |  |
| processed | boolean | sim | `false` |  |
| processed_at | timestamp with time zone | sim |  |  |
| subscription_id | uuid | sim |  |  |
| channel_id | uuid | sim |  |  |
| lead_id | text | sim |  |  |
| conversation_id | uuid | sim |  |  |
| tenant_id | uuid | não |  |  |

## Chaves e restrições
- PK (id)
- FK (channel_id) → public.crm_channels(id) on delete set null
- FK (conversation_id) → public.crm_conversations(id) on delete set null
- FK (lead_id) → public.crm_leads(id) on delete set null
- FK (subscription_id) → public.crm_webhook_subscriptions(id) on delete set null
- FK (tenant_id) → public.tenants(id)

## Índices
- crm_event_log_tenant_idx: `btree (tenant_id)`
- idx_crm_event_log_lead_created: `btree (lead_id, created_at DESC) WHERE (lead_id IS NOT NULL)`
- idx_crm_event_log_pending: `btree (created_at) WHERE ((is_outbound = true) AND (sent = false))`

## Políticas RLS
- "crm_event_log_store_scope" — ALL para authenticated · using `crm_can_access_store(store_id)` · check `crm_can_access_store(store_id)`
- "tenant_isolation" — ALL para authenticated (restritiva) · using `(tenant_id = ( SELECT current_tenant_id() AS current_tenant_id))` · check `(tenant_id = ( SELECT current_tenant_id() AS current_tenant_id))`

## Gatilhos
- trg_crm_event_log_sync_lead_last_event — AFTER INSERT → public.crm_event_log_sync_lead_last_event()
- zz_tenant_fill — BEFORE INSERT → private.tenant_fill()
- zz_tenant_guard — BEFORE UPDATE OF tenant_id → private.tenant_guard()

## Grants
- anon: siud · authenticated: siud (s=select i=insert u=update d=delete)
