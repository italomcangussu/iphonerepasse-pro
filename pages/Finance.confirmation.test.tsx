import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Finance from './Finance';
import { ToastProvider } from '../components/ui/ToastProvider';

const useDataMock = vi.fn();
const removeTransactionMock = vi.fn();

vi.mock('../services/dataContext', () => ({
  useData: () => useDataMock()
}));

describe('Finance cancel transaction confirmation', () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    vi.clearAllMocks();
    removeTransactionMock.mockResolvedValue(undefined);
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('max-width: 767px'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as typeof window.matchMedia;

    useDataMock.mockReturnValue({
      stock: [],
      transactions: [
        {
          id: 'trx-payable-1',
          type: 'OUT',
          category: 'Pagamento de dívida ativa',
          amount: 5000,
          date: '2026-04-27T15:00:00.000Z',
          description: 'Pagamento dívida ativa - HOSPITAL DOS IPHONES',
          account: 'Conta Bancária',
          debtPaymentId: null,
          payableDebtPaymentId: 'pdpm-1'
        }
      ],
      sales: [],
      debts: [],
      debtPayments: [],
      customers: [],
      financialCategories: [],
      payableDebts: [],
      creditors: [],
      addTransaction: vi.fn(),
      updateTransaction: vi.fn(),
      removeTransaction: removeTransactionMock,
      removeDebt: vi.fn()
    });
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it('opens the real confirmation dialog and executes cancellation from the mobile details modal', async () => {
    const user = userEvent.setup();

    render(
      <ToastProvider>
        <Finance />
      </ToastProvider>
    );

    await user.click(screen.getByRole('button', { name: 'Conta Bancária' }));
    await user.click(screen.getByRole('button', { name: /Pagamento dívida ativa - HOSPITAL DOS IPHONES/i }));
    await user.click(screen.getByRole('button', { name: 'Cancelar lançamento' }));

    const dialogs = screen.getAllByRole('dialog');
    const confirmDialog = dialogs[dialogs.length - 1];
    expect(within(confirmDialog).getByRole('heading', { name: 'Cancelar lançamento' })).toBeInTheDocument();

    await user.click(within(confirmDialog).getByRole('button', { name: 'Cancelar lançamento' }));

    await waitFor(() => expect(removeTransactionMock).toHaveBeenCalledWith('trx-payable-1'));
  });
});
