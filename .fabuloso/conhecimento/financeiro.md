# Financeiro

Leia antes de mexer em `pages/Finance.tsx`, `pages/finance/` ou `lib/finance/accountSummary.ts`.

## Filtro de tipo do extrato (abas Conta Bancária e Cofre)
- O filtro aceita `'all'`, `CATEGORY_FILTER_ALL_INCOME` (`'__all_income__'`), `CATEGORY_FILTER_ALL_EXPENSE` (`'__all_expense__'`) ou o nome de uma categoria.
- Lógica em `lib/finance/accountSummary.ts` (`matchesCategoryFilter`, `summarizeByCategory`), com testes.

## Card "Por tipo" (`pages/finance/CategoryBreakdownCard.tsx`)
- Agrupa o extrato do PERÍODO (conta + datas, sem o filtro de tipo; `getPeriodTransactionsForAccount` em `Finance.tsx`) por categoria, receitas e despesas, maior total primeiro, com % do lado e nº de lançamentos.
- Tocar num tipo ou no total do lado filtra o extrato; tocar de novo limpa. Top 5 por lado com "Ver mais".
- Transferências internas contam como receita/despesa (mesma regra dos cards de resumo).

## Convenções de UI
- Dinheiro sempre por `formatCurrencyBRL` (centavos); negativo com sinal tipográfico à frente via `formatSignedBRL` local ("−R$ 10,00").
- Resumos (conta, devedores, dívidas) são lista compacta (`AccountSummaryCard` em linhas no celular, 3 colunas em md+); valor zero em cor neutra.
- Verde de texto é `text-green-700 dark:text-green-400` (green-600 falha contraste).

## Dívida técnica
- `pages/Finance.tsx` segue um componente gigante (~1800 linhas, complexidade 70): candidato a ser quebrado por aba em `pages/finance/`.
