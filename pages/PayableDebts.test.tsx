import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Creditor, PayableDebt, PayableDebtPayment } from '../types';
import PayableDebts from './PayableDebts';

const useDataMock = vi.fn();
const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();
const addCreditorMock = vi.fn();
const updateCreditorMock = vi.fn();
const removeCreditorMock = vi.fn();
const addPayableDebtMock = vi.fn();
const updatePayableDebtMock = vi.fn();
const removePayableDebtMock = vi.fn();
const addPayableDebtPaymentMock = vi.fn();
const revertPayableDebtPaymentMock = vi.fn();
const getPayableDebtPaymentsMock = vi.fn();

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

vi.mock('../hooks/useIsMobileViewport', () => ({
  useIsMobileViewport: () => false
}));

vi.mock('../services/telemetry', () => ({
  trackUxEvent: vi.fn()
}));

vi.mock('../services/supabase', () => ({
  supabase: {
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn().mockResolvedValue({ error: null }),
        remove: vi.fn().mockResolvedValue({ error: null }),
        createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://example.test/receipt.pdf' }, error: null })
      }))
    }
  }
}));

const makeCreditor = (overrides: Partial<Creditor> = {}): Creditor => ({
  id: 'cred-1',
  name: 'Fornecedor Teste',
  document: undefined,
  documentType: undefined,
  phone: undefined,
  email: undefined,
  notes: undefined,
  createdAt: '2026-05-13T12:00:00.000Z',
  updatedAt: '2026-05-13T12:00:00.000Z',
  ...overrides
});

const makePayableDebt = (overrides: Partial<PayableDebt> = {}): PayableDebt => ({
  id: 'pdbt-1',
  creditorId: 'cred-1',
  creditorName: 'Fornecedor Teste',
  originalAmount: 300,
  remainingAmount: 300,
  status: 'Aberta',
  dueDate: '2099-12-20',
  firstDueDate: '2099-12-20',
  installmentsTotal: 1,
  notes: 'Compra de lote',
  source: 'manual',
  saleId: null,
  entryAccount: 'Conta Bancária',
  createdAt: '2026-05-13T12:00:00.000Z',
  updatedAt: '2026-05-13T12:00:00.000Z',
  ...overrides
});

const makePayablePayment = (overrides: Partial<PayableDebtPayment> = {}): PayableDebtPayment => ({
  id: 'pdpm-1',
  payableDebtId: 'pdbt-1',
  amount: 100,
  paymentMethod: 'Pix',
  account: 'Conta Bancária',
  paidAt: '2026-05-13T14:00:00.000Z',
  createdAt: '2026-05-13T14:00:00.000Z',
  ...overrides
});

describe('PayableDebts page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    addCreditorMock.mockResolvedValue(makeCreditor());
    updateCreditorMock.mockResolvedValue(undefined);
    removeCreditorMock.mockResolvedValue(undefined);
    addPayableDebtMock.mockResolvedValue(makePayableDebt());
    updatePayableDebtMock.mockResolvedValue(undefined);
    removePayableDebtMock.mockResolvedValue(undefined);
    addPayableDebtPaymentMock.mockResolvedValue(undefined);
    revertPayableDebtPaymentMock.mockResolvedValue(undefined);
    getPayableDebtPaymentsMock.mockReturnValue([]);

    useDataMock.mockReturnValue({
      creditors: [makeCreditor()],
      payableDebts: [makePayableDebt()],
      addCreditor: addCreditorMock,
      updateCreditor: updateCreditorMock,
      removeCreditor: removeCreditorMock,
      addPayableDebt: addPayableDebtMock,
      updatePayableDebt: updatePayableDebtMock,
      removePayableDebt: removePayableDebtMock,
      addPayableDebtPayment: addPayableDebtPaymentMock,
      revertPayableDebtPayment: revertPayableDebtPaymentMock,
      getPayableDebtPayments: getPayableDebtPaymentsMock
    });
  });

  it('renders active debt rows with summary values', () => {
    render(<PayableDebts />);

    expect(screen.getByRole('heading', { name: 'Dívidas Ativas' })).toBeInTheDocument();
    expect(screen.getByText('Fornecedor Teste')).toBeInTheDocument();
    expect(screen.getAllByText('Aberta').length).toBeGreaterThan(0);
    expect(screen.getAllByText('R$ 300,00').length).toBeGreaterThan(0);
  });

  it('creates a new payable debt with selected creditor and entry account', async () => {
    const user = userEvent.setup();
    render(<PayableDebts />);

    await user.click(screen.getByRole('button', { name: /nova dívida ativa/i }));
    const dialog = screen.getByRole('dialog');

    await user.selectOptions(within(dialog).getAllByRole('combobox')[0], 'cred-1');
    fireEvent.change(within(dialog).getByPlaceholderText('0'), { target: { value: '250' } });
    await user.selectOptions(within(dialog).getAllByRole('combobox')[1], 'Cofre');
    fireEvent.change(within(dialog).getByPlaceholderText('Descrição da dívida, condições, etc...'), {
      target: { value: 'Entrada temporária' }
    });

    await user.click(within(dialog).getByRole('button', { name: /cadastrar dívida/i }));

    await waitFor(() => {
      expect(addPayableDebtMock).toHaveBeenCalledWith({
        creditorId: 'cred-1',
        amount: 250,
        firstDueDate: undefined,
        dueDate: undefined,
        installmentsTotal: 1,
        notes: 'Entrada temporária',
        account: 'Cofre'
      });
    });
    expect(toastSuccessMock).toHaveBeenCalledWith('Dívida ativa cadastrada.');
  });

  it('registers a payable debt payment with selected account', async () => {
    const user = userEvent.setup();
    render(<PayableDebts />);

    await user.click(screen.getByRole('button', { name: 'Pagar' }));
    const dialog = screen.getByRole('dialog');

    const amountInput = within(dialog).getByPlaceholderText('0');
    fireEvent.change(amountInput, { target: { value: '120' } });
    await user.selectOptions(within(dialog).getAllByRole('combobox')[1], 'Cofre');
    fireEvent.change(within(dialog).getByPlaceholderText('Observação opcional'), {
      target: { value: 'Pagamento parcial' }
    });

    await user.click(within(dialog).getByRole('button', { name: 'Confirmar Pagamento' }));

    await waitFor(() => {
      expect(addPayableDebtPaymentMock).toHaveBeenCalledWith(expect.objectContaining({
        payableDebtId: 'pdbt-1',
        amount: 120,
        paymentMethod: 'Pix',
        account: 'Cofre',
        notes: 'Pagamento parcial'
      }));
    });
    expect(toastSuccessMock).toHaveBeenCalledWith('Pagamento registrado com sucesso.');
  });

  it('shows payment history and requests reversal confirmation', async () => {
    const user = userEvent.setup();
    getPayableDebtPaymentsMock.mockReturnValue([makePayablePayment()]);

    render(<PayableDebts />);

    await user.click(screen.getByRole('button', { name: 'Pagar' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/histórico de pagamentos/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/R\$ 100/)).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: /estornar/i }));
    expect(screen.getByText('Estornar pagamento')).toBeInTheDocument();
  });
});
