# public.crm_dispatch_runtime
> tabela · RLS on · ~0 linhas

## Colunas
| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| id | text | não |  |  |
| worker_name | text | não |  |  |
| last_run_at | timestamp with time zone | sim |  |  |
| lock_until | timestamp with time zone | sim |  |  |
| metadata | jsonb | não | `'{}'::jsonb` |  |
| updated_at | timestamp with time zone | não | `now()` |  |

## Chaves e restrições
- PK (id)
- UNIQUE (worker_name)

## Índices
- crm_dispatch_runtime_worker_name_key: `btree (worker_name)` único

## Políticas RLS
- "crm_dispatch_runtime_admin_scope" — ALL para authenticated · using `("current_role"() = 'admin'::text)` · check `("current_role"() = 'admin'::text)`

## Gatilhos
- trg_crm_dispatch_runtime_set_updated_at — BEFORE UPDATE → public.crm_set_updated_at()

## Grants
- anon: siud · authenticated: siud (s=select i=insert u=update d=delete)
