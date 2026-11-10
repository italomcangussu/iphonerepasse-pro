# public.crm_message_templates
> tabela · RLS on · ~0 linhas

## Colunas
| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| id | uuid | não | `gen_random_uuid()` |  |
| store_id | text | não |  |  |
| channel_id | uuid | sim |  |  |
| name | text | não |  |  |
| category | text | não | `'general'::text` |  |
| content | text | não |  |  |
| variables | jsonb | não | `'{}'::jsonb` |  |
| is_active | boolean | não | `true` |  |
| created_at | timestamp with time zone | não | `now()` |  |
| updated_at | timestamp with time zone | não | `now()` |  |
| tenant_id | uuid | não |  |  |

## Chaves e restrições
- PK (id)
- FK (channel_id) → public.crm_channels(id) on delete set null
- FK (store_id) → public.stores(id) on delete cascade
- FK (tenant_id) → public.tenants(id)

## Índices
- crm_message_templates_tenant_idx: `btree (tenant_id)`
- idx_crm_message_templates_store_active: `btree (store_id, is_active)`

## Políticas RLS
- "crm_message_templates_store_scope" — ALL para authenticated · using `crm_can_access_store(store_id)` · check `crm_can_access_store(store_id)`
- "tenant_isolation" — ALL para authenticated (restritiva) · using `(tenant_id = ( SELECT current_tenant_id() AS current_tenant_id))` · check `(tenant_id = ( SELECT current_tenant_id() AS current_tenant_id))`

## Gatilhos
- trg_crm_message_templates_set_updated_at — BEFORE UPDATE → public.crm_set_updated_at()
- zz_tenant_fill — BEFORE INSERT → private.tenant_fill()
- zz_tenant_guard — BEFORE UPDATE OF tenant_id → private.tenant_guard()

## Grants
- anon: siud · authenticated: siud (s=select i=insert u=update d=delete)
