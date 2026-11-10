# public.tenant_members
> tabela · RLS on · ~0 linhas

## Colunas
| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| tenant_id | uuid | não |  |  |
| user_id | uuid | não |  |  |
| role | text | não |  |  |
| seller_id | text | sim |  |  |
| created_by | uuid | sim |  |  |
| created_at | timestamp with time zone | não | `now()` |  |

## Chaves e restrições
- PK (tenant_id, user_id)
- FK (created_by) → auth.users(id) on delete set null
- FK (seller_id) → public.sellers(id) on delete set null
- FK (tenant_id) → public.tenants(id) on delete cascade
- FK (user_id) → auth.users(id) on delete cascade
- CHECK tenant_members_role_check: `CHECK ((role = ANY (ARRAY['admin'::text, 'manager'::text, 'seller'::text])))`

## Índices
- tenant_members_user_idx: `btree (user_id)`

## Políticas RLS
- "tenant_members_select" — SELECT para authenticated · using `((user_id = auth.uid()) OR is_tenant_admin(tenant_id))`

## Grants
- anon: siud · authenticated: siud (s=select i=insert u=update d=delete)
