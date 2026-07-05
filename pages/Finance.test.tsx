import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Finance from './Finance';
import { Condition, DeviceType, StockStatus, WarrantyType } from '../types';

const useDataMock = vi.fn();
const toastErrorMock = vi.fn();
const toastSuccessMock = vi.fn();
const toastConfirmMock = vi.fn();
const addTransactionMock = vi.fn();
const updateTransactionMock = vi.fn();
const removeTransactionMock = vi.fn();
const removeDebtMock = vi.fn();
const transferBetweenAccountsMock = vi.fn();

const mockMatchMediaWidth = (width: number) => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: query.includes('hover: hover') || query.includes('pointer: fine')
        ? width >= 1024
        : /max-width:\s*(\d+)px/.test(query)
          ? width <= Number(query.match(/max-width:\s*(\d+)px/)?.[1])
          : false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
};

vi.mock('../services/dataContext', () => ({
  useData: () => useDataMock()
}));

vi.mock('../contexts/ThemeContext', () => ({
  useTheme: () => ({ theme: 'light', resolvedTheme: 'light', setTheme: () => {}, toggleTheme: () => {} })
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
    mockMatchMediaWidth(1280);
    addTransactionMock.mockResolvedValue(undefined);
    updateTransactionMock.mockResolvedValue(undefined);
    removeTransactionMock.mockResolvedValue(undefined);
    removeDebtMock.mockResolvedValue(undefined);
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
      payableDebts: [],
      creditors: [],
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
      removeTransaction: removeTransactionMock,
      removeDebt: removeDebtMock
    });
  });

  it('does not crash when sale has missing items and numeric fields', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Finance />
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: 'Faturamento' }));

    expect(screen.getByText('Relatório de Vendas')).toBeInTheDocument();
    expect(screen.getByText('Sem itens')).toBeInTheDocument();
    expect(screen.getAllByText('R$ 0').length).toBeGreaterThan(0);
  });

  it('keeps financial movement cards through iPad portrait widths', async () => {
    const user = userEvent.setup();
    mockMatchMediaWidth(834);
    useDataMock.mockReturnValue({
      stock: [],
      transactions: [
        {
          id: 'trx-ipad-bank',
          type: 'IN',
          category: 'Aporte',
          amount: 1000,
          date: '2026-06-22T12:00:00.000Z',
          description: 'Aporte no iPad',
          account: 'Conta Bancária'
        }
      ],
      debts: [],
      debtPayments: [],
      customers: [],
      financialCategories: [],
      payableDebts: [],
      creditors: [],
      sales: [],
      sellers: [],
      addTransaction: addTransactionMock,
      updateTransaction: updateTransactionMock,
      removeTransaction: removeTransactionMock,
      removeDebt: removeDebtMock
    });

    render(
      <MemoryRouter>
        <Finance />
      </MemoryRouter>
    );

    await user.click(screen.getByTestId('finance-tab-bank'));

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByText(/Toque para detalhes/i)).toBeInTheDocument();
  });

  it('exposes payable debt search with an accessible name', async () => {
    render(
      <MemoryRouter>
        <Finance />
      </MemoryRouter>
    );

    await userEvent.click(screen.getByTestId('finance-tab-payable_debts'));

    expect(screen.getByRole('searchbox', { name: /buscar dívidas ativas/i })).toBeInTheDocument();
  });

  it('names the export button for the active account statement', async () => {
    render(<Finance />);

    await userEvent.click(screen.getByTestId('finance-tab-bank'));

    expect(screen.getByRole('button', { name: /exportar extrato de conta bancária/i })).toBeInTheDocument();
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
      payableDebts: [],
      creditors: [],
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
      removeTransaction: removeTransactionMock,
      removeDebt: removeDebtMock
    });

    render(
      <MemoryRouter>
        <Finance />
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: 'Faturamento' }));

    expect(screen.getByText('Faturamento Total')).toBeInTheDocument();
    expect(screen.getAllByText('R$ 2.000').length).toBeGreaterThan(0);
    expect(screen.getAllByText('R$ 1.000').length).toBeGreaterThan(0);
  });

  it('uses explicit aporte/pagamento flow without showing duplicate type tabs', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Finance />
      </MemoryRouter>
    );

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
      payableDebts: [],
      creditors: [],
      sales: [],
      addTransaction: addTransactionMock,
      updateTransaction: updateTransactionMock,
      removeTransaction: removeTransactionMock,
      removeDebt: removeDebtMock
    });

    render(<Finance />);

    await user.click(screen.getByRole('button', { name: 'Conta Bancária' }));
    await user.click(screen.getByText('Pagamento de fornecedor'));

    expect(screen.getByText('Detalhes do lançamento')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Editar' }));

    expect(screen.getByText('Editar lançamento')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Salvar alterações' })).toBeInTheDocument();
  });

  it('opens desktop context actions for a financial transaction row', async () => {
    const user = userEvent.setup();
    useDataMock.mockReturnValue({
      stock: [],
      transactions: [
        {
          id: 'trx-context',
          type: 'OUT',
          category: 'Serviço',
          amount: 500,
          date: '2026-06-10T12:00:00.000Z',
          description: 'Pagamento de fornecedor',
          account: 'Conta Bancária'
        }
      ],
      debts: [],
      debtPayments: [],
      customers: [],
      financialCategories: [
        {
          id: 'fcat-out-servico',
          name: 'Serviço',
          type: 'OUT',
          isDefault: true,
          createdAt: '2026-01-01T00:00:00.000Z'
        }
      ],
      payableDebts: [],
      creditors: [],
      sales: [],
      addTransaction: addTransactionMock,
      updateTransaction: updateTransactionMock,
      removeTransaction: removeTransactionMock,
      removeDebt: removeDebtMock
    });

    render(<Finance />);

    await user.click(screen.getByRole('button', { name: 'Conta Bancária' }));
    const row = screen.getByText('Pagamento de fornecedor').closest('tr');
    expect(row).not.toBeNull();

    fireEvent.contextMenu(row!, { clientX: 260, clientY: 260 });

    expect(screen.getByRole('menu', { name: /Ações do lançamento/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Ver detalhes' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Cancelar lançamento' })).toBeInTheDocument();
    await user.click(screen.getByRole('menuitem', { name: 'Editar' }));

    expect(screen.getByText('Editar lançamento')).toBeInTheDocument();
  });

  it('shows the seller name for sale commission transaction details', async () => {
    const user = userEvent.setup();
    useDataMock.mockReturnValue({
      stock: [],
      transactions: [
        {
          id: 'trx-commission',
          type: 'OUT',
          category: 'Comissão',
          amount: 50,
          date: '2026-06-09T18:14:12.000Z',
          description: 'Comissão de venda - sale-0130057d-495c-4b76-83a4-d53ddb86afca',
          account: 'Conta Bancária',
          saleId: 'sale-0130057d-495c-4b76-83a4-d53ddb86afca'
        }
      ],
      debts: [],
      debtPayments: [],
      customers: [],
      financialCategories: [
        {
          id: 'fcat-out-comissao',
          name: 'Comissão',
          type: 'OUT',
          isDefault: true,
          createdAt: '2026-01-01T00:00:00.000Z'
        }
      ],
      payableDebts: [],
      creditors: [],
      sales: [
        {
          id: 'sale-0130057d-495c-4b76-83a4-d53ddb86afca',
          customerId: 'cust-1',
          sellerId: 'sel-igor',
          items: [],
          paymentMethods: [],
          tradeInValue: 0,
          discount: 0,
          total: 1000,
          date: '2026-06-09T18:14:12.000Z',
          warrantyExpiresAt: null,
          commission: 50
        }
      ],
      sellers: [
        {
          id: 'sel-igor',
          name: 'Igor',
          email: '',
          authUserId: '',
          storeId: 'store-1',
          totalSales: 1000
        }
      ],
      addTransaction: addTransactionMock,
      updateTransaction: updateTransactionMock,
      removeTransaction: removeTransactionMock,
      removeDebt: removeDebtMock
    });

    render(<Finance />);

    await user.click(screen.getByRole('button', { name: 'Conta Bancária' }));
    await user.click(screen.getByText('Comissão de venda - sale-0130057d-495c-4b76-83a4-d53ddb86afca'));

    expect(screen.getByText('Comissão recebida pelo vendedor Igor')).toBeInTheDocument();
  });

  it('shows the customer name for sale-linked transaction details, preserving the type label', async () => {
    const user = userEvent.setup();
    const tradeInDescription = 'Venda (Trade-in) - sale-3044a752-1143-40b2-b336-5315c9a3fb86';
    const cardDescription = 'Venda (Cartão) liquido=4390 bruto=4677.18 taxa=287.18 - sale-3044a752-1143-40b2-b336-5315c9a3fb86';
    useDataMock.mockReturnValue({
      stock: [],
      transactions: [
        {
          id: 'trx-trade-in',
          type: 'IN',
          category: 'Venda',
          amount: 1100,
          date: '2026-06-08T18:14:12.000Z',
          description: tradeInDescription,
          account: 'Conta Bancária',
          saleId: 'sale-3044a752-1143-40b2-b336-5315c9a3fb86'
        },
        {
          id: 'trx-card',
          type: 'IN',
          category: 'Venda',
          amount: 4390,
          date: '2026-06-08T18:14:12.000Z',
          description: cardDescription,
          account: 'Conta Bancária',
          saleId: 'sale-3044a752-1143-40b2-b336-5315c9a3fb86'
        }
      ],
      debts: [],
      debtPayments: [],
      customers: [
        { id: 'cust-1', name: 'Maria Souza', cpf: '', phone: '', email: '', purchases: 0, totalSpent: 0 }
      ],
      financialCategories: [],
      payableDebts: [],
      creditors: [],
      sales: [
        {
          id: 'sale-3044a752-1143-40b2-b336-5315c9a3fb86',
          customerId: 'cust-1',
          sellerId: 'sel-igor',
          items: [],
          paymentMethods: [],
          tradeInValue: 1100,
          discount: 0,
          total: 4390,
          date: '2026-06-08T18:14:12.000Z',
          warrantyExpiresAt: null
        }
      ],
      sellers: [],
      addTransaction: addTransactionMock,
      updateTransaction: updateTransactionMock,
      removeTransaction: removeTransactionMock,
      removeDebt: removeDebtMock
    });

    render(<Finance />);

    await user.click(screen.getByRole('button', { name: 'Conta Bancária' }));
    await user.click(screen.getByText(tradeInDescription));
    expect(screen.getByText('Venda (Trade-in) - Maria Souza')).toBeInTheDocument();

    await user.click(screen.getByText(cardDescription));
    expect(screen.getByText('Venda (Cartão) liquido=4390 bruto=4677.18 taxa=287.18 - Maria Souza')).toBeInTheDocument();
  });

  it('shows the customer name for debt settlement transaction details', async () => {
    const user = userEvent.setup();
    const debtDescription = 'Quitação de dívida - debt-88c8a0a7-3fd5-4dad-a5c0-65666a41f422';
    useDataMock.mockReturnValue({
      stock: [],
      transactions: [
        {
          id: 'trx-debt',
          type: 'IN',
          category: 'Venda',
          amount: 260,
          date: '2026-06-08T18:14:12.000Z',
          description: debtDescription,
          account: 'Conta Bancária',
          saleId: 'sale-x',
          debtPaymentId: 'dp-1'
        }
      ],
      debts: [
        {
          id: 'debt-88c8a0a7-3fd5-4dad-a5c0-65666a41f422',
          customerId: 'cust-9',
          saleId: 'sale-x',
          originalAmount: 260,
          remainingAmount: 0,
          status: 'Quitada',
          source: 'pdv',
          createdAt: '2026-06-01T00:00:00.000Z',
          updatedAt: '2026-06-08T00:00:00.000Z'
        }
      ],
      debtPayments: [],
      customers: [
        { id: 'cust-9', name: 'Carlos Lima', cpf: '', phone: '', email: '', purchases: 0, totalSpent: 0 }
      ],
      financialCategories: [],
      payableDebts: [],
      creditors: [],
      sales: [],
      sellers: [],
      addTransaction: addTransactionMock,
      updateTransaction: updateTransactionMock,
      removeTransaction: removeTransactionMock,
      removeDebt: removeDebtMock
    });

    render(<Finance />);

    await user.click(screen.getByRole('button', { name: 'Conta Bancária' }));
    await user.click(screen.getByText(debtDescription));

    expect(screen.getByText('Quitação de dívida - Carlos Lima')).toBeInTheDocument();
  });

  it('filters bank and safe statements by existing income or expense category', async () => {
    const user = userEvent.setup();
    useDataMock.mockReturnValue({
      stock: [],
      transactions: [
        {
          id: 'trx-bank-in',
          type: 'IN',
          category: 'Aporte',
          amount: 1000,
          date: '2026-03-11T09:00:00.000Z',
          description: 'Aporte inicial',
          account: 'Conta Bancária'
        },
        {
          id: 'trx-bank-out',
          type: 'OUT',
          category: 'Serviço',
          amount: 250,
          date: '2026-03-10T14:30:00.000Z',
          description: 'Pagamento de fornecedor',
          account: 'Conta Bancária'
        },
        {
          id: 'trx-safe-out',
          type: 'OUT',
          category: 'Manutenção',
          amount: 120,
          date: '2026-03-09T10:00:00.000Z',
          description: 'Manutenção cofre',
          account: 'Cofre'
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
        },
        {
          id: 'fcat-out-manutencao',
          name: 'Manutenção',
          type: 'OUT',
          isDefault: false,
          createdAt: '2026-01-01T00:00:00.000Z'
        }
      ],
      payableDebts: [],
      creditors: [],
      sales: [],
      addTransaction: addTransactionMock,
      updateTransaction: updateTransactionMock,
      removeTransaction: removeTransactionMock,
      removeDebt: removeDebtMock
    });

    render(
      <MemoryRouter>
        <Finance />
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: 'Conta Bancária' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Tipo de aporte/despesa' }), 'Serviço');

    expect(screen.getByText('Pagamento de fornecedor')).toBeInTheDocument();
    expect(screen.queryByText('Aporte inicial')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cofre' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Tipo de aporte/despesa' }), 'Manutenção');

    expect(screen.getByText('Manutenção cofre')).toBeInTheDocument();
    expect(screen.queryByText('Nenhuma movimentação registrada.')).not.toBeInTheDocument();
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
      payableDebts: [],
      creditors: [],
      sales: [],
      addTransaction: addTransactionMock,
      updateTransaction: updateTransactionMock,
      removeTransaction: removeTransactionMock,
      removeDebt: removeDebtMock
    });

    render(<Finance />);

    await user.click(screen.getByRole('button', { name: 'Conta Bancária' }));
    await user.click(screen.getByText('Aporte inicial'));
    await user.click(screen.getByRole('button', { name: 'Cancelar lançamento' }));

    await waitFor(() => expect(toastConfirmMock).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Cancelar lançamento',
      confirmLabel: 'Cancelar lançamento',
      variant: 'danger'
    })));
    await waitFor(() => expect(removeTransactionMock).toHaveBeenCalledWith('trx-2'));
  });

  it('allows deleting a debtor launch from finance debtors tab', async () => {
    const user = userEvent.setup();
    useDataMock.mockReturnValue({
      stock: [],
      transactions: [],
      debts: [
        {
          id: 'debt-1',
          customerId: 'cust-1',
          originalAmount: 500,
          remainingAmount: 500,
          status: 'Aberta',
          source: 'pdv',
          createdAt: '2026-03-11T09:00:00.000Z',
          updatedAt: '2026-03-11T09:00:00.000Z'
        }
      ],
      debtPayments: [],
      customers: [
        {
          id: 'cust-1',
          name: 'Cliente Devedor',
          cpf: '',
          phone: '',
          email: '',
          birthDate: '',
          purchases: 0,
          totalSpent: 0
        }
      ],
      financialCategories: [],
      payableDebts: [],
      creditors: [],
      sales: [],
      addTransaction: addTransactionMock,
      updateTransaction: updateTransactionMock,
      removeTransaction: removeTransactionMock,
      removeDebt: removeDebtMock
    });

    render(
      <MemoryRouter>
        <Finance />
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: 'Devedores' }));
    await user.click(screen.getByRole('button', { name: /Excluir dívida de Cliente Devedor/i }));

    expect(toastConfirmMock).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Excluir dívida',
      confirmLabel: 'Excluir dívida',
      variant: 'danger'
    }));

    await waitFor(() => expect(removeDebtMock).toHaveBeenCalledWith('debt-1'));
    expect(toastSuccessMock).toHaveBeenCalledWith('Dívida excluída com sucesso.');
  });
});

