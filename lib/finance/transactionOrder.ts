import type { Transaction } from '../../types';

// Chave numérica do dia local (yyyymmdd) usada para agrupar o extrato pela mesma
// data exibida na coluna "Data".
export const localDayKey = (dateStr: string): number => {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return 0;
  return d.getFullYear() * 10000 + d.getMonth() * 100 + d.getDate();
};

// Ordena o extrato do mais recente para o mais antigo mantendo o agrupamento por
// dia (a coluna "Data" fica monotônica) e, dentro do mesmo dia, desempata pelo
// horário real de criação (createdAt) em vez do id aleatório.
//
// Motivo: `transaction.date` guarda uma "data de negócio" (data da venda, paid_at
// ao meio-dia, etc.) que não reflete o horário real em que o lançamento foi
// feito, então lançamentos do mesmo dia saíam fora de ordem. `createdAt` registra
// o instante real de inserção; sem ele, `date` serve de fallback.
export const compareTransactionsChronologically = (
  a: Pick<Transaction, 'date' | 'createdAt'>,
  b: Pick<Transaction, 'date' | 'createdAt'>
): number => {
  const dayDiff = localDayKey(b.date) - localDayKey(a.date);
  if (dayDiff !== 0) return dayDiff;
  return new Date(b.createdAt ?? b.date).getTime() - new Date(a.createdAt ?? a.date).getTime();
};
