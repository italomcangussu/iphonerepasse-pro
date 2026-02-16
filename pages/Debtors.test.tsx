import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Debt } from '../types';
import Debtors from './Debtors';

const addDebtMock = vi.fn();
const payDebtMock = vi.fn();
const getDebtPaymentsMock = vi.fn();
const useDataMock = vi.fn();
const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();

vi.mock('../services/dataContext', () => ({
  useData: () => useDataMock()
}));

vi.mock('../components/ui/ToastProvider', () => ({
  useToast: () => ({
    success: toastSuccessMock,
    error: toastErrorMock,
    info: vi.fn(),
    dismiss: vi.fn(),
    clear: vi.fn()
  })
}));

const makeDebt = (overrides: Partial<Debt> = {}): Debt => ({
  id: 'debt-1',
  customerId: 'cust-1',
  originalAmount: 300,
  remainingAmount: 300,
  status: 'Aberta',
  source: 'manual',
  createdAt: '2026-02-10T12:00:00.000Z',
  updatedAt: '2026-02-10T12:00:00.000Z',
  ...overrides
});

describe('Debtors page integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDebtPaymentsMock.mockReturnValue([]);
    addDebtMock.mockResolvedValue(undefined);
    payDebtMock.mockResolvedValue(undefined);

    useDataMock.mockReturnValue({
      debts: [makeDebt()],
      customers: [
        {
          id: 'cust-1',
          name: 'Felipe Vieira',
          cpf: '11111111111',
          phone: '85999990000',
          email: '',
          birthDate: '',
          purchases: 0,
          totalSpent: 0
        }
      ],
      addDebt: addDebtMock,
      payDebt: payDebtMock,
      getDebtPayments: getDebtPaymentsMock
    });
  });

  it('creates a new debtor from modal with manual customer input', async () => {
    const user = userEvent.setup();
    render(<Debtors />);

    await user.click(screen.getByRole('button', { name: 'Novo Devedor' }));
    const dialog = screen.getByRole('dialog');

    await user.type(within(dialog).getByPlaceholderText('Nome completo'), 'Cliente Novo');
    await user.type(within(dialog).getByPlaceholderText('0,00'), '780');
    await user.type(within(dialog).getByPlaceholderText('Ex: pagamento semanal, parcela dia 10...'), 'Parcela mensal');

    await user.click(within(dialog).getByRole('button', { name: 'Salvar Devedor' }));

    await waitFor(() => {
      expect(addDebtMock).toHaveBeenCalledWith({
        customerId: undefined,
        customer: {
          name: 'Cliente Novo',
          cpf: '',
          phone: '',
          email: ''
        },
        amount: 780,
        dueDate: undefined,
        notes: 'Parcela mensal',
        source: 'manual'
      });
    });
    expect(toastSuccessMock).toHaveBeenCalledWith('Devedor cadastrado com sucesso.');
  });

  it('blocks debt payment above remaining balance', async () => {
    const user = userEvent.setup();
    render(<Debtors />);

    await user.click(screen.getByRole('button', { name: 'Pagamento' }));
    const dialog = screen.getByRole('dialog');
    const amountInput = within(dialog).getByRole('spinbutton');

    await user.clear(amountInput);
    await user.type(amountInput, '400');
    await user.click(within(dialog).getByRole('button', { name: 'Confirmar Pagamento' }));

    expect(payDebtMock).not.toHaveBeenCalled();
    expect(toastErrorMock).toHaveBeenCalledWith('O valor não pode ser maior que o saldo da dívida.');
  });

  it('registers partial debt payment with selected account', async () => {
    const user = userEvent.setup();
    render(<Debtors />);

    await user.click(screen.getByRole('button', { name: 'Pagamento' }));
    const dialog = screen.getByRole('dialog');

    const amountInput = within(dialog).getByRole('spinbutton');
    await user.clear(amountInput);
    await user.type(amountInput, '120');

    const selects = within(dialog).getAllByRole('combobox');
    await user.selectOptions(selects[1], 'Cofre');

    await user.type(within(dialog).getByPlaceholderText('Observação opcional'), 'Pagamento parcial');
    await user.click(within(dialog).getByRole('button', { name: 'Confirmar Pagamento' }));

    await waitFor(() => {
      expect(payDebtMock).toHaveBeenCalledWith({
        debtId: 'debt-1',
        amount: 120,
        paymentMethod: 'Pix',
        account: 'Cofre',
        notes: 'Pagamento parcial'
      });
    });
    expect(toastSuccessMock).toHaveBeenCalledWith('Pagamento registrado com sucesso.');
  });
});
