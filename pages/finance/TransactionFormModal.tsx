import React from 'react';
import Modal from '../../components/ui/Modal';
import type { FinancialCategory, FinancialAccount, Transaction } from '../../types';
import { ACCOUNT_DEBTORS, CASH_EQUIVALENT_ACCOUNTS, FINANCIAL_ACCOUNTS } from '../../utils/financialAccounts';
import { maskDecimalInput } from '../../utils/inputMasks';
import { isManualCategory } from './financeHelpers';

export interface TransactionFormData {
  type: 'IN' | 'OUT';
  category: Transaction['category'];
  amount: string;
  description: string;
  date: string;
  account: FinancialAccount;
}

interface TransactionFormModalProps {
  open: boolean;
  isEditing: boolean;
  isSaving: boolean;
  formData: TransactionFormData;
  setFormData: React.Dispatch<React.SetStateAction<TransactionFormData>>;
  financialCategories: FinancialCategory[];
  findDefaultManualCategory: (type: 'IN' | 'OUT') => FinancialCategory | undefined;
  onClose: () => void;
  onSubmit: () => void;
}

const TransactionFormModal: React.FC<TransactionFormModalProps> = ({
  open,
  isEditing,
  isSaving,
  formData,
  setFormData,
  financialCategories,
  findDefaultManualCategory,
  onClose,
  onSubmit
}) => {
  const isIncoming = formData.type === 'IN';
  const title = isEditing ? 'Editar lançamento' : isIncoming ? 'Novo Aporte' : 'Novo Pagamento';
  const confirmLabel = isEditing ? 'Salvar alterações' : isIncoming ? 'Confirmar Aporte' : 'Confirmar Pagamento';
  const descriptionPlaceholder = isIncoming ? 'Ex: Aporte em caixa' : 'Ex: Pagamento de conta';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="lg"
      centered={false}
      onSubmit={onSubmit}
      footer={
        <div className="flex justify-end gap-3">
          <button type="button" className="ios-button-secondary" onClick={onClose} disabled={isSaving}>
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className={`ios-button text-white ${isIncoming ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'}`}
          >
            {isSaving ? 'Salvando...' : confirmLabel}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="ios-label">Tipo</label>
            <select
              className="ios-input"
              value={formData.type}
              onChange={(e) => {
                const newType = e.target.value as 'IN' | 'OUT';
                const defaultCat = findDefaultManualCategory(newType);
                setFormData((prev) => ({
                  ...prev,
                  type: newType,
                  category: defaultCat ? defaultCat.name : ''
                }));
              }}
            >
              <option value="IN">Entrada (+)</option>
              <option value="OUT">Saída (-)</option>
            </select>
          </div>
          <div>
            <label className="ios-label">Categoria</label>
            <select
              className="ios-input"
              value={formData.category}
              onChange={(e) => setFormData((prev) => ({ ...prev, category: e.target.value }))}
            >
              {/* Categorias de sinal de reserva só aparecem ao editar um
                  lançamento que já as usa — nunca para escolher à mão. */}
              {financialCategories
                .filter(c => c.type === formData.type && (isManualCategory(c.name) || c.name === formData.category))
                .map((category) => (
                  <option key={category.id} value={category.name}>
                    {category.name}
                  </option>
                ))}
            </select>
          </div>
        </div>

        <div>
          <label className="ios-label">Conta</label>
          <select
            className="ios-input"
            value={formData.account}
            onChange={(e) => setFormData((prev) => ({ ...prev, account: e.target.value as FinancialAccount }))}
          >
            {/* 'Devedores' é uma conta virtual (recebíveis) — dinheiro real lançado
                nela some do Cofre/Conta. Só aparece ao editar um lançamento legado. */}
            {(formData.account === ACCOUNT_DEBTORS ? FINANCIAL_ACCOUNTS : CASH_EQUIVALENT_ACCOUNTS).map((account) => (
              <option key={account} value={account}>
                {account}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="ios-label">Valor (R$)</label>
          <input
            type="text"
            role="spinbutton"
            inputMode="decimal"
            className="ios-input tabular-nums font-semibold"
            onFocus={(e) => e.target.select()}
            value={formData.amount}
            onChange={(e) => setFormData((prev) => ({ ...prev, amount: maskDecimalInput(e.target.value) }))}
            placeholder="0,00"
          />
        </div>

        <div>
          <label className="ios-label">Descrição</label>
          <input
            type="text"
            className="ios-input"
            value={formData.description}
            onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
            placeholder={descriptionPlaceholder}
          />
        </div>
      </div>
    </Modal>
  );
};

export default TransactionFormModal;
