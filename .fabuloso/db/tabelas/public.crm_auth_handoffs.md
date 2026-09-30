# public.crm_auth_handoffs
> tabela · RLS on · ~0 linhas

## Colunas
| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| id | uuid | não | `gen_random_uuid()` |  |
| code | text | não |  |  |
| user_id | uuid | não |  |  |
| store_id | text | sim |  |  |
| access_token | text | não |  |  |
| refresh_token | text | não |  |  |
| target_path | text | sim |  |  |
| expires_at | timestamp with time zone | não |  |  |
| consumed_at | timestamp with time zone | sim |  |  |
| created_at | timestamp with time zone | não | `now()` |  |

## Chaves e restrições
- PK (id)
- UNIQUE (code)

## Índices
- crm_auth_handoffs_code_key: `btree (code)` único
- idx_crm_auth_handoffs_code_expires: `btree (code, expires_at)`

## Políticas RLS
- "crm_auth_handoffs_block_all" — ALL para authenticated · using `false` · check `false`

## Grants
- anon: siud · authenticated: siud (s=select i=insert u=update d=delete)
