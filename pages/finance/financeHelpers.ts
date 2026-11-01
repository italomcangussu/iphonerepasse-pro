import type { useData } from '../../services/dataContext';
import type { Debt, FinancialAccount, Transaction } from '../../types';
import { isDebtOverdue } from '../../utils/debts';
import { toFiniteNumber } from '../../utils/number';
import { ACCOUNT_BANK, ACCOUNT_DEBTORS, ACCOUNT_SAFE } from '../../utils/financialAccounts';
import { formatCurrencyBRL, formatMomentDateBRL, formatTimeBRL } from '../../utils/inputMasks';

export type TabType = 'dashboard' | 'bank' | 'safe' | 'debtors' | 'payable_debts' | 'faturamento';

// Categorias criadas e mantidas pelas RPCs de reserva (sinal do aparelho): o
// valor e a conta delas vêm da reserva, não de um lançamento avulso. Ficam
// fora do formulário manual — escolhê-las à mão gerava lançamentos com cara
// de sinal sem reserva nenhuma por trás. Continuam visíveis no extrato, nos
// filtros e ao editar um lançamento que já as usa.
export const RESERVATION_MANAGED_CATEGORIES = ['Adiantamento de reserva', 'Estorno de reserva'];

export const isManualCategory = (name: string) => !RESERVATION_MANAGED_CATEGORIES.includes(name);

// Pagamento de pessoal: o lançamento precisa dizer qual funcionário recebeu.
export const PAYROLL_CATEGORIES = ['Salário semanal', 'Serviço semanal'];

export const isPayrollCategory = (name: string) => PAYROLL_CATEGORIES.includes(name);

