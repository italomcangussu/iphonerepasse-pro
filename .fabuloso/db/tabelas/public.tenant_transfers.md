# public.tenant_transfers
> tabela · RLS on · ~0 linhas

## Colunas
| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| id | uuid | não | `gen_random_uuid()` |  |
| kind | text | não |  |  |
| from_tenant_id | uuid | não |  |  |
| to_tenant_id | uuid | não |  |  |
| store_id | text | sim |  |  |
| target_store_id | text | sim |  |  |
| item_ids | text[] | não | `'{}'::text[]` |  |
| summary | jsonb | não | `'{}'::jsonb` |  |
| performed_by | uuid | sim |  |  |
| created_at | timestamp with time zone | não | `now()` |  |

## Chaves e restrições
- PK (id)
- FK (from_tenant_id) → public.tenants(id) on delete cascade
- FK (performed_by) → auth.users(id) on delete set null
- FK (to_tenant_id) → public.tenants(id) on delete cascade
- CHECK tenant_transfers_kind_check: `CHECK ((kind = ANY (ARRAY['store'::text, 'stock'::text])))`

## Políticas RLS
- "tenant_transfers_select" — SELECT para authenticated · using `(is_tenant_admin(from_tenant_id) OR is_tenant_admin(to_tenant_id))`

## Grants
- anon: siud · authenticated: siud (s=select i=insert u=update d=delete)
