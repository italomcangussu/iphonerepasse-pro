# public.crm_follow_up_tracker
> tabela · RLS on · ~0 linhas

## Colunas
| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| id | uuid | não | `gen_random_uuid()` |  |
| lead_id | text | não |  |  |
| automation_rule_id | uuid | sim |  |  |
| attempt_count | integer | sim | `0` |  |
| last_attempt_at | timestamp with time zone | sim |  |  |
| next_attempt_at | timestamp with time zone | sim |  |  |
| max_attempts | integer | sim |  |  |
| is_completed | boolean | sim | `false` |  |
| completed_at | timestamp with time zone | sim |  |  |
| completion_reason | text | sim |  |  |
| created_at | timestamp with time zone | sim | `now()` |  |

## Chaves e restrições
- PK (id)
- FK (lead_id) → public.crm_leads(id) on delete cascade

## Políticas RLS
- "crm_follow_up_tracker_store_scope" — ALL para authenticated · using `(EXISTS ( SELECT 1 FROM crm_leads cl WHERE ((cl.id = crm_follow_up_tracker.lead_id) AND crm_can_access_store(cl.store_id))))` · check `(EXISTS ( SELECT 1 FROM crm_leads cl WHERE ((cl.id = crm_follow_up_tracker.lead_id) AND crm_can_access_store(cl.store_id))))`

## Grants
- anon: siud · authenticated: siud (s=select i=insert u=update d=delete)
