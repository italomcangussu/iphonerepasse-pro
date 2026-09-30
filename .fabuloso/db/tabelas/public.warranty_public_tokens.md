# public.warranty_public_tokens
> tabela · RLS on · ~0 linhas

## Colunas
| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| id | uuid | não | `gen_random_uuid()` |  |
| sale_id | text | não |  |  |
| token_hash | text | não |  |  |
| expires_at | timestamp with time zone | não |  |  |
| revoked_at | timestamp with time zone | sim |  |  |
| created_by | uuid | sim |  |  |
| created_at | timestamp with time zone | não | `now()` |  |
| last_accessed_at | timestamp with time zone | sim |  |  |

## Chaves e restrições
- PK (id)
- FK (created_by) → auth.users(id) on delete set null
- FK (sale_id) → public.sales(id) on delete cascade
- UNIQUE (token_hash)

## Índices
- idx_warranty_public_tokens_expires_at: `btree (expires_at)`
- idx_warranty_public_tokens_sale_id: `btree (sale_id)`
- warranty_public_tokens_token_hash_key: `btree (token_hash)` único

## Políticas RLS
- "warranty_public_tokens_delete" — DELETE para authenticated · using `(( SELECT "current_role"() AS "current_role") = 'admin'::text)`
- "warranty_public_tokens_insert" — INSERT para authenticated · check `(( SELECT "current_role"() AS "current_role") = 'admin'::text)`
- "warranty_public_tokens_select" — SELECT para authenticated · using `(( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text]))`
- "warranty_public_tokens_update" — UPDATE para authenticated · using `(( SELECT "current_role"() AS "current_role") = 'admin'::text)` · check `(( SELECT "current_role"() AS "current_role") = 'admin'::text)`

## Grants
- anon: siud · authenticated: siud (s=select i=insert u=update d=delete)
