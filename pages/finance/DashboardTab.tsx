import React from 'react';
import type { StockItem } from '../../types';
import { ConsolidatedBalancesCard, InventoryComparisonChart, PayableDebtAlert, StockFilterCard, StockValueCards } from './DashboardSections';
import { useStockFinanceStats } from './useStockFinanceStats';

interface DashboardTabProps {
  stock: StockItem[];
  stockFilterType: string;
  onStockFilterTypeChange: (value: string) => void;
  stockFilterCondition: string;
  onStockFilterConditionChange: (value: string) => void;
  debtSummary: { openAmount: number };
  payableDebtSummary: { openAmount: number; overdueAmount: number };
  bankBalance: number;
  safeBalance: number;
}

const DashboardTab: React.FC<DashboardTabProps> = ({
  stock,
  stockFilterType,
  onStockFilterTypeChange,
  stockFilterCondition,
  onStockFilterConditionChange,
  debtSummary,
  payableDebtSummary,
  bankBalance,
  safeBalance
}) => {
  const stats = useStockFinanceStats(stock, stockFilterType, stockFilterCondition);

  return (
    <div className="space-y-6">
      <StockFilterCard
        stockFilterType={stockFilterType}
        onStockFilterTypeChange={onStockFilterTypeChange}
        stockFilterCondition={stockFilterCondition}
        onStockFilterConditionChange={onStockFilterConditionChange}
      />
      <StockValueCards stats={stats} />
      {payableDebtSummary.openAmount > 0 && (
        <PayableDebtAlert openAmount={payableDebtSummary.openAmount} overdueAmount={payableDebtSummary.overdueAmount} />
      )}
      <ConsolidatedBalancesCard
        stats={stats}
        debtorsOpenAmount={debtSummary.openAmount}
        payableOpenAmount={payableDebtSummary.openAmount}
        bankBalance={bankBalance}
        safeBalance={safeBalance}
      />
      <InventoryComparisonChart stats={stats} />
    </div>
  );
};

export default DashboardTab;
