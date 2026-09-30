# public.reservation_message_settings
> tabela · RLS on · ~0 linhas

## Colunas
| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| id | text | não | `'default'::text` |  |
| template | text | não | `''::text` |  |
| send_by_default | boolean | não | `true` |  |
| created_at | timestamp with time zone | não | `now()` |  |
| updated_at | timestamp with time zone | não | `now()` |  |

## Chaves e restrições
- PK (id)
- CHECK reservation_message_settings_id_check: `CHECK ((id = 'default'::text))`

## Políticas RLS
- "reservation_message_settings_admin_all" — ALL para authenticated · using `("current_role"() = 'admin'::text)` · check `("current_role"() = 'admin'::text)`
- "reservation_message_settings_read" — SELECT para authenticated · using `true`

## Gatilhos
- reservation_message_settings_touch — BEFORE UPDATE → public.touch_reservation_message_settings()

## Grants
- anon: siud · authenticated: siud (s=select i=insert u=update d=delete)
