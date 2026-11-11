import React from 'react';
import { Link } from 'react-router-dom';
import { formatCurrencyBRL } from '../../utils/inputMasks';
import { formatSignedBRL } from './financeHelpers';
import type { StockFinanceStats } from './useStockFinanceStats';

export const StockValueCards: React.FC<{ stats: StockFinanceStats }> = ({ stats: { stockStats, inUseStats, reservedStats } }) => (
  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
    <div className="ios-card p-5 md:p-6">
      <p className="text-ios-footnote text-gray-500 dark:text-surface-dark-500 mb-1">Custo do Estoque</p>
      <h3 className="text-ios-title-1 font-bold text-gray-900 dark:text-white">
        {formatCurrencyBRL((stockStats.acquisitionCost + inUseStats.acquisitionCost))}
      </h3>
      <p className="text-ios-footnote text-gray-500 dark:text-surface-dark-500 mt-2">
        {stockStats.count + inUseStats.count} aparelhos
        {reservedStats.count > 0 && (
          <span className="text-gray-400 dark:text-surface-dark-500"> ({reservedStats.count} {reservedStats.count === 1 ? 'reservado' : 'reservados'})</span>
        )}
        {inUseStats.count > 0 && (
          <span className="text-gray-400 dark:text-surface-dark-500"> ({inUseStats.count} em uso)</span>
        )}
      </p>
    </div>

    <div className="ios-card p-5 md:p-6">
      <p className="text-ios-footnote text-gray-500 dark:text-surface-dark-500 mb-1">Valor de Venda (Projetado)</p>
      <h3 className="text-ios-title-1 font-bold text-brand-500">{formatCurrencyBRL((stockStats.salesValue + inUseStats.salesValue))}</h3>
      <p className="text-ios-footnote text-gray-500 dark:text-surface-dark-500 mt-2">Se todo o estoque for vendido</p>
    </div>

    <div className="ios-card p-5 md:p-6 bg-linear-to-br from-green-50 to-white dark:from-green-900/20 dark:to-surface-dark-100 border-green-200 dark:border-green-800">
      <p className="text-ios-footnote text-green-700 dark:text-green-400 mb-1">Lucro Projetado</p>
      <h3 className="text-ios-title-1 font-bold text-green-700 dark:text-green-400">{formatCurrencyBRL(stockStats.projectedProfit)}</h3>
      <div className="w-full bg-gray-200 dark:bg-surface-dark-300 h-2 rounded-full mt-3 overflow-hidden">
        <div
          className="h-full bg-green-500"
          style={{
            width: `${stockStats.salesValue > 0 ? Math.min(100, (stockStats.projectedProfit / stockStats.salesValue) * 100) : 0}%`
          }}
        />
      </div>
      <p className="text-ios-footnote text-green-700 dark:text-green-400 mt-2">
        Margem: {stockStats.salesValue > 0 ? ((stockStats.projectedProfit / stockStats.salesValue) * 100).toFixed(1) : '0.0'}%
      </p>
    </div>
  </div>
);

export const PayableDebtAlert: React.FC<{ openAmount: number }> = ({ openAmount }) => (
  <div className="ios-card p-5 border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10 flex items-center justify-between gap-4">
    <div>
      <p className="text-ios-footnote text-red-600 dark:text-red-400 mb-1">Dívidas Ativas em aberto</p>
      <p className="text-ios-title-2 font-bold text-red-700 dark:text-red-400">{formatCurrencyBRL(openAmount)}</p>
    </div>
    <Link to="/payable-debts" className="ios-button-secondary shrink-0 text-red-600 dark:text-red-400 border-red-300 dark:border-red-700">
      Ver dívidas
    </Link>
  </div>
);

interface ConsolidatedBalancesCardProps {
  stats: StockFinanceStats;
  debtorsOpenAmount: number;
  payableOpenAmount: number;
  bankBalance: number;
  safeBalance: number;
}

