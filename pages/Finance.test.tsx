import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Finance from './Finance';
import { Condition, DeviceType, StockStatus, WarrantyType } from '../types';

const useDataMock = vi.fn();
const toastErrorMock = vi.fn();
const toastSuccessMock = vi.fn();
const toastConfirmMock = vi.fn();
const addTransactionMock = vi.fn();
const updateTransactionMock = vi.fn();
const removeTransactionMock = vi.fn();

vi.mock('../services/dataContext', () => ({
  useData: () => useDataMock()
}));

vi.mock('../components/ui/ToastProvider', () => ({
  useToast: () => ({
    success: toastSuccessMock,
    error: toastErrorMock,
    info: vi.fn(),
    confirm: toastConfirmMock,
    dismiss: vi.fn(),
    clear: vi.fn()
  })
}));

describe('Finance page resilience', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    addTransactionMock.mockResolvedValue(undefined);
    updateTransactionMock.mockResolvedValue(undefined);
    removeTransactionMock.mockResolvedValue(undefined);
    toastConfirmMock.mockResolvedValue(true);

    useDataMock.mockReturnValue({
      stock: [
        {
          id: 'stk-1',
          type: DeviceType.IPHONE,
          model: 'iPhone 14',
          color: 'Preto',
          capacity: '128 GB',
          imei: '123456789012345',
          condition: Condition.USED,
          status: StockStatus.AVAILABLE,
          storeId: 'store-1',
          purchasePrice: 1000,
          sellPrice: 1300,
          maxDiscount: 0,
          warrantyType: WarrantyType.STORE,
          costs: [],
          photos: [],
          entryDate: '2026-02-15'
        }
      ],
      transactions: [],
      debts: [],
      debtPayments: [],
      customers: [],
      financialCategories: [
        {
          id: 'fcat-in-aporte',
          name: 'Aporte',
          type: 'IN',
          isDefault: true,
          createdAt: '2026-01-01T00:00:00.000Z'
        },
        {
          id: 'fcat-out-servico',
          name: 'Serviço',
          type: 'OUT',
          isDefault: true,
          createdAt: '2026-01-01T00:00:00.000Z'
        }
      ],
      sales: [
        {
          id: 'sale-1',
          customerId: 'cust-1',
          sellerId: 'sel-1',
          items: undefined,
          paymentMethods: [],
          tradeInValue: undefined,
          discount: 0,
          total: undefined,
          date: '2026-02-01T12:00:00.000Z',
          warrantyExpiresAt: '2026-05-01T12:00:00.000Z'
        }
      ],
      addTransaction: addTransactionMock,
      updateTransaction: updateTransactionMock,
      removeTransaction: removeTransactionMock
    });
  });

  it('does not crash when sale has missing items and numeric fields', async () => {
    const user = userEvent.setup();
    render(<Finance />);

    await user.click(screen.getByRole('button', { name: 'Faturamento' }));

    expect(screen.getByText('Relatório de Vendas')).toBeInTheDocument();
    expect(screen.getByText('Sem itens')).toBeInTheDocument();
    expect(screen.getAllByText('R$ 0').length).toBeGreaterThan(0);
  });

  it('counts trade-in value as gross revenue and customer payment total', async () => {
    const user = userEvent.setup();

    useDataMock.mockReturnValue({
      stock: [],
      transactions: [],
      debts: [],
      debtPayments: [],
      customers: [],
      financialCategories: [],
      sales: [
        {
          id: 'sale-trade-in',
          customerId: 'cust-1',
          sellerId: 'sel-1',
          items: [
            {
              id: 'stk-1',
              type: DeviceType.IPHONE,
              model: 'iPhone 14 Pro',
              color: 'Preto',
              capacity: '128 GB',
              imei: '123456789012345',
              condition: Condition.USED,
              status: StockStatus.SOLD,
              storeId: 'store-1',
              purchasePrice: 1000,
              sellPrice: 2000,
              maxDiscount: 0,
              warrantyType: WarrantyType.STORE,
              costs: [],
              photos: [],
              entryDate: '2026-02-15'
            }
          ],
          paymentMethods: [{ type: 'Pix', amount: 1500 }],
          tradeInValue: 500,
          discount: 0,
          total: 1500,
          date: '2026-02-01T12:00:00.000Z',
          warrantyExpiresAt: null
        }
      ],
      addTransaction: addTransactionMock,
      updateTransaction: updateTransactionMock,
      removeTransaction: removeTransactionMock
    });

    render(<Finance />);

    await user.click(screen.getByRole('button', { name: 'Faturamento' }));

    expect(screen.getByText('Faturamento Total')).toBeInTheDocument();
    expect(screen.getAllByText('R$ 2.000').length).toBeGreaterThan(0);
    expect(screen.getAllByText('R$ 1.000').length).toBeGreaterThan(0);
  });

  it('uses explicit aporte/pagamento flow without showing duplicate type tabs', async () => {
    const user = userEvent.setup();
    render(<Finance />);

    await user.click(screen.getByRole('button', { name: 'Conta Bancária' }));
    await user.click(screen.getByRole('button', { name: 'Aporte' }));

    expect(screen.getByText('Novo Aporte')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirmar Aporte' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Entrada (+)' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Saída (-)' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    await user.click(screen.getByRole('button', { name: 'Pagar' }));
    expect(screen.getByText('Novo Pagamento')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirmar Pagamento' })).toBeInTheDocument();
  });

  it('opens launch details on row click and allows editing', async () => {
    const user = userEvent.setup();
    useDataMock.mockReturnValue({
      stock: [],
      transactions: [
        {
          id: 'trx-1',
          type: 'OUT',
          category: 'Serviço',
          amount: 250,
          date: '2026-03-10T14:30:00.000Z',
          description: 'Pagamento de fornecedor',
          account: 'Conta Bancária'
        }
      ],
      debts: [],
      debtPayments: [],
      customers: [],
      financialCategories: [
        {
          id: 'fcat-in-aporte',
          name: 'Aporte',
          type: 'IN',
          isDefault: true,
          createdAt: '2026-01-01T00:00:00.000Z'
        },
        {
          id: 'fcat-out-servico',
          name: 'Serviço',
          type: 'OUT',
          isDefault: true,
          createdAt: '2026-01-01T00:00:00.000Z'
        }
      ],
      sales: [],
      addTransaction: addTransactionMock,
      updateTransaction: updateTransactionMock,
      removeTransaction: removeTransactionMock
    });

    render(<Finance />);

    await user.click(screen.getByRole('button', { name: 'Conta Bancária' }));
    await user.click(screen.getByText('Pagamento de fornecedor'));

    expect(screen.getByText('Detalhes do lançamento')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Editar' }));

    expect(screen.getByText('Editar lançamento')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Salvar alterações' })).toBeInTheDocument();
  });

  it('cancels a transaction from details flow', async () => {
    const user = userEvent.setup();
    useDataMock.mockReturnValue({
      stock: [],
      transactions: [
        {
          id: 'trx-2',
          type: 'IN',
          category: 'Aporte',
          amount: 1000,
          date: '2026-03-11T09:00:00.000Z',
          description: 'Aporte inicial',
          account: 'Conta Bancária'
        }
      ],
      debts: [],
      debtPayments: [],
      customers: [],
      financialCategories: [
        {
          id: 'fcat-in-aporte',
          name: 'Aporte',
          type: 'IN',
          isDefault: true,
          createdAt: '2026-01-01T00:00:00.000Z'
        },
        {
          id: 'fcat-out-servico',
          name: 'Serviço',
          type: 'OUT',
          isDefault: true,
          createdAt: '2026-01-01T00:00:00.000Z'
        }
      ],
      sales: [],
      addTransaction: addTransactionMock,
      updateTransaction: updateTransactionMock,
      removeTransaction: removeTransactionMock
    });

    render(<Finance />);

    await user.click(screen.getByRole('button', { name: 'Conta Bancária' }));
    await user.click(screen.getByText('Aporte inicial'));
    await user.click(screen.getByRole('button', { name: 'Cancelar lançamento' }));

    const dialogs = screen.getAllByRole('dialog');
    const confirmDialog = dialogs[dialogs.length - 1];
    await user.click(within(confirmDialog).getByRole('button', { name: 'Cancelar lançamento' }));

    await waitFor(() => expect(removeTransactionMock).toHaveBeenCalledWith('trx-2'));
  });
});
