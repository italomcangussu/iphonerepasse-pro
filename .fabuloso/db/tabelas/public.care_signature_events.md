# public.care_signature_events
> tabela · RLS on · ~0 linhas

## Colunas
| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| id | bigint | não |  | identity |
| contract_id | uuid | não |  |  |
| session_id | uuid | sim |  |  |
| document_id | uuid | sim |  |  |
| event_type | text | não |  |  |
| occurred_at | timestamp with time zone | não | `now()` |  |
| source | text | não |  |  |
| actor_user_id | uuid | sim |  |  |
| source_ip | text | sim |  |  |
| user_agent | text | sim |  |  |
| whatsapp_message_id | text | sim |  |  |
| geo_permission | text | sim |  |  |
| geo_lat | numeric(9,6) | sim |  |  |
| geo_lon | numeric(9,6) | sim |  |  |
| geo_accuracy_m | numeric(10,2) | sim |  |  |
| geo_captured_at | timestamp with time zone | sim |  |  |
| event_data | jsonb | não | `'{}'::jsonb` |  |
| prev_hash | text | sim |  |  |
| evidence_hash | text | não | `''::text` |  |

## Chaves e restrições
- PK (id)
- FK (contract_id) → public.care_contracts(id) on delete restrict
- FK (document_id) → public.care_contract_documents(id) on delete restrict
- FK (session_id) → public.care_signature_sessions(id) on delete restrict
- CHECK care_signature_events_geo_only_when_granted: `CHECK (((geo_lat IS NULL) OR (geo_permission = 'concedida'::text)))`
- CHECK care_signature_events_geo_permission_check: `CHECK (((geo_permission IS NULL) OR (geo_permission = ANY (ARRAY['concedida'::text, 'nao_compartilhada'::text, 'indisponivel'::text, 'nao_solicitada'::text]))))`
- CHECK care_signature_events_source_check: `CHECK ((source = ANY (ARRAY['assinante'::text, 'sistema'::text, 'painel'::text, 'provedor_whatsapp'::text])))`

## Índices
- care_signature_events_contract_idx: `btree (contract_id, id)`
- care_signature_events_document_idx: `btree (document_id)`
- care_signature_events_session_idx: `btree (session_id)`

## Políticas RLS
- "care_signature_events_admin_select" — SELECT para authenticated · using `(( SELECT "current_role"() AS "current_role") = 'admin'::text)`

## Gatilhos
- care_signature_events_append_only — BEFORE DELETE OR UPDATE → private.care_append_only()
- care_signature_events_chain — BEFORE INSERT → private.care_events_chain()

## Grants
- anon: — · authenticated: s (s=select i=insert u=update d=delete)
