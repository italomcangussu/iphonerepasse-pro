import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Debt, DebtPayment } from '../types';
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

const makeDebtPayment = (overrides: Partial<DebtPayment> = {}): DebtPayment => ({
  id: 'payment-1',
  debtId: 'debt-1',
  amount: 100,
  paymentMethod: 'Pix',
  account: 'Conta Bancária',
  paidAt: '2026-02-10T10:00:00.000Z',
  createdAt: '2026-02-10T10:00:00.000Z',
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
      updateDebt: vi.fn(),
      payDebt: payDebtMock,
      getDebtPayments: getDebtPaymentsMock
    });
  });

  it('creates a new debtor from modal with manual customer input', async () => {
    const user = userEvent.setup();
    render(<Debtors />);

    await user.click(screen.getByRole('button', { name: 'Novo Devedor' }));
    const dialog = screen.getByRole('dialog');

    fireEvent.change(within(dialog).getByPlaceholderText('Nome completo'), { target: { value: 'Cliente Novo' } });
    fireEvent.change(within(dialog).getByPlaceholderText('0,00'), { target: { value: '780' } });
    fireEvent.change(within(dialog).getByPlaceholderText('Ex: pagamento semanal, parcela dia 10...'), {
      target: { value: 'Parcela mensal' }
    });

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
        firstDueDate: undefined,
        installmentsTotal: 1,
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

    fireEvent.change(amountInput, { target: { value: '400' } });
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
    fireEvent.change(amountInput, { target: { value: '120' } });
    expect(amountInput).toHaveValue(120);

    const selects = within(dialog).getAllByRole('combobox');
    await user.selectOptions(selects[1], 'Cofre');

    fireEvent.change(within(dialog).getByPlaceholderText('Observação opcional'), {
      target: { value: 'Pagamento parcial' }
    });
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

  it('shows deadline badges and installment amount for parcelled remaining balance', () => {
    const overdueDebt = makeDebt({
      id: 'debt-overdue',
      customerId: 'cust-2',
      status: 'Parcial',
      originalAmount: 300,
      remainingAmount: 120,
      dueDate: '2025-01-10',
      firstDueDate: '2025-01-10',
      installmentsTotal: 3
    });
    const onTimeDebt = makeDebt({
      id: 'debt-on-time',
      customerId: 'cust-3',
      status: 'Quitada',
      originalAmount: 450,
      remainingAmount: 0,
      dueDate: '2026-12-10',
      firstDueDate: '2026-12-10',
      installmentsTotal: 3
    });

    getDebtPaymentsMock.mockImplementation((debtId: string) => {
      if (debtId === 'debt-on-time') {
        return [makeDebtPayment({ debtId, paidAt: '2026-12-09T09:00:00.000Z' })];
      }
      return [];
    });

    useDataMock.mockReturnValue({
      debts: [
        makeDebt({
          id: 'debt-open',
          customerId: 'cust-1',
          originalAmount: 400,
          remainingAmount: 300,
          status: 'Aberta',
          dueDate: '2099-12-20',
          firstDueDate: '2099-12-20',
          installmentsTotal: 6
        }),
        overdueDebt,
        onTimeDebt
      ],
      customers: [
        {
          id: 'cust-1',
          name: 'Cliente Parcelado',
          cpf: '11111111111',
          phone: '85999990000',
          email: '',
          birthDate: '',
          purchases: 0,
          totalSpent: 0
        },
        {
          id: 'cust-2',
          name: 'Cliente Atrasado',
          cpf: '22222222222',
          phone: '85999990001',
          email: '',
          birthDate: '',
          purchases: 0,
          totalSpent: 0
        },
        {
          id: 'cust-3',
          name: 'Cliente Em Dia',
          cpf: '33333333333',
          phone: '85999990002',
          email: '',
          birthDate: '',
          purchases: 0,
          totalSpent: 0
        }
      ],
      addDebt: addDebtMock,
      updateDebt: vi.fn(),
      payDebt: payDebtMock,
      getDebtPayments: getDebtPaymentsMock
    });

    render(<Debtors />);

    expect(screen.getByText('Atrasado')).toBeInTheDocument();
    expect(screen.getByText('Em dias')).toBeInTheDocument();

    const parcelledRow = screen.getByRole('row', { name: /Cliente Parcelado/i });
    expect(within(parcelledRow).getByText(/50,00/)).toBeInTheDocument();
  });
});
