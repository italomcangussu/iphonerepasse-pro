# public.care_audit_log
> tabela · RLS on · ~0 linhas

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

## Chaves e restrições
- PK (id)

## Índices
- care_audit_log_actor_idx: `btree (actor_id)`
- care_audit_log_entity_idx: `btree (entity, entity_id, created_at DESC)`

## Políticas RLS
- "care_audit_log_admin_select" — SELECT para authenticated · using `(( SELECT "current_role"() AS "current_role") = 'admin'::text)`

## Gatilhos
- care_audit_log_append_only — BEFORE DELETE OR UPDATE → private.care_append_only()

## Grants
- anon: — · authenticated: s (s=select i=insert u=update d=delete)
