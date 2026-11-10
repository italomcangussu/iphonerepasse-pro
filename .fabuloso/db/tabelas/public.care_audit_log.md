# public.care_audit_log
> tabela · RLS on · ~<100 linhas

## Colunas
| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| id | bigint | não |  | identity |
| actor_id | uuid | sim | `auth.uid()` |  |
| action | text | não |  |  |
| entity | text | não |  |  |
| entity_id | text | sim |  |  |
| before | jsonb | sim |  |  |
| after | jsonb | sim |  |  |
| created_at | timestamp with time zone | não | `now()` |  |
| tenant_id | uuid | não |  |  |

## Chaves e restrições
- PK (id)
- FK (tenant_id) → public.tenants(id)

## Índices
- care_audit_log_actor_idx: `btree (actor_id)`
- care_audit_log_entity_idx: `btree (entity, entity_id, created_at DESC)`
- care_audit_log_tenant_idx: `btree (tenant_id)`

## Políticas RLS
- "care_audit_log_admin_select" — SELECT para authenticated · using `(( SELECT "current_role"() AS "current_role") = 'admin'::text)`
- "tenant_isolation" — ALL para authenticated (restritiva) · using `(tenant_id = ( SELECT current_tenant_id() AS current_tenant_id))` · check `(tenant_id = ( SELECT current_tenant_id() AS current_tenant_id))`

## Gatilhos
- care_audit_log_append_only — BEFORE DELETE OR UPDATE → private.care_append_only()
- zz_tenant_fill — BEFORE INSERT → private.tenant_fill()
- zz_tenant_guard — BEFORE UPDATE OF tenant_id → private.tenant_guard()

## Grants
- anon: — · authenticated: s (s=select i=insert u=update d=delete)
