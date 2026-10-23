# public.creditors
> tabela · RLS on · ~0 linhas

## Colunas
| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| id | text | não |  |  |
| name | text | não |  |  |
| document | text | sim |  |  |
| document_type | text | sim |  |  |
| phone | text | sim |  |  |
| email | text | sim |  |  |
| notes | text | sim |  |  |
| created_at | timestamp with time zone | não | `now()` |  |
| updated_at | timestamp with time zone | não | `now()` |  |

## Chaves e restrições
- PK (id)
- CHECK creditors_document_type_check: `CHECK ((document_type = ANY (ARRAY['CPF'::text, 'CNPJ'::text])))`

## Referenciada por (1)
public.payable_debts.creditor_id

## Índices
- idx_creditors_name: `btree (name)`

## Políticas RLS
- "creditors_delete" — DELETE para authenticated · using `( SELECT has_app_permission('payable_debts'::text, 'deletable'::text) AS has_app_permission)`
- "creditors_insert" — INSERT para authenticated · check `( SELECT has_app_permission('payable_debts'::text, 'editable'::text) AS has_app_permission)`
- "creditors_select" — SELECT para authenticated · using `( SELECT has_app_permission('payable_debts'::text, 'visible'::text) AS has_app_permission)`
- "creditors_update" — UPDATE para authenticated · using `( SELECT has_app_permission('payable_debts'::text, 'editable'::text) AS has_app_permission)` · check `( SELECT has_app_permission('payable_debts'::text, 'editable'::text) AS has_app_permission)`

## Gatilhos
- set_creditors_updated_at — BEFORE UPDATE → public.tg_set_creditors_updated_at()

## Grants
- anon: siud · authenticated: siud (s=select i=insert u=update d=delete)
