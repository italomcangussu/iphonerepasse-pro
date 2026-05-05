import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { Condition, DeviceType, StockStatus, WarrantyType } from '../types';
import PDVHistory from './PDVHistory';

const useDataMock = vi.fn();
const useAuthMock = vi.fn();
const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();
const removeSaleMock = vi.fn();
const updateSaleMock = vi.fn();
const printMock = vi.fn();

vi.mock('../services/dataContext', () => ({
  useData: () => useDataMock()
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => useAuthMock()
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

const buildSale = ({
  id,
  customerId,
  sellerId,
  paymentType,
  date,
  storeId
}: {
  id: string;
  customerId: string;
  sellerId: string;
  paymentType: 'Pix' | 'Dinheiro' | 'Cartão' | 'Cartão Débito' | 'Devedor';
  date: string;
  storeId?: string;
}) => ({
  id,
  customerId,
  sellerId,
  items: [
    {
      id: `stk-${id}`,
      type: DeviceType.IPHONE,
      model: 'iPhone Test',
      color: 'Preto',
      capacity: '128 GB',
      imei: `imei-${id}`,
      condition: Condition.USED,
      status: StockStatus.SOLD,
      storeId: storeId || (sellerId === 'sel-1' ? 'store-1' : 'store-2'),
      purchasePrice: 1000,
      sellPrice: 2000,
      maxDiscount: 0,
      warrantyType: WarrantyType.STORE,
      costs: [],
      photos: [],
      entryDate: '2026-01-01'
    }
  ],
  tradeInValue: 0,
  tradeIns: [],
  discount: 0,
  total: 2000,
  paymentMethods: [{ type: paymentType, amount: 2000 }],
  date,
  warrantyExpiresAt: null,
  storeId,
  notes: 'Observação teste'
});

const buildDataContext = (sales: ReturnType<typeof buildSale>[]) => ({
  sales,
  stores: [
    { id: 'store-1', name: 'Loja Centro', city: 'Fortaleza' },
    { id: 'store-2', name: 'Loja Aldeota', city: 'Fortaleza' }
  ],
  sellers: [
    { id: 'sel-1', name: 'Vendedor 1', email: '', authUserId: '', storeId: 'store-1', totalSales: 0 },
    { id: 'sel-2', name: 'Vendedor 2', email: '', authUserId: '', storeId: 'store-2', totalSales: 0 }
  ],
  customers: [
    { id: 'cust-1', name: 'Cliente Hoje', cpf: '', phone: '', email: '', birthDate: '', purchases: 0, totalSpent: 0 },
    { id: 'cust-2', name: 'Cliente Antigo', cpf: '', phone: '', email: '', birthDate: '', purchases: 0, totalSpent: 0 }
  ],
  stock: [
    {
      id: 'stk-sale-today',
      type: DeviceType.IPHONE,
      model: 'iPhone Test',
      color: 'Preto',
      capacity: '128 GB',
      imei: 'imei-sale-today',
      condition: Condition.USED,
      status: StockStatus.SOLD,
      storeId: 'store-1',
      purchasePrice: 1000,
      sellPrice: 2000,
      maxDiscount: 0,
      warrantyType: WarrantyType.STORE,
      costs: [],
      photos: [],
      entryDate: '2026-01-01'
    },
    {
      id: 'stk-sale-old',
      type: DeviceType.IPHONE,
      model: 'iPhone Test 2',
      color: 'Azul',
      capacity: '256 GB',
      imei: 'imei-sale-old',
      condition: Condition.USED,
      status: StockStatus.SOLD,
      storeId: 'store-2',
      purchasePrice: 1100,
      sellPrice: 2500,
      maxDiscount: 0,
      warrantyType: WarrantyType.STORE,
      costs: [],
      photos: [],
      entryDate: '2026-01-01'
    },
    {
      id: 'stk-available',
      type: DeviceType.IPHONE,
      model: 'iPhone Disponível',
      color: 'Branco',
      capacity: '128 GB',
      imei: 'imei-available',
      condition: Condition.USED,
      status: StockStatus.AVAILABLE,
      storeId: 'store-1',
      purchasePrice: 900,
      sellPrice: 1800,
      maxDiscount: 0,
      warrantyType: WarrantyType.STORE,
      costs: [],
      photos: [],
      entryDate: '2026-01-01'
    }
  ],
  businessProfile: {
    name: 'iPhoneRepasse',
    cnpj: '',
    phone: '',
    email: '',
    address: '',
    instagram: ''
  },
  removeSale: removeSaleMock,
  updateSale: updateSaleMock
});

describe('PDVHistory', () => {
  const todayDate = new Date();
  const todayIso = new Date(
    todayDate.getFullYear(),
    todayDate.getMonth(),
    todayDate.getDate(),
    10,
    0,
    0
  ).toISOString();
  const oldIso = new Date(
    todayDate.getFullYear(),
    todayDate.getMonth(),
    todayDate.getDate() - 10,
    10,
    0,
    0
  ).toISOString();

  beforeEach(() => {
    vi.clearAllMocks();
    document.body.removeAttribute('data-print-layout');
    document.getElementById('pdv-history-print-page-style')?.remove();
    Object.defineProperty(window, 'print', {
      writable: true,
      value: printMock
    });
    updateSaleMock.mockResolvedValue(undefined);
    removeSaleMock.mockResolvedValue(undefined);

    useAuthMock.mockReturnValue({
      profile: null,
      role: 'seller'
    });

    useDataMock.mockReturnValue(
      buildDataContext([
        buildSale({
          id: 'sale-today',
          customerId: 'cust-1',
          sellerId: 'sel-1',
          paymentType: 'Pix',
          date: todayIso
        }),
        buildSale({
          id: 'sale-old',
          customerId: 'cust-2',
          sellerId: 'sel-2',
          paymentType: 'Devedor',
          date: oldIso
        })
      ])
    );
  });

  it('shows sales history first and keeps new sale button pointing to step flow page', () => {
    render(
      <MemoryRouter>
        <PDVHistory />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: 'Historico de Vendas' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Nova venda' })).toHaveAttribute('href', '/pdv/nova-venda');
    expect(screen.getByText('Cliente Hoje')).toBeInTheDocument();
    expect(screen.queryByText('Cliente Antigo')).not.toBeInTheDocument();
  });

  it('shows history totals including the trade-in acquisition value', () => {
    useDataMock.mockReturnValue(
      buildDataContext([
        {
          ...buildSale({
            id: 'sale-trade-in',
            customerId: 'cust-1',
            sellerId: 'sel-1',
            paymentType: 'Pix',
            date: todayIso
          }),
          tradeInValue: 500,
          tradeIns: [
            {
              id: 'trade-in-1',
              stockItemId: 'trade-stock-1',
              model: 'iPhone Entrada',
              capacity: '64 GB',
              color: 'Branco',
              imei: 'imei-trade-in',
              condition: Condition.USED,
              receivedValue: 500
            }
          ],
          total: 1500,
          paymentMethods: [{ type: 'Pix', amount: 1500 }]
        }
      ])
    );

    render(
      <MemoryRouter>
        <PDVHistory />
      </MemoryRouter>
    );

    expect(screen.getByText('1 venda(s) • R$ 2.000')).toBeInTheDocument();
    expect(screen.getAllByText('R$ 2.000').length).toBeGreaterThan(0);
  });

  it('shows trade-in as a payment in sale details and receipts', async () => {
    const user = userEvent.setup();

    useDataMock.mockReturnValue(
      buildDataContext([
        {
          ...buildSale({
            id: 'sale-trade-in',
            customerId: 'cust-1',
            sellerId: 'sel-1',
            paymentType: 'Pix',
            date: todayIso
          }),
          tradeInValue: 500,
          tradeIns: [
            {
              id: 'trade-in-1',
              stockItemId: 'trade-stock-1',
              model: 'iPhone Entrada',
              capacity: '64 GB',
              color: 'Branco',
              imei: 'imei-trade-in',
              condition: Condition.USED,
              receivedValue: 500
            }
          ],
          total: 1500,
          paymentMethods: [{ type: 'Pix', amount: 1500 }]
        }
      ])
    );

    render(
      <MemoryRouter>
        <PDVHistory />
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: 'Detalhes' }));

    expect(screen.getByText('Trade-in (1 aparelho)')).toBeInTheDocument();
    expect(screen.getByText('Entrada usada como forma de pagamento')).toBeInTheDocument();
    expect(screen.getByText('Usado no pagamento: R$ 500,00')).toBeInTheDocument();
    expect(screen.getAllByText('Total da venda').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Total pago').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: 'Comprovantes imprimíveis' }));

    const receipt80mm = document.getElementById('receipt-content-80mm');
    expect(receipt80mm).toHaveTextContent('Troca (1 aparelho)');
    expect(receipt80mm).toHaveTextContent('Total pago');
    expect(receipt80mm).toHaveTextContent('R$ 2.000,00');
  });

  it('filters by payment method', async () => {
    const user = userEvent.setup();

    useDataMock.mockReturnValue(
      buildDataContext([
        buildSale({
          id: 'sale-pix',
          customerId: 'cust-1',
          sellerId: 'sel-1',
          paymentType: 'Pix',
          date: todayIso
        }),
        buildSale({
          id: 'sale-debt',
          customerId: 'cust-2',
          sellerId: 'sel-2',
          paymentType: 'Devedor',
          date: todayIso
        })
      ])
    );

    render(
      <MemoryRouter>
        <PDVHistory />
      </MemoryRouter>
    );

    expect(screen.getByText('Cliente Hoje')).toBeInTheDocument();
    expect(screen.getByText('Cliente Antigo')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Metodo de pagamento'), 'Devedor');

    expect(screen.queryByText('Cliente Hoje')).not.toBeInTheDocument();
    expect(screen.getByText('Cliente Antigo')).toBeInTheDocument();
  });

  it('defaults store filter to logged seller store', async () => {
    useAuthMock.mockReturnValue({
      profile: {
        id: 'user-1',
        role: 'seller',
        sellerId: 'sel-2'
      },
      role: 'seller'
    });

    useDataMock.mockReturnValue(
      buildDataContext([
        buildSale({
          id: 'sale-store-1',
          customerId: 'cust-1',
          sellerId: 'sel-1',
          paymentType: 'Pix',
          date: todayIso
        }),
        buildSale({
          id: 'sale-store-2',
          customerId: 'cust-2',
          sellerId: 'sel-2',
          paymentType: 'Devedor',
          date: todayIso
        })
      ])
    );

    render(
      <MemoryRouter>
        <PDVHistory />
      </MemoryRouter>
    );

    const storeFilter = screen.getByLabelText('Loja');
    await waitFor(() => {
      expect(storeFilter).toHaveValue('store-2');
    });

    expect(screen.getByText('Cliente Antigo')).toBeInTheDocument();
    expect(screen.queryByText('Cliente Hoje')).not.toBeInTheDocument();
  });

  it('uses the sale store snapshot for the store filter even when the seller moved stores', async () => {
    const user = userEvent.setup();

    useDataMock.mockReturnValue(
      buildDataContext([
        {
          ...buildSale({
            id: 'sale-raissa',
            customerId: 'cust-1',
            sellerId: 'sel-2',
            paymentType: 'Pix',
            date: todayIso,
            storeId: 'store-1'
          }),
          total: 6000,
          paymentMethods: [{ type: 'Pix', amount: 6000 }]
        }
      ])
    );

    render(
      <MemoryRouter>
        <PDVHistory />
      </MemoryRouter>
    );

    await user.selectOptions(screen.getByLabelText('Loja'), 'store-1');

    expect(screen.getByText('Cliente Hoje')).toBeInTheDocument();
    expect(screen.getAllByText('Loja Centro').length).toBeGreaterThan(1);
  });

  it('opens sale details and shows access to printable receipts', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <PDVHistory />
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: 'Detalhes' }));

    expect(screen.getByRole('heading', { name: 'Detalhes da Venda' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Comprovantes imprimíveis' })).toBeInTheDocument();
  });

  it('prints selected A4 layout from history and includes sold device color in 80mm receipt', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <PDVHistory />
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: 'Detalhes' }));
    await user.click(screen.getByRole('button', { name: 'Comprovantes imprimíveis' }));

    expect(document.getElementById('receipt-content-80mm')).toHaveTextContent('Cor: Preto');

    await user.click(screen.getByRole('button', { name: /A4 \(arquivo\/entrega formal\)/i }));
    await user.click(screen.getByRole('button', { name: 'Imprimir agora' }));

    await waitFor(() => {
      expect(printMock).toHaveBeenCalledTimes(1);
    });
    expect(document.body).toHaveAttribute('data-print-layout', 'a4');
    expect(document.getElementById('pdv-history-print-page-style')).toHaveTextContent(
      '@page { size: A4 portrait; margin: 10mm; }'
    );
  });

  it('allows admin to save full sale edit payload', async () => {
    const user = userEvent.setup();

    useAuthMock.mockReturnValue({
      profile: {
        id: 'admin-1',
        role: 'admin'
      },
      role: 'admin'
    });

    render(
      <MemoryRouter>
        <PDVHistory />
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: 'Editar' }));
    expect(screen.getByRole('heading', { name: 'Editar Venda Concluida' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Salvar Alterações' }));

    await waitFor(() => {
      expect(updateSaleMock).toHaveBeenCalledTimes(1);
    });

    const [saleId, payload] = updateSaleMock.mock.calls[0];
    expect(saleId).toBe('sale-today');
    expect(payload).toMatchObject({
      customerId: 'cust-1',
      sellerId: 'sel-1',
      total: 2000,
      paymentMethods: [{ type: 'Pix', amount: 2000 }]
    });
    expect(Array.isArray(payload.items)).toBe(true);
    expect(toastSuccessMock).toHaveBeenCalledWith('Venda atualizada com sucesso.');
  });

  it('cancels a sale with multiple trade-ins through the reversal flow', async () => {
    const user = userEvent.setup();
    useAuthMock.mockReturnValue({ profile: { id: 'admin-1', role: 'admin' }, role: 'admin' });
    useDataMock.mockReturnValue(
      buildDataContext([
        {
          ...buildSale({
            id: 'sale-multi-trade',
            customerId: 'cust-1',
            sellerId: 'sel-1',
            paymentType: 'Pix',
            date: todayIso
          }),
          tradeInValue: 900,
          tradeIns: [
            { id: 'ti-1', stockItemId: 'trade-stock-1', model: 'iPhone 11', imei: 'imei-ti-1', condition: Condition.USED, receivedValue: 400 },
            { id: 'ti-2', stockItemId: 'trade-stock-2', model: 'iPhone 12', imei: 'imei-ti-2', condition: Condition.USED, receivedValue: 500 }
          ]
        }
      ])
    );

    render(
      <MemoryRouter>
        <PDVHistory />
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    await user.click(screen.getByRole('button', { name: 'Cancelar venda' }));

    await waitFor(() => expect(removeSaleMock).toHaveBeenCalledWith('sale-multi-trade'));
    expect(toastSuccessMock).toHaveBeenCalledWith('Venda cancelada e transações revertidas.');
  });

  it('shows a blocking message when a trade-in was already resold', async () => {
    const user = userEvent.setup();
    useAuthMock.mockReturnValue({ profile: { id: 'admin-1', role: 'admin' }, role: 'admin' });
    removeSaleMock.mockRejectedValueOnce(new Error('Não é possível cancelar a venda: trade-in já revendido (imei-ti-1).'));

    render(
      <MemoryRouter>
        <PDVHistory />
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    await user.click(screen.getByRole('button', { name: 'Cancelar venda' }));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith('Não é possível cancelar a venda: trade-in já revendido (imei-ti-1).');
    });
  });
});
