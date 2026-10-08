# public.crm_broadcasts
> tabela · RLS on · ~0 linhas

## Colunas
| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| id | uuid | não | `gen_random_uuid()` |  |
| store_id | text | não |  |  |
| channel_id | uuid | sim |  |  |
| name | text | não |  |  |
| message_template | text | não |  |  |
| recipient_filters | jsonb | não | `'{}'::jsonb` |  |
| status | text | não | `'draft'::text` |  |
| scheduled_for | timestamp with time zone | sim |  |  |
| sent_at | timestamp with time zone | sim |  |  |
| created_by | uuid | sim |  |  |
| created_at | timestamp with time zone | não | `now()` |  |
| updated_at | timestamp with time zone | não | `now()` |  |

## Chaves e restrições
- PK (id)
- FK (channel_id) → public.crm_channels(id) on delete set null
- FK (store_id) → public.stores(id) on delete cascade
- CHECK crm_broadcasts_status_check: `CHECK ((status = ANY (ARRAY['draft'::text, 'scheduled'::text, 'processing'::text, 'completed'::text, 'failed'::text, 'canceled'::text])))`

## Referenciada por (1)
public.crm_broadcast_recipients.broadcast_id

## Índices
- idx_crm_broadcasts_status_schedule: `btree (status, scheduled_for)`

## Políticas RLS
- "crm_broadcasts_store_scope" — ALL para authenticated · using `crm_can_access_store(store_id)` · check `crm_can_access_store(store_id)`

## Gatilhos
- trg_crm_broadcasts_set_updated_at — BEFORE UPDATE → public.crm_set_updated_at()

## Grants
- anon: siud · authenticated: siud (s=select i=insert u=update d=delete)
