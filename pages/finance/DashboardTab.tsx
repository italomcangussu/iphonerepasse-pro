import React from 'react';
import type { StockItem } from '../../types';
import { ConsolidatedBalancesCard, PayableDebtAlert, StockValueCards } from './DashboardSections';
import { useStockFinanceStats } from './useStockFinanceStats';

interface DashboardTabProps {
  stock: StockItem[];
  debtSummary: { openAmount: number };
  payableDebtSummary: { openAmount: number };
  bankBalance: number;
  safeBalance: number;
}

const DashboardTab: React.FC<DashboardTabProps> = ({ stock, debtSummary, payableDebtSummary, bankBalance, safeBalance }) => {
  const stats = useStockFinanceStats(stock);

  return (
    <div className="space-y-6">
      {/* Saldos primeiro: é o que o dono abre o Financeiro para ver. */}
      <ConsolidatedBalancesCard
        stats={stats}
        debtorsOpenAmount={debtSummary.openAmount}
        payableOpenAmount={payableDebtSummary.openAmount}
        bankBalance={bankBalance}
        safeBalance={safeBalance}
      />
      {payableDebtSummary.openAmount > 0 && (
        <PayableDebtAlert openAmount={payableDebtSummary.openAmount} />
      )}
      <StockValueCards stats={stats} />
    </div>
  );
};

export default DashboardTab;
