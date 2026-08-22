import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
const { sendReceiptWhatsAppMock } = vi.hoisted(() => ({
  sendReceiptWhatsAppMock: vi.fn()
}));
const { deliverReceiptPdfMock } = vi.hoisted(() => ({
  deliverReceiptPdfMock: vi.fn(async (_pdf: unknown, _options: { fileName: string; title?: string }) => 'print' as const)
}));

vi.mock('../utils/deliverReceiptPdf', () => ({
  deliverReceiptPdf: deliverReceiptPdfMock
}));

const mockDesktopMatchMedia = () => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: query.includes('hover: hover') || query.includes('pointer: fine')
        ? true
        : /max-width:\s*(\d+)px/.test(query)
          ? 1280 <= Number(query.match(/max-width:\s*(\d+)px/)?.[1])
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

vi.mock('../utils/sendReceiptWhatsApp', () => ({
  sendReceiptWhatsApp: sendReceiptWhatsAppMock
}));

const buildSale = ({
  id,
  customerId,
  sellerId,
  paymentType,
  date,
  storeId,
  commission = 50
}: {
  id: string;
  customerId: string;
  sellerId: string;
  paymentType: 'Pix' | 'Dinheiro' | 'Cartão' | 'Cartão Débito' | 'Devedor';
  date: string;
  storeId?: string;
  commission?: number;
}) => ({
  id,
  customerId,
  sellerId,
  commission,
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
      batteryHealth: 86,
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
    { id: 'cust-1', name: 'Cliente Hoje', cpf: '', phone: '(85) 99999-0000', email: '', birthDate: '', purchases: 0, totalSpent: 0 },
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
    mockDesktopMatchMedia();
    document.body.removeAttribute('data-print-layout');
    document.getElementById('pdv-history-print-page-style')?.remove();
    Object.defineProperty(window, 'print', {
      writable: true,
      value: printMock
    });
    updateSaleMock.mockResolvedValue(undefined);
    removeSaleMock.mockResolvedValue(undefined);
    sendReceiptWhatsAppMock.mockResolvedValue(undefined);

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

  it('shows trade-in observations resolved from the stock item it created', async () => {
    // Regressão a7a7366: o bloco lia (tradeIn as any).observations, campo que
    // SaleTradeInItem não tem e o mapper do banco nunca preenche — UI morta.
    // A fonte real é o item de estoque criado a partir da entrada (stockItemId).
    const user = userEvent.setup();
    const base = buildDataContext([
      {
        ...buildSale({
          id: 'sale-trade-in-obs',
          customerId: 'cust-1',
          sellerId: 'sel-1',
          paymentType: 'Pix',
          date: todayIso
        }),
        tradeInValue: 500,
        tradeIns: [
          {
            id: 'trade-in-obs-1',
            stockItemId: 'trade-stock-obs',
            model: 'iPhone Entrada',
            imei: 'imei-trade-obs',
            condition: Condition.USED,
            receivedValue: 500
          }
        ],
        total: 1500,
        paymentMethods: [{ type: 'Pix', amount: 1500 }]
      }
    ]);

    useDataMock.mockReturnValue({
      ...base,
      stock: [
        ...base.stock,
        {
          id: 'trade-stock-obs',
          type: DeviceType.IPHONE,
          model: 'iPhone Entrada',
          color: 'Branco',
          capacity: '64 GB',
          imei: 'imei-trade-obs',
          condition: Condition.USED,
          status: StockStatus.AVAILABLE,
          storeId: 'store-1',
          purchasePrice: 500,
          sellPrice: 900,
          maxDiscount: 0,
          warrantyType: WarrantyType.STORE,
          costs: [],
          photos: [],
          entryDate: '2026-01-01',
          observations: 'Trocar tela\nFace ID inativo'
        }
      ]
    });

    render(
      <MemoryRouter>
        <PDVHistory />
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: 'Detalhes' }));

    expect(screen.getByText(/Trocar tela/)).toBeInTheDocument();
    expect(screen.getByText(/Face ID inativo/)).toBeInTheDocument();
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

    await user.click(screen.getByRole('button', { name: 'Mostrar Filtros' }));
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

    await userEvent.click(screen.getByRole('button', { name: 'Mostrar Filtros' }));
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

    await user.click(screen.getByRole('button', { name: 'Mostrar Filtros' }));
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

  it('resends receipt from sale details through WhatsApp', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <PDVHistory />
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: 'Detalhes' }));
    await user.click(screen.getByRole('button', { name: 'Reenviar comprovante via WhatsApp' }));

    await waitFor(() => {
      expect(sendReceiptWhatsAppMock).toHaveBeenCalledWith({
        phone: '(85) 99999-0000',
        storeId: 'store-1',
        saleId: 'sale-today',
        customerName: 'Cliente Hoje',
        // a7a7366 passou a enviar vendedor e número da venda; a fixture
        // `sale-today` não tem saleNumber, então a chave vai como undefined.
        sellerName: 'Vendedor 1',
        saleNumber: undefined
      });
    });
    expect(toastSuccessMock).toHaveBeenCalledWith('Comprovante reenviado via WhatsApp.');
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
    expect(document.getElementById('receipt-content-80mm')).toHaveTextContent('Saúde da bateria: 86%');
    expect(document.getElementById('receipt-content-80mm')).not.toHaveTextContent('Subtotal negociado');
    expect(document.getElementById('receipt-content-80mm')).not.toHaveTextContent('Subtotal original');

    await user.click(screen.getByRole('button', { name: /A4 \(arquivo\/entrega formal\)/i }));
    await user.click(screen.getByRole('button', { name: 'Imprimir agora' }));

    await waitFor(() => {
      expect(deliverReceiptPdfMock).toHaveBeenCalledTimes(1);
    });

    // Motor de PDF: nada de imprimir o documento do app.
    expect(printMock).not.toHaveBeenCalled();
    const [pdf, options] = deliverReceiptPdfMock.mock.calls[0];
    const pageWidth = (pdf as { internal: { pageSize: { getWidth: () => number } } }).internal.pageSize.getWidth();
    expect(Math.round(pageWidth)).toBe(210);
    expect(options.fileName).toMatch(/^comprovante-.+\.pdf$/);
  });

  it('renders receipt templates outside the app root before printing', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <PDVHistory />
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: 'Detalhes' }));
    await user.click(screen.getByRole('button', { name: 'Comprovantes imprimíveis' }));

    expect(document.getElementById('receipt-content-80mm')?.parentElement).toBe(document.body);
    expect(document.getElementById('receipt-content-a4')?.parentElement).toBe(document.body);
  });

  it('opens complete edit modal without canceling or redirecting the sale', async () => {
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

    await user.click(screen.getByRole('button', { name: 'Edição Completa' }));
    expect(screen.getByRole('heading', { name: 'Editar Venda Concluída' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resumo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Itens vendidos' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Trade-in' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pagamentos' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Totais' })).toBeInTheDocument();
    expect(removeSaleMock).not.toHaveBeenCalled();
    expect(window.localStorage.getItem('pdv:draft:v1')).toBeNull();

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
    expect(removeSaleMock).not.toHaveBeenCalled();
  });

  it('edits the seller commission from the sale edit modal', async () => {
    const user = userEvent.setup();

    useAuthMock.mockReturnValue({
      profile: { id: 'admin-1', role: 'admin' },
      role: 'admin'
    });

    render(
      <MemoryRouter>
        <PDVHistory />
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: 'Editar' }));

    // Vem preenchida com a comissão gravada na venda, não zerada.
    const commissionInput = screen.getByLabelText('Comissão do vendedor');
    expect(commissionInput).toHaveValue(50);

    await user.clear(commissionInput);
    await user.type(commissionInput, '80');
    await user.click(screen.getByRole('button', { name: 'Salvar Alterações' }));

    await waitFor(() => expect(updateSaleMock).toHaveBeenCalledTimes(1));
    const [saleId, payload] = updateSaleMock.mock.calls[0];
    expect(saleId).toBe('sale-today');
    expect(payload).toMatchObject({ commission: 80 });
  });

  it('opens desktop context actions for an admin sale row', () => {
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

    const row = screen.getByText('Cliente Hoje').closest('tr');
    expect(row).not.toBeNull();
    fireEvent.contextMenu(row!, { clientX: 220, clientY: 260 });

    expect(screen.getByRole('menu', { name: /Ações da venda/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Ver detalhes' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Editar' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Edição completa' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Cancelar venda' })).toBeInTheDocument();
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

  it('filters sales by seller and shows employee total sales and commissions at bottom of page', async () => {
    const user = userEvent.setup();
    useAuthMock.mockReturnValue({ profile: { id: 'admin-1', role: 'admin' }, role: 'admin' });
    useDataMock.mockReturnValue(
      buildDataContext([
        buildSale({ id: 'sale-1', customerId: 'cust-1', sellerId: 'sel-1', paymentType: 'Pix', date: todayIso, commission: 75 }),
        buildSale({ id: 'sale-2', customerId: 'cust-2', sellerId: 'sel-2', paymentType: 'Dinheiro', date: todayIso, commission: 50 })
      ])
    );

    render(
      <MemoryRouter>
        <PDVHistory />
      </MemoryRouter>
    );

    // Open filters
    await user.click(screen.getByRole('button', { name: 'Mostrar Filtros' }));

    // Verify seller summary is not visible when filter is 'all'
    expect(screen.queryByTestId('pdv-history-seller-summary')).not.toBeInTheDocument();

    // Select seller 1
    const sellerSelect = screen.getByLabelText('Vendedor');
    fireEvent.change(sellerSelect, { target: { value: 'sel-1' } });

    // Verify summary card appears with seller total and total commission
    const summaryCard = screen.getByTestId('pdv-history-seller-summary');
    expect(summaryCard).toBeInTheDocument();
    expect(summaryCard).toHaveTextContent('Total vendido pelo funcionário');
    expect(summaryCard).toHaveTextContent('Vendedor 1');
    expect(summaryCard).toHaveTextContent('R$ 2.000,00');
    expect(summaryCard).toHaveTextContent('Comissões recebidas');
    expect(summaryCard).toHaveTextContent('R$ 75,00');

    // Clear filters and verify summary card disappears
    await user.click(screen.getByRole('button', { name: 'Limpar filtros' }));
    expect(screen.queryByTestId('pdv-history-seller-summary')).not.toBeInTheDocument();
  });
});
