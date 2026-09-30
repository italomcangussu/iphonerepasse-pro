# public.admin_agent_audit_log
> tabela · RLS on · ~<10k linhas

## Colunas
| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| id | uuid | não | `gen_random_uuid()` |  |
| phone | text | sim |  |  |
| user_id | uuid | sim |  |  |
| action | text | não |  |  |
| params | jsonb | não | `'{}'::jsonb` |  |
| result | jsonb | sim |  |  |
| status | text | não | `'ok'::text` |  |
| error | text | sim |  |  |
| created_at | timestamp with time zone | não | `now()` |  |

## Chaves e restrições
- PK (id)
- FK (user_id) → auth.users(id) on delete set null
- CHECK admin_agent_audit_log_status_check: `CHECK ((status = ANY (ARRAY['ok'::text, 'error'::text, 'denied'::text])))`

## Índices
- idx_admin_agent_audit_created: `btree (created_at DESC)`

## Políticas RLS
- "admin_agent_audit_admin_read" — SELECT para public · using `("current_role"() = 'admin'::text)`

## Grants
- anon: siud · authenticated: siud (s=select i=insert u=update d=delete)
