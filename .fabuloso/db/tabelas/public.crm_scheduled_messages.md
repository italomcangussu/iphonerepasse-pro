# public.crm_scheduled_messages
> tabela · RLS on · ~0 linhas

## Colunas
| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| id | uuid | não | `gen_random_uuid()` |  |
| lead_id | text | não |  |  |
| conversation_id | uuid | sim |  |  |
| automation_rule_id | uuid | sim |  |  |
| channel_id | uuid | sim |  |  |
| message_content | text | sim |  |  |
| media_url | text | sim |  |  |
| media_type | text | sim |  |  |
| scheduled_for | timestamp with time zone | não |  |  |
| status | text | sim | `'pending'::text` |  |
| error_message | text | sim |  |  |
| retry_count | integer | sim | `0` |  |
| sent_at | timestamp with time zone | sim |  |  |
| message_id | text | sim |  |  |
| created_at | timestamp with time zone | sim | `now()` |  |
| store_id | text | sim |  |  |
| metadata | jsonb | sim | `'{}'::jsonb` |  |
| updated_at | timestamp with time zone | sim | `now()` |  |
| tenant_id | uuid | não |  |  |

## Chaves e restrições
- PK (id)
- FK (conversation_id) → public.crm_conversations(id) on delete cascade
- FK (lead_id) → public.crm_leads(id) on delete cascade
- FK (tenant_id) → public.tenants(id)

## Índices
- crm_scheduled_messages_tenant_idx: `btree (tenant_id)`
- idx_crm_scheduled_messages_pending: `btree (scheduled_for) WHERE (status = ANY (ARRAY['pending'::text, 'scheduled'::text]))`

## Políticas RLS
- "crm_scheduled_messages_store_scope" — ALL para authenticated · using `crm_can_access_store(store_id)` · check `crm_can_access_store(store_id)`
- "tenant_isolation" — ALL para authenticated (restritiva) · using `(tenant_id = ( SELECT current_tenant_id() AS current_tenant_id))` · check `(tenant_id = ( SELECT current_tenant_id() AS current_tenant_id))`

## Gatilhos
- trg_crm_scheduled_messages_set_updated_at — BEFORE UPDATE → public.crm_set_updated_at()
- trg_crm_scheduled_sync_store — BEFORE INSERT OR UPDATE OF lead_id → public.crm_sync_lead_store_to_related_tables()
- zz_tenant_fill — BEFORE INSERT → private.tenant_fill()
- zz_tenant_guard — BEFORE UPDATE OF tenant_id → private.tenant_guard()

## Grants
- anon: siud · authenticated: siud (s=select i=insert u=update d=delete)
