import React, { useMemo } from 'react';
import Pagination from '../../components/ui/Pagination';
import type { Customer, Sale, Seller } from '../../types';
import { buildSalesReport, summarizeSalesReport, type SalesReportRow } from '../../lib/finance/salesReport';
import { formatSaleNumber } from '../../utils/saleCode';
import { formatCurrencyBRL, formatDateTimeBRL } from '../../utils/inputMasks';
import { formatSignedBRL } from './financeHelpers';
import { getEffectiveDateRange, isInDateRange, type DatePreset } from './periodRange';

const PAGE_SIZE_SALES = 25;

const describeItems = (sale: SalesReportRow) => (sale.items.length > 0 ? sale.items.map((item) => item.model).join(', ') : 'Sem itens');
const formatSaleDate = (sale: SalesReportRow) => formatDateTimeBRL(sale.date);
const profitTone = (profit: number) => (profit < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-700 dark:text-green-400');

// Quem comprou e quem vendeu, para achar a venda sem abrir o histórico.
type DescribePeople = (sale: SalesReportRow) => string;

// KPIs do Faturamento: cada valor é calculado uma vez e vai também no `title`
// do card — o número é longo (ex.: R$ 1.400.949,14) e precisa continuar
// recuperável caso trunque.
const buildKpis = (rows: SalesReportRow[]) => {
  const totals = summarizeSalesReport(rows);
  return [
    { label: 'Vendas Realizadas', value: String(totals.count), tone: 'text-gray-900 dark:text-white' },
    { label: 'Faturamento Total', value: formatCurrencyBRL(totals.revenue), tone: 'text-brand-500 dark:text-brand-400' },
    { label: 'Comissões Pagas', value: formatCurrencyBRL(totals.commission), tone: 'text-amber-700 dark:text-amber-400' },
    { label: 'Lucro Líquido', value: formatCurrencyBRL(totals.profit), tone: 'text-green-700 dark:text-green-400' },
    { label: 'Acréscimo Cartão', value: formatCurrencyBRL(totals.cardSurcharge), tone: 'text-orange-700 dark:text-orange-400' },
    { label: 'Total Cobrado Cliente', value: formatCurrencyBRL(totals.customerCharged), tone: 'text-indigo-700 dark:text-indigo-400' }
  ];
};

interface SaleRowProps {
  sale: SalesReportRow;
  people: string;
}

const SaleCard: React.FC<SaleRowProps> = ({ sale, people }) => (
  <div className="ios-card p-4 space-y-2">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-xs tabular-nums text-gray-500 dark:text-surface-dark-500">{formatSaleDate(sale)}</p>
        <p className="text-brand-500 text-ios-footnote font-mono mt-1">#{formatSaleNumber(sale)}</p>
      </div>
      <div className="text-right">
        <p className="text-ios-caption text-gray-500 dark:text-surface-dark-500">Lucro</p>
        <p className={`font-bold tabular-nums ${profitTone(sale.profit)}`}>
          {formatSignedBRL(sale.profit)}
        </p>
      </div>
    </div>
    <div>
      <p className="text-ios-subhead font-semibold text-gray-900 dark:text-white">{describeItems(sale)}</p>
      <p className="text-ios-footnote text-gray-500 dark:text-surface-dark-500">{people}</p>
    </div>
    <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-ios-footnote tabular-nums text-gray-700 dark:text-surface-dark-700">
      <p>Custo: {formatCurrencyBRL(sale.costOfGoods)}</p>
      <p>Venda: {formatCurrencyBRL(sale.total)}</p>
      <p>Acréscimo: {formatCurrencyBRL(sale.cardSurcharge)}</p>
      <p>Cobrado: {formatCurrencyBRL(sale.customerChargedTotal)}</p>
      <p>Comissão: {formatCurrencyBRL(sale.commission)}</p>
    </div>
  </div>
);

const SaleTableRow: React.FC<SaleRowProps> = ({ sale, people }) => (
  <tr className="hover:bg-gray-50 dark:hover:bg-surface-dark-200 transition-colors">
    <td className="p-3 text-xs tabular-nums text-gray-600 dark:text-surface-dark-600">{formatSaleDate(sale)}</td>
    <td className="p-3 text-brand-500 text-xs font-mono">#{formatSaleNumber(sale)}</td>
    <td className="p-3 text-xs wrap-break-word">
      <span className="block text-gray-900 dark:text-white">{describeItems(sale)}</span>
      <span className="block text-gray-500 dark:text-surface-dark-500">{people}</span>
    </td>
    <td className="p-3 text-right tabular-nums text-gray-500 dark:text-surface-dark-500 text-xs">{formatCurrencyBRL(sale.costOfGoods)}</td>
    <td className="p-3 text-right tabular-nums text-gray-900 dark:text-white text-xs font-medium">{formatCurrencyBRL(sale.total)}</td>
    <td className="p-3 text-right tabular-nums text-indigo-700 dark:text-indigo-400 text-xs font-medium">{formatCurrencyBRL(sale.customerChargedTotal)}</td>
    <td className="p-3 text-right tabular-nums text-amber-700 dark:text-amber-400 text-xs font-medium">{formatCurrencyBRL(sale.commission)}</td>
    <td className={`p-3 text-right tabular-nums font-bold text-xs ${profitTone(sale.profit)}`}>{formatSignedBRL(sale.profit)}</td>
  </tr>
);

const SalesTable: React.FC<{ rows: SalesReportRow[]; describePeople: DescribePeople }> = ({ rows, describePeople }) => (
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
        <th className="p-3 font-medium">Data e hora</th>
        <th className="p-3 font-medium">Venda</th>
        <th className="p-3 font-medium">Aparelhos e cliente</th>
        <th className="p-3 font-medium text-right">Custo</th>
        <th className="p-3 font-medium text-right">Venda</th>
        <th className="p-3 font-medium text-right">Cobrado</th>
        <th className="p-3 font-medium text-right">Comissão</th>
        <th className="p-3 font-medium text-right">Lucro</th>
      </tr>
    </thead>
    <tbody className="divide-y divide-gray-200 dark:divide-surface-dark-200">
      {rows.map((sale) => (
        <SaleTableRow key={sale.id} sale={sale} people={describePeople(sale)} />
      ))}
    </tbody>
  </table>
);

interface FaturamentoTabProps {
  sales: Sale[];
  customers: Customer[];
  sellers: Seller[];
  datePreset: DatePreset;
  customDateFrom: string;
  customDateTo: string;
  salesPage: number;
  setSalesPage: (page: number) => void;
  isMobile: boolean;
}

const useDescribePeople = (customers: Customer[], sellers: Seller[]): DescribePeople =>
  useMemo(() => {
    const customerById = new Map(customers.map((customer) => [customer.id, customer.name]));
    const sellerById = new Map(sellers.map((seller) => [seller.id, seller.name]));
    return (sale) => {
      const customer = customerById.get(sale.customerId) || 'Cliente não informado';
      const seller = sellerById.get(sale.sellerId);
      return seller ? `${customer} · vendedor ${seller}` : customer;
    };
  }, [customers, sellers]);

const FaturamentoTab: React.FC<FaturamentoTabProps> = ({ sales, customers, sellers, datePreset, customDateFrom, customDateTo, salesPage, setSalesPage, isMobile }) => {
  const salesReport = useMemo(() => {
    const { from, to } = getEffectiveDateRange(datePreset, customDateFrom, customDateTo);
    return buildSalesReport(sales, (date) => isInDateRange(date, from, to));
  }, [sales, datePreset, customDateFrom, customDateTo]);
  const kpis = useMemo(() => buildKpis(salesReport), [salesReport]);
  const describePeople = useDescribePeople(customers, sellers);
  const totalPages = Math.ceil(salesReport.length / PAGE_SIZE_SALES);
  const pageRows = salesReport.slice(salesPage * PAGE_SIZE_SALES, (salesPage + 1) * PAGE_SIZE_SALES);

  return (
    <div className="space-y-6">
      {/*
        Máximo de 3 colunas — 6 nunca coube. `max-w-7xl` trava o container
        em 1280px, então 6 colunas dão sempre ~143px de caixa de texto,
        enquanto "R$ 1.400.949,14" a 28px precisa de ~198px.
      */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 xl:gap-6">
        {kpis.map(({ label, value, tone }) => (
          <div key={label} className="ios-card p-4 xl:p-6 min-w-0 overflow-hidden">
            <p className="text-ios-footnote text-gray-500 dark:text-surface-dark-500 mb-1">{label}</p>
            {/* 28px só a partir de 2xl: em xl (1280px) o container ainda é estreito. */}
            <h3 title={value} className={`text-ios-title-3 2xl:text-ios-title-1 font-bold tabular-nums truncate ${tone}`}>
              {value}
            </h3>
          </div>
        ))}
      </div>

      <div className="ios-card overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-surface-dark-200">
          <h3 className="text-ios-title-3 font-bold text-gray-900 dark:text-white">Relatório de Vendas</h3>
        </div>
        {isMobile ? (
          <div className="p-4 md:p-6 space-y-3">
            {pageRows.map((sale) => (
              <SaleCard key={sale.id} sale={sale} people={describePeople(sale)} />
            ))}
          </div>
        ) : (
          <SalesTable rows={pageRows} describePeople={describePeople} />
        )}
        <Pagination page={salesPage} totalPages={totalPages} totalItems={salesReport.length} pageSize={PAGE_SIZE_SALES} onPageChange={setSalesPage} />
      </div>
    </div>
  );
};

export default FaturamentoTab;
