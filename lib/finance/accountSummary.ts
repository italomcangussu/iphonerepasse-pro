import type { Transaction } from '../../types';
import { toFiniteNumber } from '../../utils/number';

export interface AccountTransactionSummary {
  totalIn: number;
  totalOut: number;
  net: number;
}

export const EMPTY_ACCOUNT_TRANSACTION_SUMMARY: AccountTransactionSummary = {
  totalIn: 0,
  totalOut: 0,
  net: 0
};

// Soma entradas e saídas de um extrato de conta JÁ FILTRADO (conta, período e categoria).
//
// Transferências internas (Cofre <-> Conta Bancária) entram na soma de propósito: estes
// números resumem o extrato exibido logo abaixo dos cards, então quem somar as linhas
// visíveis tem que chegar exatamente ao mesmo total. É por isso que o card do líquido se
// chama "Movimentação Líquida" e não "Resultado do Período": ele mede caixa que entrou e
// saiu da conta, não lucro. Uma transferência de R$ 10.000 do Cofre para o banco aparece
// como saída de 10.000 no Cofre e entrada de 10.000 no banco — correto como fluxo de
// caixa por conta, e enganoso se lido como DRE.
export const summarizeAccountTransactions = (rows: Transaction[]): AccountTransactionSummary => {
  let totalIn = 0;
  let totalOut = 0;

  for (const transaction of rows) {
    const amount = toFiniteNumber(transaction.amount);
    if (transaction.type === 'IN') {
      totalIn += amount;
    } else {
      totalOut += amount;
    }
  }

  return { totalIn, totalOut, net: totalIn - totalOut };
};

// Filtro de tipo do extrato: uma categoria específica ou um dos agrupadores abaixo.
export const CATEGORY_FILTER_ALL = 'all';
export const CATEGORY_FILTER_ALL_INCOME = '__all_income__';
export const CATEGORY_FILTER_ALL_EXPENSE = '__all_expense__';

export const matchesCategoryFilter = (transaction: Transaction, filter: string): boolean => {
  if (filter === CATEGORY_FILTER_ALL) return true;
  if (filter === CATEGORY_FILTER_ALL_INCOME) return transaction.type === 'IN';
  if (filter === CATEGORY_FILTER_ALL_EXPENSE) return transaction.type === 'OUT';
  return transaction.category === filter;
};

export interface CategoryTotal {
  category: string;
  total: number;
  count: number;
  // Fração (0–1) do total do mesmo lado (receitas ou despesas).
  share: number;
}

export interface CategoryBreakdown {
  IN: CategoryTotal[];
  OUT: CategoryTotal[];
}

const rankCategories = (totals: Map<string, { total: number; count: number }>): CategoryTotal[] => {
  const sideTotal = Array.from(totals.values()).reduce((acc, entry) => acc + entry.total, 0);
  return Array.from(totals, ([category, { total, count }]) => ({
    category,
    total,
    count,
    share: sideTotal > 0 ? total / sideTotal : 0
  })).sort((a, b) => b.total - a.total || a.category.localeCompare(b.category, 'pt-BR'));
};

// Agrupa um extrato JÁ FILTRADO por categoria, separando receitas e despesas,
// do maior total para o menor.
export const summarizeByCategory = (rows: Transaction[]): CategoryBreakdown => {
  const sides = { IN: new Map<string, { total: number; count: number }>(), OUT: new Map<string, { total: number; count: number }>() };

  for (const transaction of rows) {
    const category = transaction.category?.trim() || 'Sem categoria';
    const side = sides[transaction.type === 'IN' ? 'IN' : 'OUT'];
    const entry = side.get(category) ?? { total: 0, count: 0 };
    entry.total += toFiniteNumber(transaction.amount);
    entry.count += 1;
    side.set(category, entry);
  }

  return { IN: rankCategories(sides.IN), OUT: rankCategories(sides.OUT) };
};
