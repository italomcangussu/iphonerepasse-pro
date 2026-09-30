# public.admin_agent_pending_actions
> tabela · RLS on · ~0 linhas

## Colunas
| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| id | uuid | não | `gen_random_uuid()` |  |
| phone | text | não |  |  |
| user_id | uuid | não |  |  |
| channel_id | text | sim |  |  |
| conversation_id | text | sim |  |  |
| action | text | não |  |  |
| params | jsonb | não | `'{}'::jsonb` |  |
| summary | text | não |  |  |
| status | text | não | `'pending'::text` |  |
| expires_at | timestamp with time zone | não |  |  |
| created_at | timestamp with time zone | não | `now()` |  |
| resolved_at | timestamp with time zone | sim |  |  |

## Chaves e restrições
- PK (id)
- FK (user_id) → auth.users(id) on delete cascade
- CHECK admin_agent_pending_actions_status_check: `CHECK ((status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'cancelled'::text, 'expired'::text])))`

## Índices
- idx_admin_agent_pending_phone: `btree (phone, status)`

## Políticas RLS
- (nenhuma: sem acesso pela API)

## Grants
- anon: siud · authenticated: siud (s=select i=insert u=update d=delete)
