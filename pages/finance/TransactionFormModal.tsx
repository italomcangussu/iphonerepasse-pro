import React from 'react';
import Modal from '../../components/ui/Modal';
import type { FinancialCategory, FinancialAccount, Seller, Transaction } from '../../types';
import { ACCOUNT_DEBTORS, CASH_EQUIVALENT_ACCOUNTS, FINANCIAL_ACCOUNTS } from '../../utils/financialAccounts';
import { maskDecimalInput } from '../../utils/inputMasks';
import {
  buildDefaultTransactionDescription,
  buildPayrollDescription,
  isAutoDescription,
  isManualCategory,
  isPayrollCategory
} from './financeHelpers';

export interface TransactionFormData {
  type: 'IN' | 'OUT';
  category: Transaction['category'];
  amount: string;
  description: string;
  date: string;
  account: FinancialAccount;
  /** Só vale em categoria de pessoal (salário ou serviço semanal); '' = ninguém escolhido. */
  payeeSellerId: string;
}

// Em pagamento de pessoal a descrição se escreve sozinha (categoria · funcionário · semana),
// mas só enquanto a pessoa não digitou a dela.
const syncPayrollDescription = (form: TransactionFormData, sellers: Seller[]): TransactionFormData => {
  if (!isAutoDescription(form.description, form.account)) return form;
  const payee = sellers.find((seller) => seller.id === form.payeeSellerId);
  if (isPayrollCategory(form.category) && payee) {
    return { ...form, description: buildPayrollDescription(form.category, payee.name, form.date) };
  }
  return { ...form, description: buildDefaultTransactionDescription(form.type, form.account) };
};

interface TransactionFormModalProps {
  open: boolean;
  isEditing: boolean;
  isSaving: boolean;
  formData: TransactionFormData;
  setFormData: React.Dispatch<React.SetStateAction<TransactionFormData>>;
  financialCategories: FinancialCategory[];
  sellers: Seller[];
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
  sellers,
  findDefaultManualCategory,
  onClose,
  onSubmit
}) => {
  const isIncoming = formData.type === 'IN';
  const title = isEditing ? 'Editar lançamento' : isIncoming ? 'Novo Aporte' : 'Novo Pagamento';
  const confirmLabel = isEditing ? 'Salvar alterações' : isIncoming ? 'Confirmar Aporte' : 'Confirmar Pagamento';
  const descriptionPlaceholder = isIncoming ? 'Ex: Aporte em caixa' : 'Ex: Pagamento de conta';
  const isPayroll = isPayrollCategory(formData.category);
  const sortedSellers = [...sellers].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  const updateForm = (patch: Partial<TransactionFormData>) =>
    setFormData((prev) => syncPayrollDescription({ ...prev, ...patch }, sellers));

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
                updateForm({ type: newType, category: defaultCat ? defaultCat.name : '' });
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
              onChange={(e) => updateForm({ category: e.target.value })}
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

        {isPayroll && (
          <div>
            <label className="ios-label" htmlFor="transaction-payee">Funcionário</label>
            <select
              id="transaction-payee"
              className="ios-input"
              required
              value={formData.payeeSellerId}
              onChange={(e) => updateForm({ payeeSellerId: e.target.value })}
            >
              <option value="" disabled>Escolha quem está recebendo</option>
              {sortedSellers.map((seller) => (
                <option key={seller.id} value={seller.id}>
                  {seller.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-ios-footnote text-gray-500 dark:text-surface-dark-500">
              O nome aparece no extrato de despesas e no detalhe do lançamento.
            </p>
          </div>
        )}

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
