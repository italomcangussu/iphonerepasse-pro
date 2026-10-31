import type { useData } from '../../services/dataContext';
import type { Debt, FinancialAccount, Transaction } from '../../types';
import { isDebtOverdue } from '../../utils/debts';
import { toFiniteNumber } from '../../utils/number';
import { ACCOUNT_BANK, ACCOUNT_DEBTORS, ACCOUNT_SAFE } from '../../utils/financialAccounts';
import { formatCurrencyBRL } from '../../utils/inputMasks';

export type TabType = 'dashboard' | 'bank' | 'safe' | 'debtors' | 'payable_debts' | 'faturamento';

// Categorias criadas e mantidas pelas RPCs de reserva (sinal do aparelho): o
// valor e a conta delas vêm da reserva, não de um lançamento avulso. Ficam
// fora do formulário manual — escolhê-las à mão gerava lançamentos com cara
// de sinal sem reserva nenhuma por trás. Continuam visíveis no extrato, nos
// filtros e ao editar um lançamento que já as usa.
export const RESERVATION_MANAGED_CATEGORIES = ['Adiantamento de reserva', 'Estorno de reserva'];

export const isManualCategory = (name: string) => !RESERVATION_MANAGED_CATEGORIES.includes(name);

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
export const getTransactionDescription = (
  transaction: Transaction,
  sales: ReturnType<typeof useData>['sales'],
  sellers: ReturnType<typeof useData>['sellers'],
  customers: ReturnType<typeof useData>['customers'],
  debts: ReturnType<typeof useData>['debts']
): string => {
  const description = transaction.description;

  // Comissão → nome do vendedor.
  if (transaction.category === 'Comissão' && transaction.saleId) {
    const sale = sales.find((entry) => entry.id === transaction.saleId);
    const seller = sale ? sellers.find((entry) => entry.id === sale.sellerId) : undefined;
    return seller?.name ? `Comissão recebida pelo vendedor ${seller.name}` : description;
  }

  // Quitação de dívida → nome do cliente (descrição termina com o id da dívida).
  const debtMatch = /^Quitação de dívida - (.+)$/.exec(description);
  if (debtMatch) {
    const debt = debts.find((entry) => entry.id === debtMatch[1]);
    const customer = debt ? customers.find((entry) => entry.id === debt.customerId) : undefined;
    return customer?.name ? `Quitação de dívida - ${customer.name}` : description;
  }

  // Venda/Entrada de troca → troca o id da venda no fim da descrição pelo nome do cliente,
  // preservando o rótulo e os detalhes técnicos (ex.: "Venda (Cartão) liquido=...").
  if (transaction.saleId) {
    const suffix = ` - ${transaction.saleId}`;
    if (description.endsWith(suffix)) {
      const sale = sales.find((entry) => entry.id === transaction.saleId);
      const customer = sale ? customers.find((entry) => entry.id === sale.customerId) : undefined;
      if (customer?.name) {
        return `${description.slice(0, description.length - suffix.length)} - ${customer.name}`;
      }
    }
  }

  return description;
};

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
export const buildAccountStatementCsv = (
  account: FinancialAccount,
  rows: Transaction[],
  describe: (transaction: Transaction) => string
): { fileName: string; rows: string[][] } => {
  const safeAccount = account
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-');

  return {
    fileName: `extrato-${safeAccount}.csv`,
    rows: [
      ['Data', 'Conta', 'Tipo', 'Categoria', 'Descrição', 'Valor'],
      ...rows.map((transaction) => [
        new Date(transaction.date).toLocaleDateString('pt-BR'),
        transaction.account,
        transaction.type === 'IN' ? 'Entrada' : 'Saída',
        transaction.category,
        describe(transaction),
        toFiniteNumber(transaction.amount).toFixed(2).replace('.', ',')
      ])
    ]
  };
};
