# public.crm_funnel_stages
> tabela · RLS on · ~0 linhas

## Colunas
| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| id | text | não |  |  |
| funnel_type | text | não |  |  |
| name | text | não |  |  |
| color | text | não | `'#64748B'::text` |  |
| order | integer | não | `0` |  |
| is_won | boolean | sim | `false` |  |
| is_lost | boolean | sim | `false` |  |
| is_active | boolean | sim | `true` |  |
| created_at | timestamp with time zone | sim | `now()` |  |
| updated_at | timestamp with time zone | sim | `now()` |  |

## Chaves e restrições
- PK (id)
- CHECK valid_crm_stage_funnel_type: `CHECK ((funnel_type = ANY (ARRAY['sales'::text, 'post_sale'::text])))`

## Índices
- idx_crm_funnel_stages_type_order: `btree (funnel_type, "order")`

## Políticas RLS
- "crm_funnel_stages_delete" — DELETE para authenticated · using `(( SELECT "current_role"() AS "current_role") = 'admin'::text)`
- "crm_funnel_stages_insert" — INSERT para authenticated · check `(( SELECT "current_role"() AS "current_role") = 'admin'::text)`
- "crm_funnel_stages_select" — SELECT para authenticated · using `true`
- "crm_funnel_stages_update" — UPDATE para authenticated · using `(( SELECT "current_role"() AS "current_role") = 'admin'::text)` · check `(( SELECT "current_role"() AS "current_role") = 'admin'::text)`

## Gatilhos
- trg_crm_funnel_stages_set_updated_at — BEFORE UPDATE → public.crm_set_updated_at()

## Grants
- anon: siud · authenticated: siud (s=select i=insert u=update d=delete)
