# Financeiro

Leia antes de mexer em `pages/Finance.tsx`, `pages/finance/` ou `lib/finance/accountSummary.ts`.

## Filtro de tipo do extrato (abas Conta Bancária e Cofre)
- O filtro aceita `'all'`, `CATEGORY_FILTER_ALL_INCOME` (`'__all_income__'`), `CATEGORY_FILTER_ALL_EXPENSE` (`'__all_expense__'`) ou o nome de uma categoria.
- Lógica em `lib/finance/accountSummary.ts` (`matchesCategoryFilter`, `summarizeByCategory`), com testes.

## Card "Por tipo" (`pages/finance/CategoryBreakdownCard.tsx`)
- Agrupa o extrato do PERÍODO (conta + datas, sem o filtro de tipo; `getPeriodTransactionsForAccount` em `Finance.tsx`) por categoria, receitas e despesas, maior total primeiro, com % do lado e nº de lançamentos.
- Começa RECOLHIDO (não guarda o estado): o cabeçalho mostra, por lado, nº de tipos e o maior com % (não repete os totais, que já estão no resumo acima). O chip "Limpar filtro" aparece mesmo recolhido.
- Tocar num tipo ou no total do lado filtra o extrato; tocar de novo limpa. Top 5 por lado com "Ver mais".
- Transferências internas contam como receita/despesa (mesma regra dos cards de resumo).

## Convenções de UI
- Dinheiro sempre por `formatCurrencyBRL` (centavos); negativo com sinal tipográfico à frente via `formatSignedBRL` local ("−R$ 10,00").
- Resumos (conta, devedores, dívidas) são lista compacta (`AccountSummaryCard` em linhas no celular, 3 colunas em md+); valor zero em cor neutra.
- Verde de texto é `text-green-700 dark:text-green-400` (green-600 falha contraste).

## Estrutura da tela (`pages/Finance.tsx` ~250 linhas, só monta)
- `Finance.tsx` guarda `activeTab`, saldos por conta, filtros de estoque, `selectedTransaction` e as páginas; compõe hooks e abas.
- Abas em `pages/finance/`: `DashboardTab` (+ `DashboardSections`, `useStockFinanceStats`), `DebtorsTab` (+ `useCustomerDebtsView`), `AccountTab` (Conta/Cofre/Devedores: resumo, Por tipo, `BalanceCard`, `StatementCard`) + `TransactionStatement`, `PayableDebtsTab` (+ `usePayableDebtsView`), `FaturamentoTab` (cálculo em `lib/finance/salesReport.ts`: `buildSalesReport`/`summarizeSalesReport`/`toSalesReportRow`, testado).
- `PeriodFilterCard`: período + filtro de tipo. Modais: `TransactionFormModal`, `TransactionDetailsModal`, `TransferModal`.
- Hooks: `useTransactionEditor` (aporte/pagamento, aviso de saldo negativo), `useAccountTransfer`, `useAccountStatement` (período, filtro de tipo, resumo, Por tipo, exportar CSV), `useTransactionActions` (ver/editar/cancelar com estorno explicado).
- Funções puras em `financeHelpers.ts` (`formatSignedBRL`, `getTransactionDescription(transaction, {sales,sellers,customers,debts})`, `buildCancelTransactionMessage`, `buildAccountStatementCsv`, `summarizeCustomerDebts`, `debtStatusBadgeClass`, `formatDueDate`) e `periodRange.ts` (`DatePreset`, `getEffectiveDateRange`, `isInDateRange`), testadas em `financeHelpers.test.ts`.
- Regra: estado que precisa sobreviver à troca de aba (páginas, filtros) fica em `Finance.tsx` ou nos hooks chamados por ele, não dentro das abas (que desmontam).

## Data e hora nas listas
- Momento (lançamento, venda, pagamento, criação de dívida) usa `formatDateTimeBRL` (`utils/inputMasks.ts`); prazo/vencimento usa `formatDateBRL`.
- Extrato: celular mostra "31/10/2026 · 14:32"; tabela tem coluna fixa "Data e hora" (hora embaixo). CSV do extrato: Data, Hora, Conta, Tipo, Categoria, Descrição, Valor.
- Detalhe do lançamento mostra "Registrado em" quando `createdAt` difere de `date` em mais de 1 minuto.
- Faturamento mostra data e hora, cliente e vendedor (`Finance` passa `customers`/`sellers` ao `FaturamentoTab`); lucro negativo em vermelho com sinal.
- Devedores e Dívidas Ativas mostram "de R$ original" e "Criada em".
- Descrição do extrato (lista, detalhe e CSV) passa por `getTransactionDescription`: troca ids pelo nome do cliente/vendedor e `humanizeSaleFeeDescription` traduz "liquido=… bruto=… taxa=…" (gravado pelo banco) em "cliente pagou R$ X · taxa R$ Y". O lançamento guardado não muda; o `TransactionStatement` recebe `describeTransaction` só para exibir.