export const ConsolidatedBalancesCard: React.FC<ConsolidatedBalancesCardProps> = ({
  stats: { stockStats, inUseStats, reservationDepositSummary },
  debtorsOpenAmount,
  payableOpenAmount,
  bankBalance,
  safeBalance
}) => (
  <div className="ios-card p-6">
    <h3 className="text-ios-title-3 font-bold text-gray-900 dark:text-white mb-4">Saldos Consolidados</h3>
    <div className="space-y-0 divide-y divide-gray-100 dark:divide-surface-dark-200">
      {[
        { label: 'Saldo Aparelhos', value: stockStats.salesValue + inUseStats.salesValue, color: 'text-brand-500', hint: 'Valor de venda projetado do estoque (inclui reservados)' },
        { label: 'Saldo Devedores', value: debtorsOpenAmount, color: 'text-amber-600 dark:text-amber-400', hint: 'Total em aberto a receber' },
        { label: 'Saldo Conta Bancária', value: bankBalance, color: bankBalance >= 0 ? 'text-gray-900 dark:text-white' : 'text-red-600 dark:text-red-400', hint: null },
        { label: 'Saldo Cofre', value: safeBalance, color: safeBalance >= 0 ? 'text-gray-900 dark:text-white' : 'text-red-600 dark:text-red-400', hint: null },
      ].map(({ label, value, color, hint }) => (
        <div key={label} className="flex items-center justify-between py-3 gap-4">
          <div>
            <p className="text-ios-subhead font-medium text-gray-700 dark:text-gray-300">{label}</p>
            {hint && <p className="text-ios-caption text-gray-400 dark:text-surface-dark-500">{hint}</p>}
          </div>
          <p className={`text-ios-title-3 font-bold tabular-nums shrink-0 ${color}`}>
            {formatSignedBRL(value)}
          </p>
        </div>
      ))}
      {payableOpenAmount > 0 && (
        <div className="flex items-center justify-between py-3 gap-4">
          <div>
            <p className="text-ios-subhead font-medium text-gray-700 dark:text-gray-300">Saldo Dívidas Ativas</p>
            <p className="text-ios-caption text-gray-400 dark:text-surface-dark-500">Total em aberto a pagar (deduzido do total)</p>
          </div>
          <p className="text-ios-title-3 font-bold tabular-nums shrink-0 text-red-600 dark:text-red-400">
            − {formatSignedBRL(payableOpenAmount)}
          </p>
        </div>
      )}
      {reservationDepositSummary.amount > 0 && (
        <div className="flex items-center justify-between py-3 gap-4">
          <div>
            <p className="text-ios-subhead font-medium text-gray-700 dark:text-gray-300">Sinais de Reserva</p>
            <p className="text-ios-caption text-gray-400 dark:text-surface-dark-500">
              {reservationDepositSummary.count === 1
                ? 'Adiantamento de 1 reserva ativa já no caixa (deduzido do total)'
                : `Adiantamentos de ${reservationDepositSummary.count} reservas ativas já no caixa (deduzido do total)`}
            </p>
          </div>
          <p className="text-ios-title-3 font-bold tabular-nums shrink-0 text-red-600 dark:text-red-400">
            − {formatSignedBRL(reservationDepositSummary.amount)}
          </p>
        </div>
      )}
      <div className="flex items-center justify-between pt-4 pb-1 gap-4">
        <p className="text-ios-headline font-bold text-gray-900 dark:text-white">Total Acumulado</p>
        {(() => {
          const total = stockStats.salesValue + inUseStats.salesValue + debtorsOpenAmount + bankBalance + safeBalance - payableOpenAmount - reservationDepositSummary.amount;
          return (
            <p className={`text-ios-title-2 font-bold tabular-nums shrink-0 ${total >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {formatSignedBRL(total)}
            </p>
          );
        })()}
      </div>
    </div>
  </div>
);
