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
