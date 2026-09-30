# public.crm_lead_stage_history
> tabela · RLS on · ~0 linhas

## Colunas
| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| id | uuid | não | `gen_random_uuid()` |  |
| lead_id | text | não |  |  |
| from_stage | text | sim |  |  |
| to_stage | text | sim |  |  |
| changed_by | uuid | sim |  |  |
| notes | text | sim |  |  |
| created_at | timestamp with time zone | sim | `now()` |  |
| store_id | text | sim |  |  |

## Chaves e restrições
- PK (id)
- FK (lead_id) → public.crm_leads(id) on delete cascade

## Índices
- idx_crm_lead_stage_history_lead: `btree (lead_id, created_at DESC)`

## Políticas RLS
- "crm_stage_history_store_scope" — ALL para authenticated · using `crm_can_access_store(store_id)` · check `crm_can_access_store(store_id)`

## Gatilhos
- trg_crm_stage_history_sync_store — BEFORE INSERT OR UPDATE OF lead_id → public.crm_sync_lead_store_to_related_tables()

## Grants
- anon: siud · authenticated: siud (s=select i=insert u=update d=delete)
