# public.crm_broadcast_recipients
> tabela · RLS on · ~0 linhas

## Colunas
| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| id | uuid | não | `gen_random_uuid()` |  |
| broadcast_id | uuid | não |  |  |
| store_id | text | não |  |  |
| lead_id | text | não |  |  |
| conversation_id | uuid | sim |  |  |
| channel_id | uuid | sim |  |  |
| status | text | não | `'pending'::text` |  |
| error_message | text | sim |  |  |
| provider_message_id | text | sim |  |  |
| sent_at | timestamp with time zone | sim |  |  |
| created_at | timestamp with time zone | não | `now()` |  |
| tenant_id | uuid | não |  |  |

## Chaves e restrições
- PK (id)
- FK (broadcast_id) → public.crm_broadcasts(id) on delete cascade
- FK (channel_id) → public.crm_channels(id) on delete set null
- FK (conversation_id) → public.crm_conversations(id) on delete set null
- FK (lead_id) → public.crm_leads(id) on delete cascade
- FK (tenant_id) → public.tenants(id)
- UNIQUE (broadcast_id, lead_id)
- CHECK crm_broadcast_recipients_status_check: `CHECK ((status = ANY (ARRAY['pending'::text, 'sent'::text, 'failed'::text, 'skipped'::text])))`

## Índices
- crm_broadcast_recipients_broadcast_id_lead_id_key: `btree (broadcast_id, lead_id)` único
- crm_broadcast_recipients_tenant_idx: `btree (tenant_id)`
- idx_crm_broadcast_recipients_status: `btree (broadcast_id, status)`

## Políticas RLS
- "crm_broadcast_recipients_store_scope" — ALL para authenticated · using `crm_can_access_store(store_id)` · check `crm_can_access_store(store_id)`
- "tenant_isolation" — ALL para authenticated (restritiva) · using `(tenant_id = ( SELECT current_tenant_id() AS current_tenant_id))` · check `(tenant_id = ( SELECT current_tenant_id() AS current_tenant_id))`

## Gatilhos
- zz_tenant_fill — BEFORE INSERT → private.tenant_fill()
- zz_tenant_guard — BEFORE UPDATE OF tenant_id → private.tenant_guard()

## Grants
- anon: siud · authenticated: siud (s=select i=insert u=update d=delete)
