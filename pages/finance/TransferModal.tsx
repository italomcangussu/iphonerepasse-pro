import React from 'react';
import Modal from '../../components/ui/Modal';
import type { FinancialAccount } from '../../types';
import { CASH_EQUIVALENT_ACCOUNTS } from '../../utils/financialAccounts';
import { maskDecimalInput } from '../../utils/inputMasks';

export interface TransferFormData {
  from: FinancialAccount;
  to: FinancialAccount;
  amount: string;
}

interface TransferModalProps {
  open: boolean;
  isTransferring: boolean;
  transferData: TransferFormData;
  setTransferData: React.Dispatch<React.SetStateAction<TransferFormData>>;
  onClose: () => void;
  onSubmit: () => void;
}

const TransferModal: React.FC<TransferModalProps> = ({
  open,
  isTransferring,
  transferData,
  setTransferData,
  onClose,
  onSubmit
}) => (
  <Modal
    open={open}
    onClose={() => {
      if (!isTransferring) onClose();
    }}
    title="Transferência"
    size="sm"
    centered={false}
    onSubmit={onSubmit}
    footer={
      <div className="flex justify-end gap-3">
        <button type="button" className="ios-button-secondary" onClick={() => onClose()} disabled={isTransferring}>
          Cancelar
        </button>
        <button type="submit" className="ios-button-primary" disabled={isTransferring}>
          {isTransferring ? 'Transferindo...' : 'Confirmar Transferência'}
        </button>
      </div>
    }
  >
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3">
        <div>
          <label className="ios-label">De</label>
          <select
            className="ios-input"
            value={transferData.from}
            onChange={(e) => setTransferData((prev) => ({ ...prev, from: e.target.value as FinancialAccount }))}
          >
            {CASH_EQUIVALENT_ACCOUNTS.map((account) => (
              <option key={account} value={account}>
                {account}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="ios-label">Para</label>
          <select
            className="ios-input"
            value={transferData.to}
            onChange={(e) => setTransferData((prev) => ({ ...prev, to: e.target.value as FinancialAccount }))}
          >
            {CASH_EQUIVALENT_ACCOUNTS.map((account) => (
              <option key={account} value={account}>
                {account}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="ios-label">Valor</label>
        <input
          type="text"
          role="spinbutton"
          inputMode="decimal"
          className="ios-input text-center text-lg tabular-nums font-semibold"
          onFocus={(e) => e.target.select()}
          value={transferData.amount}
          onChange={(e) => setTransferData((prev) => ({ ...prev, amount: maskDecimalInput(e.target.value) }))}
          placeholder="R$ 0,00"
        />
      </div>
    </div>
  </Modal>
);

export default TransferModal;
