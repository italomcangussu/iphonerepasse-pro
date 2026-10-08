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
- "creditors_admin_all" — ALL para authenticated · using `("current_role"() = 'admin'::text)` · check `("current_role"() = 'admin'::text)`

## Gatilhos
- set_creditors_updated_at — BEFORE UPDATE → public.tg_set_creditors_updated_at()

## Grants
- anon: siud · authenticated: siud (s=select i=insert u=update d=delete)
