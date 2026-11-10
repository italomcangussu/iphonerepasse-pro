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
| tenant_id | uuid | não |  |  |

## Chaves e restrições
- PK (id)
- FK (created_by) → auth.users(id) on delete set null
- FK (sale_id) → public.sales(id) on delete cascade
- FK (tenant_id) → public.tenants(id)
- UNIQUE (token_hash)

## Índices
- idx_warranty_public_tokens_expires_at: `btree (expires_at)`
- idx_warranty_public_tokens_sale_id: `btree (sale_id)`
- warranty_public_tokens_tenant_idx: `btree (tenant_id)`
- warranty_public_tokens_token_hash_key: `btree (token_hash)` único

## Políticas RLS
- "tenant_isolation" — ALL para authenticated (restritiva) · using `(tenant_id = ( SELECT current_tenant_id() AS current_tenant_id))` · check `(tenant_id = ( SELECT current_tenant_id() AS current_tenant_id))`
- "warranty_public_tokens_delete" — DELETE para authenticated · using `( SELECT has_app_permission('warranties'::text, 'deletable'::text) AS has_app_permission)`
- "warranty_public_tokens_insert" — INSERT para authenticated · check `( SELECT has_app_permission('warranties'::text, 'editable'::text) AS has_app_permission)`
- "warranty_public_tokens_select" — SELECT para authenticated · using `(( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text]))`
- "warranty_public_tokens_update" — UPDATE para authenticated · using `( SELECT has_app_permission('warranties'::text, 'editable'::text) AS has_app_permission)` · check `( SELECT has_app_permission('warranties'::text, 'editable'::text) AS has_app_permission)`

## Gatilhos
- zz_tenant_fill — BEFORE INSERT → private.tenant_fill()
- zz_tenant_guard — BEFORE UPDATE OF tenant_id → private.tenant_guard()

## Grants
- anon: siud · authenticated: siud (s=select i=insert u=update d=delete)
