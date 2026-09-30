# public.admin_agent_numbers
> tabela · RLS on · ~0 linhas

## Colunas
| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| id | uuid | não | `gen_random_uuid()` |  |
| phone | text | não |  |  |
| user_id | uuid | não |  |  |
| label | text | sim |  |  |
| is_active | boolean | não | `true` |  |
| created_at | timestamp with time zone | não | `now()` |  |
| updated_at | timestamp with time zone | não | `now()` |  |

## Chaves e restrições
- PK (id)
- FK (user_id) → auth.users(id) on delete cascade
- UNIQUE (phone)

## Índices
- admin_agent_numbers_phone_key: `btree (phone)` único
- idx_admin_agent_numbers_active: `btree (phone) WHERE is_active`

## Políticas RLS
- "admin_agent_numbers_admin_all" — ALL para public · using `("current_role"() = 'admin'::text)` · check `("current_role"() = 'admin'::text)`

## Grants
- anon: siud · authenticated: siud (s=select i=insert u=update d=delete)
