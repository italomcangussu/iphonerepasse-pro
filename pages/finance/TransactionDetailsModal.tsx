import React from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import Modal from '../../components/ui/Modal';
import type { Transaction } from '../../types';
import { toFiniteNumber } from '../../utils/number';
import { formatCurrencyBRL, formatDateTimeBRL } from '../../utils/inputMasks';

const ONE_MINUTE_MS = 60_000;

// Lançamento com data diferente de quando foi registrado (retroativo ou editado).
const wasRecordedAtAnotherTime = (transaction: Transaction): boolean => {
  if (!transaction.createdAt) return false;
  const gap = Math.abs(new Date(transaction.createdAt).getTime() - new Date(transaction.date).getTime());
  return Number.isFinite(gap) && gap > ONE_MINUTE_MS;
};

const PayeeRow: React.FC<{ name?: string | null }> = ({ name }) =>
  name ? (
    <div className="flex justify-between gap-3">
      <p className="text-xs text-gray-500 dark:text-surface-dark-500">Funcionário</p>
      <p className="text-sm font-semibold text-gray-900 dark:text-white text-right">{name}</p>
    </div>
  ) : null;

interface TransactionDetailsModalProps {
  selectedTransaction: Transaction | null;
  description: string;
  payeeName?: string | null;
  canEdit: boolean;
  canDelete: boolean;
  onClose: () => void;
  onEdit: (transaction: Transaction) => void;
  onCancelTransaction: (transaction: Transaction) => Promise<void>;
}

const TransactionDetailsModal: React.FC<TransactionDetailsModalProps> = ({
  selectedTransaction,
  description,
  payeeName,
  canEdit,
  canDelete,
  onClose,
  onEdit,
  onCancelTransaction
}) => (
  <Modal
    open={!!selectedTransaction}
    onClose={onClose}
    title="Detalhes do lançamento"
    size="sm"
    footer={
      selectedTransaction ? (
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className="ios-button-secondary" onClick={onClose}>
            Fechar
          </button>
          {canEdit && (
          <button
            type="button"
            className="ios-button-secondary inline-flex items-center gap-2"
            onClick={() => onEdit(selectedTransaction)}
          >
            <Pencil size={16} />
            Editar
          </button>
          )}
          {canDelete && (
          <button
            type="button"
            className="ios-button-destructive inline-flex items-center gap-2"
            onClick={() => void onCancelTransaction(selectedTransaction)}
          >
            <Trash2 size={16} />
            Cancelar lançamento
          </button>
          )}
        </div>
      ) : undefined
    }
  >
    {selectedTransaction && (
      <div className="space-y-3">
        <div className="ios-card p-4 space-y-2">
          <div className="flex justify-between gap-3">
            <p className="text-xs text-gray-500 dark:text-surface-dark-500">Data e hora</p>
            <p className="text-sm font-semibold tabular-nums text-gray-900 dark:text-white">
              {formatDateTimeBRL(selectedTransaction.date)}
            </p>
          </div>
          {wasRecordedAtAnotherTime(selectedTransaction) && (
            <div className="flex justify-between gap-3">
              <p className="text-xs text-gray-500 dark:text-surface-dark-500">Registrado em</p>
              <p className="text-sm tabular-nums text-gray-700 dark:text-surface-dark-700">
                {formatDateTimeBRL(selectedTransaction.createdAt)}
              </p>
            </div>
          )}
          <div className="flex justify-between gap-3">
            <p className="text-xs text-gray-500 dark:text-surface-dark-500">Conta</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">{selectedTransaction.account}</p>
          </div>
          <div className="flex justify-between gap-3">
            <p className="text-xs text-gray-500 dark:text-surface-dark-500">Tipo</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              {selectedTransaction.type === 'IN' ? 'Entrada' : 'Saída'}
            </p>
          </div>
          <div className="flex justify-between gap-3">
            <p className="text-xs text-gray-500 dark:text-surface-dark-500">Categoria</p>
            <span className={`ios-badge ${selectedTransaction.type === 'IN' ? 'ios-badge-green' : 'ios-badge-orange'}`}>
              {selectedTransaction.category}
            </span>
          </div>
          <PayeeRow name={payeeName} />
          <div className="flex justify-between gap-3">
            <p className="text-xs text-gray-500 dark:text-surface-dark-500">Valor</p>
            <p className={`text-base font-bold ${selectedTransaction.type === 'IN' ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {selectedTransaction.type === 'IN' ? '+' : '−'} {formatCurrencyBRL(toFiniteNumber(selectedTransaction.amount))}
            </p>
          </div>
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-surface-dark-500 mb-1">Descrição</p>
          <p className="ios-card p-3 text-sm text-gray-900 dark:text-white">
            {description}
          </p>
        </div>
      </div>
    )}
  </Modal>
);

export default TransactionDetailsModal;
