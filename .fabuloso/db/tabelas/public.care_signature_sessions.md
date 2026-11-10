# public.care_signature_sessions
> tabela · RLS on · ~0 linhas

## Colunas
| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| id | uuid | não | `gen_random_uuid()` |  |
| contract_id | uuid | não |  |  |
| document_id | uuid | não |  |  |
| access_token_hash | text | não |  |  |
| phone | text | não |  |  |
| status | text | não | `'aberta'::text` |  |
| link_expires_at | timestamp with time zone | não |  |  |
| otp_verifier | text | sim |  |  |
| otp_expires_at | timestamp with time zone | sim |  |  |
| otp_attempts | integer | não | `0` |  |
| otp_sends | integer | não | `0` |  |
| otp_last_sent_at | timestamp with time zone | sim |  |  |
| accepted_at | timestamp with time zone | sim |  |  |
| acceptance_text_version | text | sim |  |  |
| signed_at | timestamp with time zone | sim |  |  |
| created_by | uuid | sim |  |  |
| created_at | timestamp with time zone | não | `now()` |  |
| tenant_id | uuid | não |  |  |

## Chaves e restrições
- PK (id)
- FK (contract_id) → public.care_contracts(id) on delete restrict
- FK (document_id) → public.care_contract_documents(id) on delete restrict
- FK (tenant_id) → public.tenants(id)
- UNIQUE (access_token_hash)
- CHECK care_signature_sessions_access_token_hash_check: `CHECK ((access_token_hash ~ '^[0-9a-f]{64}$'::text))`
- CHECK care_signature_sessions_status_check: `CHECK ((status = ANY (ARRAY['aberta'::text, 'aceita'::text, 'assinada'::text, 'expirada'::text, 'revogada'::text, 'bloqueada'::text])))`

## Referenciada por (1)
public.care_signature_events.session_id

## Índices
- care_signature_sessions_access_token_hash_key: `btree (access_token_hash)` único
- care_signature_sessions_contract_idx: `btree (contract_id)`
- care_signature_sessions_document_idx: `btree (document_id)`
- care_signature_sessions_one_open: `btree (contract_id) WHERE (status = ANY (ARRAY['aberta'::text, 'aceita'::text]))` único
- care_signature_sessions_tenant_idx: `btree (tenant_id)`

## Políticas RLS
- "tenant_isolation" — ALL para authenticated (restritiva) · using `(tenant_id = ( SELECT current_tenant_id() AS current_tenant_id))` · check `(tenant_id = ( SELECT current_tenant_id() AS current_tenant_id))`

## Gatilhos
- zz_tenant_fill — BEFORE INSERT → private.tenant_fill()
- zz_tenant_guard — BEFORE UPDATE OF tenant_id → private.tenant_guard()

## Grants
- anon: — · authenticated: — (s=select i=insert u=update d=delete)
