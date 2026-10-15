# public.care_contract_documents
> tabela · RLS on · ~0 linhas

## Colunas
| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| id | uuid | não | `gen_random_uuid()` |  |
| contract_id | uuid | não |  |  |
| version | integer | não |  |  |
| storage_path | text | não |  |  |
| sha256 | text | não |  |  |
| size_bytes | integer | não |  |  |
| clauses_version | text | não |  |  |
| acceptance_text_version | text | não |  |  |
| status | text | não | `'emitido'::text` |  |
| issued_at | timestamp with time zone | não | `now()` |  |
| issued_by | uuid | sim |  |  |
| signed_at | timestamp with time zone | sim |  |  |
| signed_pdf_path | text | sim |  |  |
| signed_pdf_sha256 | text | sim |  |  |
| evidence_path | text | sim |  |  |
| evidence_sha256 | text | sim |  |  |

## Chaves e restrições
- PK (id)
- FK (contract_id) → public.care_contracts(id) on delete restrict
- UNIQUE (contract_id, version)
- CHECK care_contract_documents_evidence_sha256_check: `CHECK (((evidence_sha256 IS NULL) OR (evidence_sha256 ~ '^[0-9a-f]{64}$'::text)))`
- CHECK care_contract_documents_sha256_check: `CHECK ((sha256 ~ '^[0-9a-f]{64}$'::text))`
- CHECK care_contract_documents_signed_pdf_sha256_check: `CHECK (((signed_pdf_sha256 IS NULL) OR (signed_pdf_sha256 ~ '^[0-9a-f]{64}$'::text)))`
- CHECK care_contract_documents_size_bytes_check: `CHECK ((size_bytes > 0))`
- CHECK care_contract_documents_status_check: `CHECK ((status = ANY (ARRAY['emitido'::text, 'substituido'::text, 'assinado'::text])))`
- CHECK care_contract_documents_version_check: `CHECK ((version >= 1))`

## Referenciada por (2)
public.care_signature_events.document_id, public.care_signature_sessions.document_id

## Índices
- care_contract_documents_contract_id_version_key: `btree (contract_id, version)` único

## Políticas RLS
- "care_contract_documents_select" — SELECT para authenticated · using `(( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text]))`

## Gatilhos
- care_contract_documents_guard — BEFORE DELETE OR UPDATE → private.care_document_guard()

## Grants
- anon: — · authenticated: s (s=select i=insert u=update d=delete)
