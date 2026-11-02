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
- Navegação em dois níveis (`FINANCE_TAB_GROUPS`): Dashboard · Caixa (Conta Bancária, Cofre) · Dívidas (Devedores, Dívidas Ativas) · Faturamento. O grupo com mais de uma visão mostra uma segunda linha; voltar ao grupo reabre a última visão dele. Testes abrem uma visão com `openFinanceTab` (`tests/openFinanceTab.ts`), que clica `finance-group-*` e depois `finance-tab-*`.
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

## Pagamento de pessoal (salário e serviço semanal)
- Categorias OUT `Salário semanal` (`cat_salario_semanal`) e `Serviço semanal` (`cat_servico_semanal`). Funcionário = tabela `sellers`. O lançamento guarda quem recebeu em `transactions.payee_seller_id` (FK `sellers`, `on delete set null`, índice parcial), exposto como `Transaction.payeeSellerId`; `dataContext` grava no insert e no update (só se definido). Migration `20261101120000_transactions_payee_seller.sql`.
- `financeHelpers.ts`: `PAYROLL_CATEGORIES`, `isPayrollCategory`, `formatPaymentWeek` (segunda a domingo), `buildPayrollDescription` ("Salário semanal · NOME · semana 26/10 a 01/11"), `isAutoDescription`, `resolvePayeeName` ("Funcionário removido" se o vendedor foi apagado). `buildAccountStatementCsv` recebe `{ describe, payeeOf }` e tem coluna "Funcionário".
- `TransactionFormModal` recebe `sellers`: em categoria de pessoal mostra o select obrigatório "Funcionário" e reescreve a descrição só enquanto ela for automática (texto digitado é mantido). `useTransactionEditor` bloqueia salvar sem funcionário. Extrato (`TransactionStatement` `payeeNameOf`) e detalhe (`payeeName`) mostram o nome.
- Histórico migrado (`20261101130000_migrate_legacy_payroll_categories.sql`, aplicada no remoto em 2026-11-01: 102 lançamentos, 61 salário e 41 serviço): 'PAGAMENTO FOLHA SEMANAL <nome>' virou `Salário semanal` e 'PAGAMENTO SERVIÇO <nome>' virou `Serviço semanal`, com `payee_seller_id` por mapa explícito de ids; as 10 categorias antigas foram apagadas. 'PAGAMENTO COMISSÃO <nome>' ficou como estava.
- Teste de banco: `supabase/tests/pglite/transactions_payee.sql`.

## Atraso de devedores e dívidas a pagar (pelas parcelas)
- Núcleo em `utils/debtCore.ts` / `utils/debts.ts`: parcelas mensais e iguais a partir do 1º vencimento (dia 31 cai no último dia do mês). `getDebtLikeSchedule` devolve `amountDue`, `paidAmount`, `overdueAmount`, `nextDueDate` ('YYYY-MM-DD').
- Atrasado só se o pago (original − saldo) não cobre as parcelas vencidas (tolerância de 1 centavo). Selo calculado: `Atrasado`; `Em dias` (há parcela vencida e está coberta); `Em aberto` (nada venceu).
- Dívida de cliente: `customBadge` manual manda na cor. 'Atrasado' é vermelho (se não quitada); 'Em dias', 'Pago' e 'Em aberto' nunca ficam vermelhos. `calculateDebtSummary` usa a mesma regra. Dívidas a pagar usam o mesmo núcleo, sem `customBadge`.
- O card (`pages/debtors/DebtScheduleHint.tsx`) mostra uma linha: próxima parcela; "R$ X em atraso · parcela de ..."; ou "Marcado em dias · pelas parcelas faltam R$ X". Testes em `utils/debts.test.ts`.

## Entrega no remoto neste projeto
- O conector Supabase MCP nega permissão e não há URL de banco para `psql`. A entrega de migrations foi feita pela Management API com `SUPABASE_ACCESS_TOKEN` do `.env.local` (nunca exibir o valor).
