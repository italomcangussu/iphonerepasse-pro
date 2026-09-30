# public.crm_ui_preferences
> tabela · RLS on · ~0 linhas

## Colunas
| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| id | uuid | não | `gen_random_uuid()` |  |
| store_id | text | não |  |  |
| user_id | uuid | não |  |  |
| last_page | text | sim |  |  |
| last_tab | text | sim |  |  |
| saved_filters | jsonb | não | `'{}'::jsonb` |  |
| density | text | não | `'comfortable'::text` |  |
| created_at | timestamp with time zone | não | `now()` |  |
| updated_at | timestamp with time zone | não | `now()` |  |

## Chaves e restrições
- PK (id)
- UNIQUE (store_id, user_id)
- CHECK crm_ui_preferences_density_check: `CHECK ((density = ANY (ARRAY['comfortable'::text, 'compact'::text])))`

## Índices
- crm_ui_preferences_store_user_unique: `btree (store_id, user_id)` único
- idx_crm_ui_preferences_store_user: `btree (store_id, user_id)`

## Políticas RLS
- "crm_ui_preferences_owner_access" — ALL para public · using `((( SELECT auth.role() AS role) = 'authenticated'::text) AND (user_id = ( SELECT auth.uid() AS uid)))` · check `((( SELECT auth.role() AS role) = 'authenticated'::text) AND (user_id = ( SELECT auth.uid() AS uid)))`
- "crm_ui_preferences_store_scope" — ALL para authenticated · using `(crm_can_access_store(store_id) AND (user_id = ( SELECT auth.uid() AS uid)))` · check `(crm_can_access_store(store_id) AND (user_id = ( SELECT auth.uid() AS uid)))`

## Gatilhos
- crm_ui_preferences_updated_at — BEFORE UPDATE → public.crm_ui_preferences_set_updated_at()
- trg_crm_ui_preferences_set_updated_at — BEFORE UPDATE → public.crm_set_updated_at()

## Grants
- anon: siud · authenticated: siud (s=select i=insert u=update d=delete)
