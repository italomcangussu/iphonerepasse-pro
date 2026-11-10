# public.crm_settings
> tabela · RLS on · ~<100 linhas

## Colunas
| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| id | text | não | `'centralized_service'::text` |  |
| value_bool | boolean | não | `false` |  |
| updated_at | timestamp with time zone | não | `now()` |  |
| value_text | text | sim |  |  |
| tenant_id | uuid | não |  |  |

## Chaves e restrições
- PK (tenant_id, id)
- FK (tenant_id) → public.tenants(id)

## Índices
- crm_settings_tenant_idx: `btree (tenant_id)`

## Políticas RLS
- "crm_settings_delete" — DELETE para authenticated · using `(( SELECT "current_role"() AS "current_role") = 'admin'::text)`
- "crm_settings_insert" — INSERT para authenticated · check `(( SELECT "current_role"() AS "current_role") = 'admin'::text)`
- "crm_settings_select" — SELECT para authenticated · using `true`
- "crm_settings_update" — UPDATE para authenticated · using `(( SELECT "current_role"() AS "current_role") = 'admin'::text)` · check `(( SELECT "current_role"() AS "current_role") = 'admin'::text)`
- "tenant_isolation" — ALL para authenticated (restritiva) · using `(tenant_id = ( SELECT current_tenant_id() AS current_tenant_id))` · check `(tenant_id = ( SELECT current_tenant_id() AS current_tenant_id))`

## Gatilhos
- zz_tenant_fill — BEFORE INSERT → private.tenant_fill()
- zz_tenant_guard — BEFORE UPDATE OF tenant_id → private.tenant_guard()

## Grants
- anon: siud · authenticated: siud (s=select i=insert u=update d=delete)
