import React, { useMemo } from 'react';
import Pagination from '../../components/ui/Pagination';
import type { Sale } from '../../types';
import { formatSaleNumber } from '../../utils/saleCode';
import { toFiniteNumber } from '../../utils/number';
import { formatCurrencyBRL } from '../../utils/inputMasks';
import { formatSignedBRL } from './financeHelpers';
import { getEffectiveDateRange, isInDateRange, type DatePreset } from './periodRange';

const PAGE_SIZE_SALES = 25;

interface FaturamentoTabProps {
  sales: Sale[];
  datePreset: DatePreset;
  customDateFrom: string;
  customDateTo: string;
  salesPage: number;
  setSalesPage: (page: number) => void;
  isMobile: boolean;
}

const FaturamentoTab: React.FC<FaturamentoTabProps> = ({
  sales,
  datePreset,
  customDateFrom,
  customDateTo,
  salesPage,
  setSalesPage,
  isMobile
}) => {
  const salesReport = useMemo(() => {
    const { from: dateFrom, to: dateTo } = getEffectiveDateRange(datePreset, customDateFrom, customDateTo);
    return sales
      .filter((sale) => isInDateRange(sale.date, dateFrom, dateTo))
      .map((sale) => {
        const items = Array.isArray(sale.items) ? sale.items : [];
        const costOfGoods = items.reduce((acc, item) => {
          const repairs = (Array.isArray(item.costs) ? item.costs : []).reduce((r, c) => r + toFiniteNumber(c.amount), 0);
          return acc + toFiniteNumber(item.purchasePrice) + repairs;
        }, 0);

        const netFinancialTotal = toFiniteNumber(sale.total);
        const tradeInValue = toFiniteNumber(sale.tradeInValue);
        const revenue = netFinancialTotal + tradeInValue;
        const commission = toFiniteNumber(sale.commission);
        const profit = revenue - costOfGoods - commission;
        const cardSurcharge = (sale.paymentMethods || []).reduce((acc, payment) => acc + toFiniteNumber(payment.feeAmount), 0);
        const financialPaymentsTotal = (sale.paymentMethods || []).reduce(
          (acc, payment) => acc + toFiniteNumber(payment.customerAmount ?? payment.amount),
          0
        );
        const customerChargedTotal = financialPaymentsTotal + tradeInValue;

        return {
          ...sale,
          items,
          total: revenue,
          netFinancialTotal,
          tradeInValue,
          costOfGoods,
          commission,
          profit,
          cardSurcharge,
          customerChargedTotal
        };
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [sales, datePreset, customDateFrom, customDateTo]);

  // KPIs do Faturamento. Ficam aqui (e não inline no JSX) para que cada valor
  // seja calculado uma vez e possa ir também no `title` do card — o número é
  // longo (ex.: R$ 1.400.949,14) e precisa continuar recuperável caso trunque.
  const faturamentoKpis = useMemo(() => {
    const sum = (pick: (sale: (typeof salesReport)[number]) => number) =>
      salesReport.reduce((acc, sale) => acc + toFiniteNumber(pick(sale)), 0);
    const brl = formatCurrencyBRL;

    return [
      { label: 'Vendas Realizadas', value: String(salesReport.length), tone: 'text-gray-900 dark:text-white' },
      { label: 'Faturamento Total', value: brl(sum((s) => s.total)), tone: 'text-brand-500 dark:text-brand-400' },
      { label: 'Comissões Pagas', value: brl(sum((s) => s.commission)), tone: 'text-amber-700 dark:text-amber-400' },
      { label: 'Lucro Líquido', value: brl(sum((s) => s.profit)), tone: 'text-green-700 dark:text-green-400' },
      { label: 'Acréscimo Cartão', value: brl(sum((s) => s.cardSurcharge)), tone: 'text-orange-700 dark:text-orange-400' },
      { label: 'Total Cobrado Cliente', value: brl(sum((s) => s.customerChargedTotal)), tone: 'text-indigo-700 dark:text-indigo-400' }
    ];
  }, [salesReport]);

  return (
      <div className="space-y-6">
        {/*
          Máximo de 3 colunas — 6 nunca coube. `max-w-7xl` trava o container
          em 1280px, então 6 colunas dão sempre ~143px de caixa de texto,
          enquanto "R$ 1.400.949,14" a 28px precisa de ~198px: cortava até em
          1920px. Como `ios-card` não recortava, o número aparecia truncado
          sem reticências, e o overflow empurrava o <main> para o lado —
          com `overflow-x-clip`, a página travava deslocada sem volta.
        */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 xl:gap-6">
          {faturamentoKpis.map(({ label, value, tone }) => (
            <div key={label} className="ios-card p-4 xl:p-6 min-w-0 overflow-hidden">
              <p className="text-ios-footnote text-gray-500 dark:text-surface-dark-500 mb-1">{label}</p>
              <h3
                title={value}
                // 28px só a partir de 2xl: em xl (1280px) o container ainda é
                // estreito e a folga do maior valor caía para 18px.
                className={`text-ios-title-3 2xl:text-ios-title-1 font-bold tabular-nums truncate ${tone}`}
              >
                {value}
              </h3>
            </div>
          ))}
        </div>

        <div className="ios-card overflow-hidden">
          <div className="p-6 border-b border-gray-200 dark:border-surface-dark-200">
            <h3 className="text-ios-title-3 font-bold text-gray-900 dark:text-white">Relatório de Vendas</h3>
          </div>
          {(() => {
            const salesTotalPages = Math.ceil(salesReport.length / PAGE_SIZE_SALES);
            const salesPaginated = salesReport.slice(salesPage * PAGE_SIZE_SALES, (salesPage + 1) * PAGE_SIZE_SALES);
            return isMobile ? (
              <div>
                <div className="p-4 md:p-6 space-y-3">
                  {salesPaginated.map((sale) => (
                    <div key={sale.id} className="ios-card p-4 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs text-gray-500 dark:text-surface-dark-500">
                            {new Date(sale.date).toLocaleDateString('pt-BR')}
                          </p>
                          <p className="text-brand-500 text-ios-footnote font-mono mt-1">#{formatSaleNumber(sale)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-ios-caption text-gray-500 dark:text-surface-dark-500">Lucro</p>
                          <p className={`font-bold tabular-nums ${sale.profit < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-700 dark:text-green-400'}`}>
                            {formatSignedBRL(sale.profit)}
                          </p>
                        </div>
                      </div>
                      <p className="text-ios-subhead font-semibold text-gray-900 dark:text-white">
                        {sale.items.length > 0 ? sale.items.map((i) => i.model).join(', ') : 'Sem itens'}
                      </p>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-ios-footnote tabular-nums text-gray-700 dark:text-surface-dark-700">
                        <p>Custo: {formatCurrencyBRL(sale.costOfGoods)}</p>
                        <p>Venda: {formatCurrencyBRL(sale.total)}</p>
                        <p>Acréscimo: {formatCurrencyBRL(toFiniteNumber(sale.cardSurcharge))}</p>
                        <p>Cobrado: {formatCurrencyBRL(toFiniteNumber(sale.customerChargedTotal))}</p>
                        <p>Comissão: {formatCurrencyBRL(toFiniteNumber(sale.commission))}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <Pagination page={salesPage} totalPages={salesTotalPages} totalItems={salesReport.length} pageSize={PAGE_SIZE_SALES} onPageChange={setSalesPage} />
              </div>
            ) : (
              <div>
                <table className="w-full table-fixed text-left">
                  <colgroup>
                    <col className="w-[9%]" />
                    <col className="w-[8%]" />
                    <col className="w-[22%]" />
                    <col className="w-[13%]" />
                    <col className="w-[12%]" />
                    <col className="w-[12%]" />
                    <col className="w-[12%]" />
                    <col className="w-[12%]" />
                  </colgroup>
                  <thead>
                    <tr className="text-ios-footnote text-gray-500 dark:text-surface-dark-500 border-b border-gray-200 dark:border-surface-dark-200 bg-gray-50 dark:bg-surface-dark-200">
                      <th className="p-3 font-medium">Data</th>
                      <th className="p-3 font-medium">Venda</th>
                      <th className="p-3 font-medium">Aparelhos</th>
                      <th className="p-3 font-medium text-right">Custo</th>
                      <th className="p-3 font-medium text-right">Venda</th>
                      <th className="p-3 font-medium text-right">Cobrado</th>
                      <th className="p-3 font-medium text-right">Comissão</th>
                      <th className="p-3 font-medium text-right">Lucro</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-surface-dark-200">
                    {salesPaginated.map((sale) => (
                      <tr key={sale.id} className="hover:bg-gray-50 dark:hover:bg-surface-dark-200 transition-colors">
                        <td className="p-3 text-xs text-gray-600">{new Date(sale.date).toLocaleDateString('pt-BR')}</td>
                        <td className="p-3 text-brand-500 text-xs font-mono">#{formatSaleNumber(sale)}</td>
                        <td className="p-3 text-gray-900 dark:text-white text-xs wrap-break-word">
                          {sale.items.length > 0 ? sale.items.map((i) => i.model).join(', ') : 'Sem itens'}
                        </td>
                        <td className="p-3 text-right text-gray-500 dark:text-surface-dark-500 text-xs">{formatCurrencyBRL(sale.costOfGoods)}</td>
                        <td className="p-3 text-right text-gray-900 dark:text-white text-xs font-medium">{formatCurrencyBRL(sale.total)}</td>
                        <td className="p-3 text-right text-indigo-600 text-xs font-medium">{formatCurrencyBRL(toFiniteNumber(sale.customerChargedTotal))}</td>
                        <td className="p-3 text-right text-amber-600 text-xs font-medium">{formatCurrencyBRL(toFiniteNumber(sale.commission))}</td>
                        <td className="p-3 text-right font-bold text-green-700 dark:text-green-400 text-xs">{formatCurrencyBRL(sale.profit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <Pagination page={salesPage} totalPages={salesTotalPages} totalItems={salesReport.length} pageSize={PAGE_SIZE_SALES} onPageChange={setSalesPage} />
              </div>
            );
          })()}
        </div>
      </div>
  );
};

export default FaturamentoTab;