describe('Finance account integrity guards', () => {
  const buildData = (overrides: Record<string, unknown> = {}) => ({
    stock: [],
    transactions: [],
    debts: [],
    debtPayments: [],
    customers: [],
    financialCategories: [
      { id: 'fcat-in-aporte', name: 'Aporte', type: 'IN', isDefault: true, createdAt: '2026-01-01T00:00:00.000Z' },
      { id: 'fcat-out-servico', name: 'Serviço', type: 'OUT', isDefault: true, createdAt: '2026-01-01T00:00:00.000Z' }
    ],
    payableDebts: [],
    creditors: [],
    sales: [],
    addTransaction: addTransactionMock,
    updateTransaction: updateTransactionMock,
    removeTransaction: removeTransactionMock,
    removeDebt: removeDebtMock,
    transferBetweenAccounts: transferBetweenAccountsMock,
    ...overrides
  });

  const bankIn = (amount: number) => ({
    id: `trx-in-${amount}`,
    type: 'IN',
    category: 'Aporte',
    amount,
    date: '2026-07-01T12:00:00.000Z',
    description: 'Aporte inicial',
    account: 'Conta Bancária'
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockMatchMediaWidth(1280);
    addTransactionMock.mockResolvedValue(undefined);
    transferBetweenAccountsMock.mockResolvedValue(undefined);
    toastConfirmMock.mockResolvedValue(true);
  });

  it('transfers between accounts through the atomic RPC action', async () => {
    const user = userEvent.setup();
    useDataMock.mockReturnValue(buildData({ transactions: [bankIn(1000)] }));

    render(
      <MemoryRouter>
        <Finance />
      </MemoryRouter>
    );

    await user.click(screen.getByTestId('finance-tab-bank'));
    await user.click(screen.getByRole('button', { name: /Transferir/ }));
    await user.type(screen.getByPlaceholderText('R$ 0,00'), '250');
    await user.click(screen.getByRole('button', { name: 'Confirmar Transferência' }));

    await waitFor(() => expect(transferBetweenAccountsMock).toHaveBeenCalledWith('Conta Bancária', 'Cofre', 250));
    expect(addTransactionMock).not.toHaveBeenCalled();
    expect(toastSuccessMock).toHaveBeenCalledWith('Transferencia realizada.');
  });

  it('blocks transfers above the origin account balance', async () => {
    const user = userEvent.setup();
    useDataMock.mockReturnValue(buildData({ transactions: [bankIn(100)] }));

    render(
      <MemoryRouter>
        <Finance />
      </MemoryRouter>
    );

    await user.click(screen.getByTestId('finance-tab-bank'));
    await user.click(screen.getByRole('button', { name: /Transferir/ }));
    await user.type(screen.getByPlaceholderText('R$ 0,00'), '500');
    await user.click(screen.getByRole('button', { name: 'Confirmar Transferência' }));

    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith(expect.stringContaining('Saldo insuficiente em Conta Bancária')));
    expect(transferBetweenAccountsMock).not.toHaveBeenCalled();
  });

  it('asks for confirmation before registering an expense that turns the account negative', async () => {
    const user = userEvent.setup();
    toastConfirmMock.mockResolvedValue(false);
    useDataMock.mockReturnValue(buildData({ transactions: [bankIn(100)] }));

    render(
      <MemoryRouter>
        <Finance />
      </MemoryRouter>
    );

    await user.click(screen.getByTestId('finance-tab-bank'));
    await user.click(screen.getByRole('button', { name: /Pagar/ }));
    await user.type(screen.getByPlaceholderText('0,00'), '500');
    await user.click(screen.getByRole('button', { name: 'Confirmar Pagamento' }));

    await waitFor(() => expect(toastConfirmMock).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Saldo insuficiente',
      variant: 'danger'
    })));
    expect(addTransactionMock).not.toHaveBeenCalled();
  });

  it('does not offer manual entries on the virtual Devedores account', async () => {
    const user = userEvent.setup();
    useDataMock.mockReturnValue(buildData());

    render(
      <MemoryRouter>
        <Finance />
      </MemoryRouter>
    );

    await user.click(screen.getByTestId('finance-tab-bank'));
    expect(screen.getByTestId('finance-action-aporte')).toBeInTheDocument();

    await user.click(screen.getByTestId('finance-tab-debtors'));
    expect(screen.queryByTestId('finance-action-aporte')).toBeNull();
  });
});
