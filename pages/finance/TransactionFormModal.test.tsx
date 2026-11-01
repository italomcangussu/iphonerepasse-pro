import React, { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { FinancialCategory, Seller } from '../../types';
import TransactionFormModal, { type TransactionFormData } from './TransactionFormModal';

const category = (name: string): FinancialCategory => ({ id: name, name, type: 'OUT', isDefault: false, createdAt: '' });
const seller = (id: string, name: string): Seller => ({ id, name, email: '', authUserId: '', storeId: '', totalSales: 0 });

const Harness: React.FC = () => {
  const [formData, setFormData] = useState<TransactionFormData>({
    type: 'OUT',
    category: 'Aluguel',
    amount: '',
    description: 'Pagamento em Cofre',
    date: '2026-10-28T10:00:00',
    account: 'Cofre',
    payeeSellerId: ''
  });
  return (
    <TransactionFormModal
      open
      isEditing={false}
      isSaving={false}
      formData={formData}
      setFormData={setFormData}
      financialCategories={[category('Aluguel'), category('Salário semanal')]}
      sellers={[seller('s1', 'IGOR SARAIVA'), seller('s2', 'EDSON ROCHA')]}
      findDefaultManualCategory={() => undefined}
      onClose={() => {}}
      onSubmit={() => {}}
    />
  );
};

describe('TransactionFormModal — pagamento de pessoal', () => {
  it('pede o funcionário só em salário semanal e escreve a descrição com nome e semana', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.queryByLabelText('Funcionário')).not.toBeInTheDocument();

    const [, categorySelect] = screen.getAllByRole('combobox');
    await user.selectOptions(categorySelect, 'Salário semanal');
    await user.selectOptions(screen.getByLabelText('Funcionário'), 'IGOR SARAIVA');

    expect(screen.getByDisplayValue('Salário semanal · IGOR SARAIVA · semana 26/10 a 01/11')).toBeInTheDocument();

    await user.selectOptions(categorySelect, 'Aluguel');
    expect(screen.queryByLabelText('Funcionário')).not.toBeInTheDocument();
    expect(screen.getByDisplayValue('Pagamento em Cofre')).toBeInTheDocument();
  });
});
