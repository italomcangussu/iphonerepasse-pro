# public.user_consents
> tabela · RLS on · ~<100 linhas

## Colunas
| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| id | uuid | não | `gen_random_uuid()` |  |
| user_id | uuid | não |  |  |
| consent_key | text | não |  |  |
| granted | boolean | não |  |  |
| policy_version | text | não |  |  |
| granted_at | timestamp with time zone | não | `now()` |  |
| revoked_at | timestamp with time zone | sim |  |  |
| user_agent | text | sim |  |  |

## Chaves e restrições
- PK (id)
- FK (user_id) → auth.users(id) on delete cascade
- UNIQUE (user_id, consent_key, policy_version)

## Índices
- user_consents_key_idx: `btree (user_id, consent_key)`
- user_consents_user_id_idx: `btree (user_id)`
- user_consents_user_key: `btree (user_id, consent_key, policy_version)` único

## Políticas RLS
- "user_consents_insert_own" — INSERT para authenticated · check `(( SELECT auth.uid() AS uid) = user_id)`
- "user_consents_select_own" — SELECT para authenticated · using `(( SELECT auth.uid() AS uid) = user_id)`
- "user_consents_update_own" — UPDATE para authenticated · using `(( SELECT auth.uid() AS uid) = user_id)` · check `(( SELECT auth.uid() AS uid) = user_id)`

## Grants
- anon: — · authenticated: siu (s=select i=insert u=update d=delete)
