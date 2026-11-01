import React from 'react';
import { ChevronRight, UserRound } from 'lucide-react';
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

const amountTone = (transaction: Transaction) =>
  transaction.type === 'IN' ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400';
const categoryBadge = (transaction: Transaction) => (transaction.type === 'IN' ? 'ios-badge-green' : 'ios-badge-orange');
const signedAmount = (transaction: Transaction) =>
  `${transaction.type === 'IN' ? '+' : '−'} ${formatCurrencyBRL(toFiniteNumber(transaction.amount))}`;

// Quem recebeu um pagamento de pessoal, junto da descrição.
const PayeeTag: React.FC<{ name?: string }> = ({ name }) =>
  name ? (
    <span className="inline-flex items-center gap-1 text-ios-footnote font-medium text-gray-700 dark:text-surface-dark-700">
      <UserRound size={14} aria-hidden="true" />
      {name}
    </span>
  ) : null;

interface StatementEntryProps {
  transaction: Transaction;
  description: string;
  payeeName?: string;
  onOpen: () => void;
  onContextMenu: React.MouseEventHandler;
}

const StatementCard: React.FC<StatementEntryProps> = ({ transaction, description, payeeName, onOpen, onContextMenu }) => (
  <button
    type="button"
    className="ios-card w-full p-4 text-left hover:ring-1 hover:ring-brand-200"
    onClick={onOpen}
    onContextMenu={onContextMenu}
  >
    <div className="flex items-start gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-ios-subhead font-semibold text-gray-900 dark:text-white">{description}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <PayeeTag name={payeeName} />
          <span className="text-ios-footnote tabular-nums text-gray-500 dark:text-surface-dark-500">
            <TransactionMoment value={transaction.date} stacked={false} />
          </span>
          <span className={`ios-badge ${categoryBadge(transaction)}`}>{transaction.category}</span>
        </div>
      </div>
      <p className={`shrink-0 whitespace-nowrap text-ios-subhead font-bold tabular-nums ${amountTone(transaction)}`}>
        {signedAmount(transaction)}
      </p>
      <ChevronRight size={18} className="mt-0.5 shrink-0 text-gray-400 dark:text-surface-dark-500" aria-hidden="true" />
      <span className="sr-only">Ver detalhes</span>
    </div>
  </button>
);

const StatementRow: React.FC<StatementEntryProps> = ({ transaction, description, payeeName, onOpen, onContextMenu }) => (
  <tr
    className="hover:bg-gray-50 dark:hover:bg-surface-dark-200 transition-colors cursor-pointer"
    onClick={onOpen}
    onContextMenu={onContextMenu}
    onKeyDown={(event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onOpen();
      }
    }}
    tabIndex={0}
  >
    <td className="p-4 text-ios-subhead tabular-nums whitespace-nowrap text-gray-600 dark:text-surface-dark-600">
      <TransactionMoment value={transaction.date} stacked />
    </td>
    <td className="p-4 text-gray-900 dark:text-white font-medium wrap-break-word">
      <span className="block">{description}</span>
      {payeeName && (
        <span className="mt-1 block">
          <PayeeTag name={payeeName} />
        </span>
      )}
    </td>
    <td className="p-4">
      <span className={`ios-badge ${categoryBadge(transaction)}`}>{transaction.category}</span>
    </td>
    <td className={`p-4 text-right font-bold tabular-nums ${amountTone(transaction)}`}>{signedAmount(transaction)}</td>
  </tr>
);

const EMPTY_MESSAGE = 'Nenhuma movimentação registrada.';

interface TransactionStatementProps {
  filtered: Transaction[];
  page: number;
  setPage: (page: number) => void;
  isMobile: boolean;
  contextMenu: ReturnType<typeof useDesktopContextMenu>;
  buildTransactionContextActions: (transaction: Transaction) => ContextMenuAction[];
  setSelectedTransaction: (transaction: Transaction) => void;
  /** Texto para quem lê (nome do cliente, valores traduzidos); o lançamento em si não muda. */
  describeTransaction: (transaction: Transaction) => string;
  /** Nome do funcionário pago, quando o lançamento é de pessoal. */
  payeeNameOf?: (transaction: Transaction) => string | undefined;
}

// Extrato da conta: cartões no celular, tabela no desktop. Tocar abre os detalhes.
const TransactionStatement: React.FC<TransactionStatementProps> = ({
  filtered,
  page,
  setPage,
  isMobile,
  contextMenu,
  buildTransactionContextActions,
  setSelectedTransaction,
  describeTransaction,
  payeeNameOf
}) => {
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE_TRX);
  const paginated = filtered.slice(page * PAGE_SIZE_TRX, (page + 1) * PAGE_SIZE_TRX);
  const entryProps = (transaction: Transaction): StatementEntryProps & { key: string } => {
    const description = describeTransaction(transaction);
    return {
      key: transaction.id,
      transaction,
      description,
      payeeName: payeeNameOf?.(transaction),
      onOpen: () => setSelectedTransaction(transaction),
      onContextMenu: contextMenu.bind(buildTransactionContextActions(transaction), { label: `Ações do lançamento ${description}` })
    };
  };
  const pagination = (
    <Pagination page={page} totalPages={totalPages} totalItems={filtered.length} pageSize={PAGE_SIZE_TRX} onPageChange={setPage} />
  );

  if (isMobile) {
    if (filtered.length === 0) {
      return <div className="p-6 text-center text-gray-500 dark:text-surface-dark-500">{EMPTY_MESSAGE}</div>;
    }
    return (
      <div>
        <div className="p-4 md:p-6 space-y-3">
          {paginated.map((transaction) => {
            const { key, ...props } = entryProps(transaction);
            return <StatementCard key={key} {...props} />;
          })}
        </div>
        {pagination}
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
          {paginated.map((transaction) => {
            const { key, ...props } = entryProps(transaction);
            return <StatementRow key={key} {...props} />;
          })}
          {filtered.length === 0 && (
            <tr>
              <td colSpan={4} className="p-8 text-center text-gray-500 dark:text-surface-dark-500">
                {EMPTY_MESSAGE}
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {pagination}
    </div>
  );
};

export default TransactionStatement;
