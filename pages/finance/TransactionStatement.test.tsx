import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import TransactionStatement from './TransactionStatement';
import type { Transaction } from '../../types';

const transaction: Transaction = {
  id: 't1',
  type: 'IN',
  category: 'Venda',
  amount: 1200,
  date: '2026-10-31T17:32:00.000Z',
  description: 'Venda #10',
  account: 'Conta Bancária'
};

const renderStatement = (isMobile: boolean) =>
  render(
    <TransactionStatement
      filtered={[transaction]}
      page={0}
      setPage={vi.fn()}
      isMobile={isMobile}
      contextMenu={{ bind: () => undefined } as never}
      buildTransactionContextActions={() => []}
      setSelectedTransaction={vi.fn()}
      describeTransaction={(t) => t.description}
    />
  );

describe('TransactionStatement', () => {
  it('mostra data e hora do lançamento no celular', () => {
    renderStatement(true);
    expect(screen.getByText('31/10/2026 · 14:32')).toBeInTheDocument();
  });

  it('mostra data e hora do lançamento na tabela', () => {
    renderStatement(false);
    expect(screen.getByRole('columnheader', { name: 'Data e hora' })).toBeInTheDocument();
    expect(screen.getByText('31/10/2026')).toBeInTheDocument();
    expect(screen.getByText('14:32')).toBeInTheDocument();
  });
});
