import { useMemo } from 'react';
import { StockStatus } from '../../types';
import type { StockItem } from '../../types';
import { computeInventoryValuation } from '../../utils/inventoryValuation';
import { toFiniteNumber } from '../../utils/number';

// Valores do estoque para o Dashboard do Financeiro.
export const useStockFinanceStats = (stock: StockItem[]) => {
  const inUseStats = useMemo(
    () => computeInventoryValuation(stock.filter((s) => s.status === StockStatus.IN_USE)),
    [stock]
  );

  // Reservado ainda é estoque da loja (a venda só acontece — ou não — depois),
  // então entra nas projeções junto com Disponível/Em Preparação.
  const stockStats = useMemo(() => {
    const inStore = stock.filter(
      (s) =>
        s.status === StockStatus.AVAILABLE ||
        s.status === StockStatus.PREPARATION ||
        s.status === StockStatus.RESERVED
    );
    const valuation = computeInventoryValuation(inStore);
    return { ...valuation, projectedProfit: valuation.salesValue - valuation.acquisitionCost };
  }, [stock]);

  const reservedStats = useMemo(
    () => computeInventoryValuation(stock.filter((s) => s.status === StockStatus.RESERVED)),
    [stock]
  );

  // Sinais de reservas ativas: o adiantamento já entrou na Conta/Cofre, mas o
  // aparelho continua valendo cheio no Saldo Aparelhos — deduzir do total evita
  // contar o mesmo dinheiro duas vezes até a venda (ou o estorno) acontecer.
  const reservationDepositSummary = useMemo(() => {
    let amount = 0;
    let count = 0;
    stock.forEach((item) => {
      if (item.reservation?.status !== 'active') return;
      const deposit = toFiniteNumber(item.reservation.depositAmount);
      if (deposit <= 0) return;
      amount += deposit;
      count += 1;
    });
    return { amount, count };
  }, [stock]);

  return { inUseStats, stockStats, reservedStats, reservationDepositSummary };
};

export type StockFinanceStats = ReturnType<typeof useStockFinanceStats>;
