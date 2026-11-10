# public.reservation_message_settings
> tabela · RLS on · ~<100 linhas

## Colunas
| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| id | text | não | `'default'::text` |  |
| template | text | não | `''::text` |  |
| send_by_default | boolean | não | `true` |  |
| created_at | timestamp with time zone | não | `now()` |  |
| updated_at | timestamp with time zone | não | `now()` |  |
| tenant_id | uuid | não |  |  |

## Chaves e restrições
- PK (tenant_id, id)
- FK (tenant_id) → public.tenants(id)
- CHECK reservation_message_settings_id_check: `CHECK ((id = 'default'::text))`

## Índices
- reservation_message_settings_tenant_idx: `btree (tenant_id)`

## Políticas RLS
- "reservation_message_settings_admin_all" — ALL para authenticated · using `("current_role"() = 'admin'::text)` · check `("current_role"() = 'admin'::text)`
- "reservation_message_settings_read" — SELECT para authenticated · using `true`
- "tenant_isolation" — ALL para authenticated (restritiva) · using `(tenant_id = ( SELECT current_tenant_id() AS current_tenant_id))` · check `(tenant_id = ( SELECT current_tenant_id() AS current_tenant_id))`

## Gatilhos
- reservation_message_settings_touch — BEFORE UPDATE → public.touch_reservation_message_settings()
- zz_tenant_fill — BEFORE INSERT → private.tenant_fill()
- zz_tenant_guard — BEFORE UPDATE OF tenant_id → private.tenant_guard()

## Grants
- anon: siud · authenticated: siud (s=select i=insert u=update d=delete)
