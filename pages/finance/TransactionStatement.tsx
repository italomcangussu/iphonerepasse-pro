import React from 'react';
import { ChevronRight } from 'lucide-react';
import Pagination from '../../components/ui/Pagination';
import type { ContextMenuAction } from '../../components/ui/contextMenuCore';
import type { useDesktopContextMenu } from '../../hooks/useDesktopContextMenu';
import type { Transaction } from '../../types';
import { toFiniteNumber } from '../../utils/number';
import { formatCurrencyBRL, formatMomentDateBRL, formatTimeBRL } from '../../utils/inputMasks';

const PAGE_SIZE_TRX = 50;

// Quando o lançamento aconteceu: data e hora, para conferir com o extrato do banco.
const TransactionMoment: React.FC<{ value: string; stacked: boolean }> = ({ value, stacked }) => {
  const date = formatMomentDateBRL(value);
  const time = formatTimeBRL(value);
  if (!stacked) return <time dateTime={value}>{time ? `${date} · ${time}` : date}</time>;
  return (
    <time dateTime={value} className="block">
      <span className="block">{date}</span>
      {time && <span className="block text-ios-footnote tabular-nums text-gray-500 dark:text-surface-dark-500">{time}</span>}
    </time>
  );
};

interface TransactionStatementProps {
  filtered: Transaction[];
  page: number;
  setPage: (page: number) => void;
  isMobile: boolean;
  contextMenu: ReturnType<typeof useDesktopContextMenu>;
  buildTransactionContextActions: (transaction: Transaction) => ContextMenuAction[];
  setSelectedTransaction: (transaction: Transaction) => void;
}

// Extrato da conta: cartões no celular, tabela no desktop. Tocar abre os detalhes.
const TransactionStatement: React.FC<TransactionStatementProps> = ({
  filtered,
  page,
  setPage,
  isMobile,
  contextMenu,
  buildTransactionContextActions,
  setSelectedTransaction
}) => {
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE_TRX);
  const paginated = filtered.slice(page * PAGE_SIZE_TRX, (page + 1) * PAGE_SIZE_TRX);

  if (isMobile) {
    if (filtered.length === 0) {
      return <div className="p-6 text-center text-gray-500 dark:text-surface-dark-500">Nenhuma movimentação registrada.</div>;
    }

    return (
      <div>
        <div className="p-4 md:p-6 space-y-3">
          {paginated.map((t) => (
            <button
              key={t.id}
              type="button"
              className="ios-card w-full p-4 text-left hover:ring-1 hover:ring-brand-200"
              onClick={() => setSelectedTransaction(t)}
              onContextMenu={contextMenu.bind(buildTransactionContextActions(t), { label: `Ações do lançamento ${t.description}` })}
            >
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-ios-subhead font-semibold text-gray-900 dark:text-white">{t.description}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <span className="text-ios-footnote tabular-nums text-gray-500 dark:text-surface-dark-500">
                      <TransactionMoment value={t.date} stacked={false} />
                    </span>
                    <span className={`ios-badge ${t.type === 'IN' ? 'ios-badge-green' : 'ios-badge-orange'}`}>{t.category}</span>
                  </div>
                </div>
                <p className={`shrink-0 whitespace-nowrap text-ios-subhead font-bold tabular-nums ${t.type === 'IN' ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {t.type === 'IN' ? '+' : '−'} {formatCurrencyBRL(toFiniteNumber(t.amount))}
                </p>
                <ChevronRight size={18} className="mt-0.5 shrink-0 text-gray-400 dark:text-surface-dark-500" aria-hidden="true" />
                <span className="sr-only">Ver detalhes</span>
              </div>
            </button>
          ))}
        </div>
        <Pagination page={page} totalPages={totalPages} totalItems={filtered.length} pageSize={PAGE_SIZE_TRX} onPageChange={setPage} />
      </div>
    );
  }

  return (
    <div>
      <table className="w-full table-fixed text-left">
        <colgroup>
          <col className="w-32" />
          <col />
          <col className="w-[20%]" />
          <col className="w-[22%]" />
        </colgroup>
        <thead>
          <tr className="text-ios-footnote text-gray-500 dark:text-surface-dark-500 border-b border-gray-200 dark:border-surface-dark-200">
            <th className="p-4 font-medium whitespace-nowrap">Data e hora</th>
            <th className="p-4 font-medium">Descrição</th>
            <th className="p-4 font-medium">Categoria</th>
            <th className="p-4 font-medium text-right">Valor</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-surface-dark-200">
          {paginated.map((t) => (
            <tr
              key={t.id}
              className="hover:bg-gray-50 dark:hover:bg-surface-dark-200 transition-colors cursor-pointer"
              onClick={() => setSelectedTransaction(t)}
              onContextMenu={contextMenu.bind(buildTransactionContextActions(t), { label: `Ações do lançamento ${t.description}` })}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  setSelectedTransaction(t);
                }
              }}
              tabIndex={0}
            >
              <td className="p-4 text-ios-subhead tabular-nums whitespace-nowrap text-gray-600 dark:text-surface-dark-600">
                <TransactionMoment value={t.date} stacked />
              </td>
              <td className="p-4 text-gray-900 dark:text-white font-medium">{t.description}</td>
              <td className="p-4">
                <span className={`ios-badge ${t.type === 'IN' ? 'ios-badge-green' : 'ios-badge-orange'}`}>{t.category}</span>
              </td>
              <td className={`p-4 text-right font-bold ${t.type === 'IN' ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {t.type === 'IN' ? '+' : '−'} {formatCurrencyBRL(toFiniteNumber(t.amount))}
              </td>
            </tr>
          ))}
          {filtered.length === 0 && (
            <tr>
              <td colSpan={4} className="p-8 text-center text-gray-500 dark:text-surface-dark-500">
                Nenhuma movimentação registrada.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <Pagination page={page} totalPages={totalPages} totalItems={filtered.length} pageSize={PAGE_SIZE_TRX} onPageChange={setPage} />
    </div>
  );
};

export default TransactionStatement;