const formatDayMonth = (date: Date) =>
  `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;

// Semana de segunda a domingo que contém a data do pagamento ("26/10 a 01/11").
export const formatPaymentWeek = (isoDate: string): string => {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '';
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate() - ((date.getDay() + 6) % 7));
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
  return `${formatDayMonth(monday)} a ${formatDayMonth(sunday)}`;
};

export const buildPayrollDescription = (category: string, payeeName: string, isoDate: string): string => {
  const week = formatPaymentWeek(isoDate);
  return [category, payeeName, week && `semana ${week}`].filter(Boolean).join(' · ');
};

// Descrição que o sistema escreveu sozinho (padrão ou de pessoal) pode ser trocada sem perder nada digitado.
export const isAutoDescription = (description: string, account: FinancialAccount): boolean => {
  const text = description.trim();
  return (
    text === '' ||
    text === buildDefaultTransactionDescription('IN', account) ||
    text === buildDefaultTransactionDescription('OUT', account) ||
    PAYROLL_CATEGORIES.some((category) => text.startsWith(`${category} · `))
  );
};

export const buildDefaultTransactionDescription = (type: 'IN' | 'OUT', account: FinancialAccount) =>
  type === 'IN' ? `Aporte em ${account}` : `Pagamento em ${account}`;

// Valor com sinal de menos tipográfico à frente ("−R$ 10,00" em vez de "R$ -10,00").
export const formatSignedBRL = (value: number): string =>
  value < 0 ? `−${formatCurrencyBRL(Math.abs(value))}` : formatCurrencyBRL(value);

export const getAccountFromTab = (tab: TabType): FinancialAccount => {
  if (tab === 'safe') return ACCOUNT_SAFE;
  if (tab === 'debtors') return ACCOUNT_DEBTORS;
  return ACCOUNT_BANK;
};

export const accountLabelByTab: Record<'bank' | 'safe' | 'debtors', string> = {
  bank: ACCOUNT_BANK,
  safe: ACCOUNT_SAFE,
  debtors: ACCOUNT_DEBTORS
};

export const dedupeCategoriesByType = (
  categories: { name: string; type: 'IN' | 'OUT' }[]
): Record<'IN' | 'OUT', string[]> => {
  const grouped: Record<'IN' | 'OUT', Set<string>> = {
    IN: new Set(),
    OUT: new Set()
  };

  categories.forEach(({ name, type }) => {
    const trimmed = name.trim();
    if (trimmed) grouped[type].add(trimmed);
  });

  return {
    IN: Array.from(grouped.IN).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    OUT: Array.from(grouped.OUT).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  };
};


// Substitui ids crus (SALE-..., DEBT-...) por nomes legíveis nas descrições de
// transações geradas automaticamente pelas RPCs/triggers do banco, evitando que o
// usuário veja "Venda (Trade-in) - sale-1a2b..." em vez de algo inteligível.
export type TransactionNameSources = Pick<ReturnType<typeof useData>, 'sales' | 'sellers' | 'customers' | 'debts'>;

// Comissão → nome do vendedor.
const describeCommission = (transaction: Transaction, { sales, sellers }: TransactionNameSources): string | null => {
  if (transaction.category !== 'Comissão' || !transaction.saleId) return null;
  const sale = sales.find((entry) => entry.id === transaction.saleId);
  const seller = sale ? sellers.find((entry) => entry.id === sale.sellerId) : undefined;
  return seller?.name ? `Comissão recebida pelo vendedor ${seller.name}` : transaction.description;
};

// Quitação de dívida → nome do cliente (descrição termina com o id da dívida).
const describeDebtSettlement = (transaction: Transaction, { debts, customers }: TransactionNameSources): string | null => {
  const debtMatch = /^Quitação de dívida - (.+)$/.exec(transaction.description);
  if (!debtMatch) return null;
  const debt = debts.find((entry) => entry.id === debtMatch[1]);
  const customer = debt ? customers.find((entry) => entry.id === debt.customerId) : undefined;
  return customer?.name ? `Quitação de dívida - ${customer.name}` : transaction.description;
};

// Venda/Entrada de troca → troca o id da venda no fim da descrição pelo nome do cliente,
// preservando o rótulo (ex.: "Venda (Cartão) liquido=..."; os valores são traduzidos depois).
const describeSale = (transaction: Transaction, { sales, customers }: TransactionNameSources): string | null => {
  if (!transaction.saleId) return null;
  const suffix = ` - ${transaction.saleId}`;
  if (!transaction.description.endsWith(suffix)) return null;
  const sale = sales.find((entry) => entry.id === transaction.saleId);
  const customer = sale ? customers.find((entry) => entry.id === sale.customerId) : undefined;
  if (!customer?.name) return null;
  return `${transaction.description.slice(0, transaction.description.length - suffix.length)} - ${customer.name}`;
};

// O banco grava a venda paga com taxa como "Venda (Cartão) liquido=10400 bruto=12288.79 taxa=1888.79 - Cliente".
const SALE_FEE_DESCRIPTION = /^(Venda \([^)]*\)) liquido=[\d.]+ bruto=([\d.]+) taxa=([\d.]+)(?: - (.+))?$/;

// Traduz os valores técnicos para quem lê: quanto o cliente pagou e a taxa da maquininha.
export const humanizeSaleFeeDescription = (description: string): string => {
  const match = SALE_FEE_DESCRIPTION.exec(description);
  if (!match) return description;
  const [, label, gross, fee, customer] = match;
  const head = customer ? `${label} - ${customer}` : label;
  const feeAmount = toFiniteNumber(fee);
  if (feeAmount <= 0) return head;
  return `${head} · cliente pagou ${formatCurrencyBRL(toFiniteNumber(gross))} · taxa ${formatCurrencyBRL(feeAmount)}`;
};

export const getTransactionDescription = (transaction: Transaction, sources: TransactionNameSources): string =>
  humanizeSaleFeeDescription(
    describeCommission(transaction, sources) ??
      describeDebtSettlement(transaction, sources) ??
      describeSale(transaction, sources) ??
      transaction.description
  );

// Totais de recebíveis: em aberto (inclui vencidas), só vencidas e já quitadas.
export const summarizeCustomerDebts = (debts: Debt[]) => {
  let openAmount = 0;
  let overdueAmount = 0;
  let settledAmount = 0;

  debts.forEach((debt) => {
    if (debt.status === 'Quitada') {
      settledAmount += debt.originalAmount;
      return;
    }

    openAmount += debt.remainingAmount;
    if (isDebtOverdue(debt)) {
      overdueAmount += debt.remainingAmount;
    }
  });

  return { openAmount, overdueAmount, settledAmount };
};

type FinanceData = ReturnType<typeof useData>;

const formatPlainAmount = (value: unknown) =>
  toFiniteNumber(value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Texto da confirmação de cancelamento: avisa o que o estorno desfaz junto
// (pagamento de dívida ou a outra perna da transferência).
export const buildCancelTransactionMessage = (
  target: Transaction,
  data: Pick<FinanceData, 'debtPayments' | 'debts' | 'customers' | 'transactions'>
): string => {
  const baseMessage = `Tem certeza que deseja cancelar o lançamento "${target.description}"?`;

  if (target.debtPaymentId) {
    const linkedPayment = data.debtPayments.find((p) => p.id === target.debtPaymentId);
    if (!linkedPayment) return baseMessage;
    const linkedDebt = data.debts.find((d) => d.id === linkedPayment.debtId);
    const customer = linkedDebt ? data.customers.find((c) => c.id === linkedDebt.customerId) : undefined;
    const customerLabel = customer?.name ? ` do cliente ${customer.name}` : '';
    return `${baseMessage} Isso estornará o pagamento${customerLabel} e devolverá R$ ${formatPlainAmount(linkedPayment.amount)} à dívida.`;
  }

  if (!target.transferGroupId) return baseMessage;
  const linkedTransfer = data.transactions.find((t) => t.transferGroupId === target.transferGroupId && t.id !== target.id);
  if (!linkedTransfer) return baseMessage;
  const returnsTo = target.type === 'OUT' ? target.account : linkedTransfer.account;
  const leavesFrom = target.type === 'OUT' ? linkedTransfer.account : target.account;
  return `${baseMessage} Isso estornará a transferência: R$ ${formatPlainAmount(target.amount)} retornará para ${returnsTo} e sairá de ${leavesFrom}.`;
};

// Extrato em CSV (datas e valores no formato brasileiro) e o nome do arquivo.
interface StatementLabels {
  describe: (transaction: Transaction) => string;
  payeeOf?: (transaction: Transaction) => string | undefined;
}

// Nome de quem recebeu um pagamento de pessoal; vínculo para funcionário apagado vira aviso.
export const resolvePayeeName = (transaction: Transaction, sellerNameById: Map<string, string>): string | undefined => {
  if (!transaction.payeeSellerId) return undefined;
  return sellerNameById.get(transaction.payeeSellerId) ?? 'Funcionário removido';
};

export const buildAccountStatementCsv = (
  account: FinancialAccount,
  rows: Transaction[],
  { describe, payeeOf }: StatementLabels
): { fileName: string; rows: string[][] } => {
  const safeAccount = account
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-');

  return {
    fileName: `extrato-${safeAccount}.csv`,
    rows: [
      ['Data', 'Hora', 'Conta', 'Tipo', 'Categoria', 'Funcionário', 'Descrição', 'Valor'],
      ...rows.map((transaction) => [
        formatMomentDateBRL(transaction.date),
        formatTimeBRL(transaction.date),
        transaction.account,
        transaction.type === 'IN' ? 'Entrada' : 'Saída',
        transaction.category,
        payeeOf?.(transaction) ?? '',
        describe(transaction),
        toFiniteNumber(transaction.amount).toFixed(2).replace('.', ',')
      ])
    ]
  };
};

// Cor do selo de situação de uma dívida (a receber ou a pagar).
export const debtStatusBadgeClass = (status: string): string =>
  status === 'Quitada' ? 'ios-badge-green' : status === 'Parcial' ? 'ios-badge-blue' : 'ios-badge-orange';

// Data de vencimento (AAAA-MM-DD) no formato brasileiro, ou "-" sem data.
export const formatDueDate = (isoDate: string | null | undefined): string =>
  isoDate ? new Date(`${isoDate}T00:00:00`).toLocaleDateString('pt-BR') : '-';
