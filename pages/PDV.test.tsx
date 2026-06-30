import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Condition, DeviceType, StockStatus, WarrantyType } from '../types';
import type { PaymentMethod } from '../types';
import PDV from './PDV';

const LEGACY_PDV_FLOW_TIMEOUT_MS = 60_000;

vi.setConfig({ testTimeout: LEGACY_PDV_FLOW_TIMEOUT_MS });

const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();
const useDataMock = vi.fn();
const useAuthMock = vi.fn();
const addSaleMock = vi.fn();
const removeStockItemMock = vi.fn();
const printMock = vi.fn();
const toastConfirmMock = vi.fn(async () => true);

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
    confirm: toastConfirmMock,
    dismiss: vi.fn(),
    clear: vi.fn()
  })
}));

vi.mock('../components/AddCustomerModal', () => ({
  AddCustomerModal: ({ open }: { open: boolean }) => (open ? <div role="dialog" aria-label="Novo Cliente">Novo Cliente</div> : null)
}));

vi.mock('../components/AddSellerModal', () => ({
  AddSellerModal: () => null
}));

vi.mock('../components/StockFormModal', () => ({
  StockFormModal: ({ open, onSave }: { open: boolean; onSave?: (item: any) => void }) => (
    open ? (
      <button
        type="button"
        onClick={() => onSave?.({
          id: `trade-${Math.random()}`,
          type: DeviceType.IPHONE,
          model: 'iPhone Trade',
          color: 'Azul',
          capacity: '128 GB',
          imei: `trade-imei-${Math.random()}`,
          condition: Condition.USED,
          status: StockStatus.PREPARATION,
          storeId: 'store-1',
          purchasePrice: 1000,
          sellPrice: 0,
          maxDiscount: 0,
          warrantyType: WarrantyType.STORE,
          costs: [],
          photos: [],
          entryDate: '2026-02-20'
        })}
      >
        Salvar trade-in mock
      </button>
    ) : null
  )
}));

describe('PDV page integration', () => {
  const selectSeller = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole('combobox', { name: 'Vendedor' }));
    await user.click(await screen.findByText('Vendedor Teste'));
  };

  const selectStore = async (user: ReturnType<typeof userEvent.setup>, storeName = 'Loja Centro') => {
    await user.click(screen.getByRole('combobox', { name: 'Loja' }));
    await user.click(await screen.findByText(storeName));
  };

  const selectClient = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole('combobox', { name: 'Cliente' }));
    await user.click(await screen.findByText('Cliente Teste'));
  };

  const selectProduct = async (user: ReturnType<typeof userEvent.setup>) => {
    if (!screen.queryByRole('combobox', { name: 'Produto' })) {
      await user.click(screen.getByRole('button', { name: /2. Produtos/i }));
    }
    await user.click(screen.getByRole('combobox', { name: 'Produto' }));
    await user.type(screen.getByPlaceholderText('Digite modelo, IMEI/Serial ou cor...'), 'iPhone');
    await user.click(screen.getByText(/iPhone 14 Test/));
    await user.click(screen.getByRole('button', { name: 'Adicionar ao carrinho' }));
  };

  const addProductToCart = async (user: ReturnType<typeof userEvent.setup>, query: string, optionText: RegExp) => {
    await user.click(screen.getByRole('combobox', { name: 'Produto' }));
    await user.clear(screen.getByPlaceholderText('Digite modelo, IMEI/Serial ou cor...'));
    await user.type(screen.getByPlaceholderText('Digite modelo, IMEI/Serial ou cor...'), query);
    await user.click(screen.getByText(optionText));
    await user.click(screen.getByRole('button', { name: 'Adicionar ao carrinho' }));
  };

  const addTradeIn = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole('button', { name: '+ Adicionar' }));
    await user.click(screen.getByRole('button', { name: 'Salvar trade-in mock' }));
  };

  const makeDraftTradeIn = (id: string) => ({
    id,
    type: DeviceType.IPHONE,
    model: 'iPhone Trade',
    color: 'Azul',
    capacity: '128 GB',
    imei: `${id}-imei`,
    condition: Condition.USED,
    status: StockStatus.PREPARATION,
    storeId: 'store-1',
    purchasePrice: 1000,
    sellPrice: 0,
    maxDiscount: 0,
    warrantyType: WarrantyType.STORE,
    costs: [],
    photos: [],
    entryDate: '2026-02-20'
  });

  const addPayment = async (user: ReturnType<typeof userEvent.setup>, type: PaymentMethod['type']) => {
    const buttonLabel = type === 'Cartão' ? 'Cartão Crédito' : type;
    await user.click(screen.getByRole('button', { name: buttonLabel }));

    const dialog = screen.getByRole('dialog');

    if (type === 'Cartão') {
      await user.click(within(dialog).getByRole('button', { name: 'Adicionar Cartão' }));
      return;
    }

    if (type === 'Cartão Débito') {
      await user.click(within(dialog).getByRole('button', { name: 'Adicionar Débito' }));
      return;
    }

    if (type === 'Devedor') {
      await user.click(within(dialog).getByRole('button', { name: 'Confirmar' }));
      return;
    }

    await user.click(within(dialog).getByRole('button', { name: 'Adicionar' }));
  };

  const prepareSalePaymentStep = async (user: ReturnType<typeof userEvent.setup>, withTradeIn: boolean) => {
    render(<PDV />);
    await selectSeller(user);
    await selectStore(user);
    await selectClient(user);
    await selectProduct(user);
    if (withTradeIn) {
      await addTradeIn(user);
    }
    await user.click(screen.getByRole('button', { name: /Continuar|Avançar para pagamento/i }));
  };

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    document.body.removeAttribute('data-print-layout');
    document.getElementById('pdv-print-page-style')?.remove();
    addSaleMock.mockResolvedValue(undefined);
    removeStockItemMock.mockResolvedValue(undefined);
    toastConfirmMock.mockResolvedValue(true);
    Object.defineProperty(window, 'print', {
      writable: true,
      value: printMock
    });
    useAuthMock.mockReturnValue({ role: 'admin' });
    useDataMock.mockReturnValue({
      stock: [
        {
          id: 'stk-1',
          type: DeviceType.IPHONE,
          model: 'iPhone 14 Test',
          color: 'Preto',
          capacity: '256 GB',
          imei: '123456789012345',
          condition: Condition.USED,
          status: StockStatus.AVAILABLE,
          storeId: 'store-1',
          purchasePrice: 2500,
          sellPrice: 3000,
          maxDiscount: 0,
          warrantyType: WarrantyType.STORE,
          costs: [],
          photos: [],
          entryDate: '2026-02-15'
        },
        {
          id: 'stk-2',
          type: DeviceType.IPHONE,
          model: 'iPhone 13 Test',
          color: 'Branco',
          capacity: '128 GB',
          imei: '987654321098765',
          condition: Condition.USED,
          status: StockStatus.AVAILABLE,
          storeId: 'store-1',
          purchasePrice: 2000,
          sellPrice: 2500,
          maxDiscount: 0,
          warrantyType: WarrantyType.STORE,
          costs: [],
          photos: [],
          entryDate: '2026-02-15'
        }
      ],
      customers: [
        {
          id: 'cust-1',
          name: 'Cliente Teste',
          cpf: '',
          phone: '',
          email: '',
          birthDate: '',
          purchases: 0,
          totalSpent: 0
        }
      ],
      sellers: [
        {
          id: 'sel-1',
          name: 'Vendedor Teste',
          email: '',
          authUserId: '',
          storeId: '',
          totalSales: 0
        }
      ],
      stores: [
        { id: 'store-1', name: 'Loja Centro', city: 'Fortaleza' },
        { id: 'store-2', name: 'Loja Sobral', city: 'Sobral' }
      ],
      addSale: addSaleMock,
      removeStockItem: removeStockItemMock,
      businessProfile: { name: 'Loja Teste' },
      cardFeeSettings: {
        visaMasterRates: [2.99, 4.09, 4.78, 5.47, 6.14, 6.81, 7.67, 8.33, 8.98, 9.63, 10.26, 10.9, 12.32, 12.94, 13.56, 14.17, 14.77, 15.37],
        otherRates: [3.99, 5.3, 5.99, 6.68, 7.35, 8.02, 9.47, 10.13, 10.78, 11.43, 12.06, 12.7, 13.32, 13.94, 14.56, 15.17, 15.77, 16.37],
        debitRate: 1.87
      }
    });
  });

  it('shows a visible customer registration button beside the customer search', async () => {
    const user = userEvent.setup();

    render(<PDV />);

    const customerButton = screen.getByRole('button', { name: 'Cadastrar Cliente' });

    expect(customerButton).toBeVisible();

    await user.click(customerButton);

    expect(screen.getByRole('dialog', { name: 'Novo Cliente' })).toBeInTheDocument();
  });

  it('renders updated payment methods in PDV', async () => {
    const user = userEvent.setup();
    render(<PDV />);

    await selectSeller(user);
    await selectStore(user);
    await selectClient(user);
    await selectProduct(user);
    await user.click(screen.getByRole('button', { name: /Continuar|Avançar para pagamento/i }));

    expect(screen.getByRole('button', { name: 'Pix' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dinheiro' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cartão Crédito' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cartão Débito' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Devedor' })).toBeInTheDocument();
  }, LEGACY_PDV_FLOW_TIMEOUT_MS);

  it('shows a restored reservation deposit as already paid and locked', async () => {
    const user = userEvent.setup();
    window.localStorage.setItem('pdv:draft:v1', JSON.stringify({
      version: 1,
      draft: {
        selectedStore: 'store-1',
        selectedSeller: 'sel-1',
        selectedClient: 'cust-1',
        cartItemIds: ['stk-1'],
        productConditionFilter: Condition.USED,
        negotiatedPriceInput: '3000.00',
        payments: [{
          type: 'Pix',
          amount: 250,
          account: 'Conta Bancária',
          source: 'reservation_deposit',
          reservationId: 'res-1',
          reservationDepositTransactionId: 'trx-res-1'
        }]
      }
    }));

    render(<PDV />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Continuar/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: /Continuar/i }));
    await user.click(screen.getByRole('button', { name: /Avançar para pagamento/i }));

    expect(screen.getByText('Sinal já pago')).toBeInTheDocument();
    expect(screen.getByText(/Pix registrado anteriormente/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remover pagamento' })).not.toBeInTheDocument();
  }, LEGACY_PDV_FLOW_TIMEOUT_MS);

  it('keeps product search and add button stacked at every viewport width', async () => {
    const user = userEvent.setup();
    render(<PDV />);

    await selectSeller(user);
    await selectStore(user);
    await selectClient(user);
    await user.click(screen.getByRole('button', { name: /2. Produtos/i }));

    const addToCartButton = screen.getByRole('button', { name: 'Adicionar ao carrinho' });
    const productPickerRow = addToCartButton.parentElement;

    expect(productPickerRow).toHaveClass('space-y-2');
    expect(productPickerRow?.className).not.toContain('grid-cols-1');
    expect(productPickerRow?.className).not.toContain('sm:grid-cols-[1fr_auto]');
    expect(productPickerRow?.className).not.toContain('xl:grid-cols-[minmax(0,1fr)_auto]');
    expect(addToCartButton).toHaveClass('w-full');
    expect(addToCartButton.className).not.toContain('xl:w-auto');
  });

  it('asks toast confirmation before deleting a duplicate stock record', async () => {
    const user = userEvent.setup();
    useDataMock.mockReturnValue({
      ...useDataMock(),
      stock: [
        {
          id: 'dup-1',
          type: DeviceType.IPHONE,
          model: 'iPhone 14 Test',
          color: 'Preto',
          capacity: '256 GB',
          imei: '123456789012345',
          condition: Condition.USED,
          status: StockStatus.AVAILABLE,
          storeId: 'store-1',
          purchasePrice: 2500,
          sellPrice: 3000,
          maxDiscount: 0,
          warrantyType: WarrantyType.STORE,
          costs: [],
          photos: [],
          entryDate: '2026-02-15'
        },
        {
          id: 'dup-2',
          type: DeviceType.IPHONE,
          model: 'iPhone 14 Duplicado',
          color: 'Azul',
          capacity: '256 GB',
          imei: '123456789012345',
          condition: Condition.USED,
          status: StockStatus.AVAILABLE,
          storeId: 'store-1',
          purchasePrice: 2400,
          sellPrice: 2950,
          maxDiscount: 0,
          warrantyType: WarrantyType.STORE,
          costs: [],
          photos: [],
          entryDate: '2026-02-16'
        }
      ]
    });

    render(<PDV />);

    await selectSeller(user);
    await selectStore(user);
    await selectClient(user);
    await user.click(screen.getByRole('button', { name: '2. Produtos' }));
    await user.click(screen.getByRole('combobox', { name: 'Produto' }));
    await user.type(screen.getByPlaceholderText('Digite modelo, IMEI/Serial ou cor...'), 'iPhone');
    await user.click(screen.getByText(/iPhone 14 Test/));
    await user.click(screen.getByRole('button', { name: 'Adicionar ao carrinho' }));

    const duplicateDialog = await screen.findByRole('dialog', { name: /imei\/serial duplicado detectado/i });
    await user.click(within(duplicateDialog).getAllByRole('button', { name: /excluir este/i })[0]);

    await waitFor(() => {
      expect(toastConfirmMock).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: 'danger',
          confirmLabel: expect.stringMatching(/excluir/i),
        })
      );
      expect(removeStockItemMock).toHaveBeenCalled();
    });
  });

  it('prioritizes exact iPhone generation matches before variants in product search', async () => {
    const user = userEvent.setup();
    useDataMock.mockReturnValue({
      ...useDataMock(),
      stock: [
        {
          id: 'stk-14-imei-match',
          type: DeviceType.IPHONE,
          model: 'iPhone 14 Test',
          color: 'Preto',
          capacity: '128 GB',
          imei: '001300000000000',
          condition: Condition.USED,
          status: StockStatus.AVAILABLE,
          storeId: 'store-1',
          purchasePrice: 2500,
          sellPrice: 3000,
          maxDiscount: 0,
          warrantyType: WarrantyType.STORE,
          costs: [],
          photos: [],
          entryDate: '2026-02-15'
        },
        {
          id: 'stk-13-pro-max',
          type: DeviceType.IPHONE,
          model: 'iPhone 13 Pro Max',
          color: 'Azul',
          capacity: '256 GB',
          imei: '130000000000003',
          condition: Condition.USED,
          status: StockStatus.AVAILABLE,
          storeId: 'store-1',
          purchasePrice: 2500,
          sellPrice: 4300,
          maxDiscount: 0,
          warrantyType: WarrantyType.STORE,
          costs: [],
          photos: [],
          entryDate: '2026-02-15'
        },
        {
          id: 'stk-13-pro',
          type: DeviceType.IPHONE,
          model: 'iPhone 13 Pro',
          color: 'Grafite',
          capacity: '128 GB',
          imei: '130000000000002',
          condition: Condition.USED,
          status: StockStatus.AVAILABLE,
          storeId: 'store-1',
          purchasePrice: 2400,
          sellPrice: 3900,
          maxDiscount: 0,
          warrantyType: WarrantyType.STORE,
          costs: [],
          photos: [],
          entryDate: '2026-02-15'
        },
        {
          id: 'stk-13',
          type: DeviceType.IPHONE,
          model: 'iPhone 13',
          color: 'Branco',
          capacity: '128 GB',
          imei: '130000000000001',
          condition: Condition.USED,
          status: StockStatus.AVAILABLE,
          storeId: 'store-1',
          purchasePrice: 2200,
          sellPrice: 3400,
          maxDiscount: 0,
          warrantyType: WarrantyType.STORE,
          costs: [],
          photos: [],
          entryDate: '2026-02-15'
        }
      ]
    });
    render(<PDV />);

    await selectSeller(user);
    await selectStore(user);
    await selectClient(user);
    await user.click(screen.getByRole('button', { name: /2. Produtos/i }));
    await user.click(screen.getByRole('combobox', { name: 'Produto' }));
    await user.type(screen.getByPlaceholderText('Digite modelo, IMEI/Serial ou cor...'), '13');

    const optionLabels = screen.getAllByRole('option').map((option) => option.textContent || '');

    expect(optionLabels).toHaveLength(3);
    expect(optionLabels[0]).toContain('iPhone 13');
    expect(optionLabels[0]).not.toContain('Pro');
    expect(optionLabels[1]).toContain('iPhone 13 Pro');
    expect(optionLabels[1]).not.toContain('Max');
    expect(optionLabels[2]).toContain('iPhone 13 Pro Max');
    expect(optionLabels.join(' ')).not.toContain('iPhone 14 Test');
  });

  it.each([
    { type: 'Pix' as const, withTradeIn: false, expectedTotal: 3000, expectedTradeInValue: 0 },
    { type: 'Pix' as const, withTradeIn: true, expectedTotal: 2000, expectedTradeInValue: 1000 },
    { type: 'Dinheiro' as const, withTradeIn: false, expectedTotal: 3000, expectedTradeInValue: 0 },
    { type: 'Dinheiro' as const, withTradeIn: true, expectedTotal: 2000, expectedTradeInValue: 1000 },
    { type: 'Cartão' as const, withTradeIn: false, expectedTotal: 3000, expectedTradeInValue: 0 },
    { type: 'Cartão' as const, withTradeIn: true, expectedTotal: 2000, expectedTradeInValue: 1000 },
    { type: 'Cartão Débito' as const, withTradeIn: false, expectedTotal: 3000, expectedTradeInValue: 0 },
    { type: 'Cartão Débito' as const, withTradeIn: true, expectedTotal: 2000, expectedTradeInValue: 1000 },
    { type: 'Devedor' as const, withTradeIn: false, expectedTotal: 3000, expectedTradeInValue: 0 },
    { type: 'Devedor' as const, withTradeIn: true, expectedTotal: 2000, expectedTradeInValue: 1000 }
  ])(
    'finalizes sale with $type payment and trade-in=$withTradeIn',
    async ({ type, withTradeIn, expectedTotal, expectedTradeInValue }) => {
      const user = userEvent.setup();
      await prepareSalePaymentStep(user, withTradeIn);

      await addPayment(user, type);
      await user.click(await screen.findByRole('button', { name: 'Finalizar Venda' }));

      expect(addSaleMock).toHaveBeenCalledTimes(1);
      const payload = addSaleMock.mock.calls[0][0];
      const payment = payload.paymentMethods[0];

      expect(payload.total).toBe(expectedTotal);
      expect(payload.tradeInValue).toBe(expectedTradeInValue);
      expect(payload.tradeIn).toBeUndefined();
      expect(payload.tradeIns).toHaveLength(withTradeIn ? 1 : 0);
      expect(payload.paymentMethods).toHaveLength(1);
      expect(payment.type).toBe(type);
      expect(payment.amount).toBe(expectedTotal);

      if (type === 'Cartão') {
        expect(payment).toMatchObject({
          account: 'Conta Bancária',
          installments: 1,
          cardBrand: 'visa_master',
          feeRate: 2.99
        });
        expect(payment.customerAmount).toBeGreaterThan(expectedTotal);
        expect(payment.feeAmount).toBeCloseTo(payment.customerAmount - expectedTotal, 2);
      } else if (type === 'Cartão Débito') {
        expect(payment).toMatchObject({
          account: 'Conta Bancária',
          feeRate: 1.87
        });
        expect(payment.customerAmount).toBeGreaterThan(expectedTotal);
        expect(payment.feeAmount).toBeCloseTo(payment.customerAmount - expectedTotal, 2);
      } else if (type === 'Devedor') {
        expect(payment).toMatchObject({
          debtInstallments: 1
        });
        expect(payment.account).toBeUndefined();
      } else {
        expect(payment.account).toBe('Conta Bancária');
        expect(payment.customerAmount).toBeUndefined();
        expect(payment.feeAmount).toBeUndefined();
      }

      expect(await screen.findByText('Venda Realizada!')).toBeInTheDocument();
      expect(toastSuccessMock).toHaveBeenCalledWith('Venda registrada.');
    },
    LEGACY_PDV_FLOW_TIMEOUT_MS
  );

  it('finalizes sale without customer payments when trade-in is greater than sold items', async () => {
    const user = userEvent.setup();
    render(<PDV />);

    await selectSeller(user);
    await selectStore(user);
    await selectClient(user);
    await selectProduct(user);
    await addTradeIn(user);
    await addTradeIn(user);
    await addTradeIn(user);
    await addTradeIn(user);
    await user.click(screen.getByRole('button', { name: /Continuar|Avançar para pagamento/i }));
    await user.click(await screen.findByRole('button', { name: 'Finalizar Venda' }));

    expect(addSaleMock).toHaveBeenCalledTimes(1);
    const payload = addSaleMock.mock.calls[0][0];

    expect(payload.total).toBe(0);
    expect(payload.tradeInValue).toBe(4000);
    expect(payload.tradeIns).toHaveLength(4);
    expect(payload.paymentMethods).toEqual([]);
    expect(payload.clientPaymentAmount).toBe(1000);
    expect(payload.clientPaymentMode).toBe('immediate');
    expect(payload.clientPaymentAccount).toBe('Conta Bancária');
    expect(payload.clientPaymentMethod).toBe('Pix');
    expect(toastSuccessMock).toHaveBeenCalledWith('Venda finalizada — R$ 1.000,00 pago ao cliente via Pix.');
  }, LEGACY_PDV_FLOW_TIMEOUT_MS);

  it('only allows Pix and Dinheiro for customer refund when trade-in exceeds sale total', async () => {
    const user = userEvent.setup();
    render(<PDV />);

    await selectSeller(user);
    await selectStore(user);
    await selectClient(user);
    await selectProduct(user);
    await addTradeIn(user);
    await addTradeIn(user);
    await addTradeIn(user);
    await addTradeIn(user);

    await user.click(screen.getByRole('button', { name: /Continuar|Avançar para pagamento/i }));

    expect(screen.getByRole('button', { name: 'Pix' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dinheiro' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cartão' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cartão Débito' })).not.toBeInTheDocument();
  }, LEGACY_PDV_FLOW_TIMEOUT_MS);

  it('ignores invalid saved customer refund method when finalizing a trade-in refund sale', async () => {
    const user = userEvent.setup();
    window.localStorage.setItem('pdv:draft:v1', JSON.stringify({
      selectedStore: 'store-1',
      selectedSeller: 'sel-1',
      selectedClient: 'cust-1',
      cartItemIds: ['stk-1'],
      draftTradeIns: [
        makeDraftTradeIn('trade-1'),
        makeDraftTradeIn('trade-2'),
        makeDraftTradeIn('trade-3'),
        makeDraftTradeIn('trade-4')
      ],
      negotiatedPriceInput: '3000.00',
      clientPaymentMode: 'immediate',
      clientPaymentAccount: 'Conta Bancária',
      clientPaymentMethod: 'Cartão'
    }));

    render(<PDV />);

    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Loja' })).toHaveTextContent('Loja Centro');
    });
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    await user.click(screen.getByRole('button', { name: /Avançar para pagamento/i }));
    fireEvent.change(screen.getByLabelText('Valor negociado do aparelho'), { target: { value: '3000' } });
    await user.click(await screen.findByRole('button', { name: 'Finalizar Venda' }));

    expect(addSaleMock).toHaveBeenCalledTimes(1);
    const payload = addSaleMock.mock.calls[0][0];

    expect(payload.clientPaymentAmount).toBe(1000);
    expect(payload.clientPaymentMode).toBe('immediate');
    expect(payload.clientPaymentMethod).toBe('Pix');
  }, LEGACY_PDV_FLOW_TIMEOUT_MS);

  it('does not reapply a restored draft payment after it is removed and stock refreshes', async () => {
    const user = userEvent.setup();
    const initialData = useDataMock();
    window.localStorage.setItem('pdv:draft:v1', JSON.stringify({
      selectedStore: 'store-1',
      selectedSeller: 'sel-1',
      selectedClient: 'cust-1',
      cartItemIds: ['stk-1'],
      payments: [
        {
          type: 'Pix',
          amount: 3000,
          account: 'Conta Bancária'
        }
      ]
    }));

    const { rerender } = render(<PDV />);

    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Loja' })).toHaveTextContent('Loja Centro');
    });
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    await user.click(screen.getByRole('button', { name: /Avançar para pagamento/i }));
    expect(screen.getByText('Conta: Conta Bancária')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Remover pagamento' }));
    await waitFor(() => {
      expect(screen.queryByText('Conta: Conta Bancária')).not.toBeInTheDocument();
    });

    useDataMock.mockReturnValue({
      ...initialData,
      stock: [
        ...initialData.stock,
        {
          id: 'stock-refresh-marker',
          type: DeviceType.IPHONE,
          model: 'iPhone Refresh Marker',
          color: 'Verde',
          capacity: '64 GB',
          imei: '555555555555555',
          condition: Condition.USED,
          status: StockStatus.AVAILABLE,
          storeId: 'store-1',
          purchasePrice: 1000,
          sellPrice: 1500,
          maxDiscount: 0,
          warrantyType: WarrantyType.STORE,
          costs: [],
          photos: [],
          entryDate: '2026-02-16'
        }
      ]
    });
    rerender(<PDV />);

    expect(screen.queryByText('Conta: Conta Bancária')).not.toBeInTheDocument();
  }, LEGACY_PDV_FLOW_TIMEOUT_MS);

  it('discards a pending draft when the user edits before draft stock resolves', async () => {
    const user = userEvent.setup();
    const initialData = useDataMock();
    window.localStorage.setItem('pdv:draft:v1', JSON.stringify({
      selectedStore: 'store-1',
      selectedSeller: 'sel-1',
      selectedClient: 'cust-1',
      cartItemIds: ['stk-1'],
      payments: [
        {
          type: 'Pix',
          amount: 3000,
          account: 'Conta Bancária'
        }
      ]
    }));

    useDataMock.mockReturnValue({
      ...initialData,
      stock: []
    });

    const { rerender } = render(<PDV />);

    await selectStore(user, 'Loja Sobral');

    useDataMock.mockReturnValue(initialData);
    rerender(<PDV />);

    expect(screen.getByRole('combobox', { name: 'Loja' })).toHaveTextContent('Loja Sobral');
    expect(screen.queryByText(/iPhone 14 Test/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Conta: Conta Bancária')).not.toBeInTheDocument();
  }, LEGACY_PDV_FLOW_TIMEOUT_MS);

  it('submits a sale only once while the finish request is in flight', async () => {
    const user = userEvent.setup();
    let resolveAddSale: (() => void) | undefined;
    addSaleMock.mockImplementationOnce(
      () => new Promise<void>((resolve) => {
        resolveAddSale = resolve;
      })
    );

    await prepareSalePaymentStep(user, false);
    await addPayment(user, 'Pix');

    const finishButton = await screen.findByRole('button', { name: 'Finalizar Venda' });
    fireEvent.click(finishButton);
    fireEvent.click(finishButton);
    fireEvent.click(finishButton);

    expect(addSaleMock).toHaveBeenCalledTimes(1);

    resolveAddSale?.();
    await waitFor(() => expect(screen.getByText('Venda Realizada!')).toBeInTheDocument());
  }, LEGACY_PDV_FLOW_TIMEOUT_MS);

  it('reuses the same sale id when the operator retries after a finish error', async () => {
    const user = userEvent.setup();
    addSaleMock.mockRejectedValue(new Error('Falha após gravar venda'));

    await prepareSalePaymentStep(user, false);
    await addPayment(user, 'Pix');

    await user.click(await screen.findByRole('button', { name: 'Finalizar Venda' }));
    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith('Falha após gravar venda'));
    await user.click(await screen.findByRole('button', { name: 'Finalizar Venda' }));
    await user.click(await screen.findByRole('button', { name: 'Finalizar Venda' }));

    expect(addSaleMock).toHaveBeenCalledTimes(3);
    const saleIds = addSaleMock.mock.calls.map(([payload]) => payload.id);
    expect(new Set(saleIds).size).toBe(1);
  }, LEGACY_PDV_FLOW_TIMEOUT_MS);

  it('does not list products by default and requires search to display options', async () => {
    const user = userEvent.setup();
    render(<PDV />);

    expect(screen.queryByText('iPhone 14 Test 256 GB')).not.toBeInTheDocument();

    await selectSeller(user);
    await selectStore(user);
    await selectClient(user);
    expect(screen.queryByRole('combobox', { name: 'Produto' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /2. Produtos/i }));
    await user.click(screen.getByRole('combobox', { name: 'Produto' }));
    expect(screen.getByText('Digite ao menos 2 caracteres.')).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('Digite modelo, IMEI/Serial ou cor...'), 'i');
    expect(screen.getByText('Digite ao menos 2 caracteres.')).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('Digite modelo, IMEI/Serial ou cor...'), 'phone');
    expect(screen.getByText('iPhone 14 Test 256 GB')).toBeInTheDocument();
  });

  it('keeps step navigation manual and does not auto advance', async () => {
    const user = userEvent.setup();
    render(<PDV />);

    await selectSeller(user);
    await selectStore(user);
    await selectClient(user);

    expect(screen.queryByRole('combobox', { name: 'Produto' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /2. Produtos/i }));
    await selectProduct(user);

    expect(screen.queryByText('Checklist de Conclusão')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Continuar|Avançar para pagamento/i }));
    expect(screen.getByText('Checklist de Conclusão')).toBeInTheDocument();
  });

  it('opens debtor modal, captures metadata and adds debtor payment entry', async () => {
    const user = userEvent.setup();
    render(<PDV />);

    await selectSeller(user);
    await selectStore(user);
    await selectClient(user);

    await selectProduct(user);
    await user.click(screen.getByRole('button', { name: /Continuar|Avançar para pagamento/i }));
    await user.click(screen.getByRole('button', { name: 'Devedor' }));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Configurar Devedor')).toBeInTheDocument();

    const dateInput = dialog.querySelector('input[type="date"]') as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: '2026-03-10' } });
    const notesInput = within(dialog).getByPlaceholderText('Ex: parcela mensal todo dia 10');
    fireEvent.change(notesInput, { target: { value: 'Pagamento em 2 parcelas' } });
    expect(notesInput).toHaveValue('Pagamento em 2 parcelas');
    await user.click(within(dialog).getByRole('button', { name: 'Confirmar' }));

    expect(screen.getAllByText('Devedor').length).toBeGreaterThan(0);
    expect(screen.getByText(/Venc\.:/)).toBeInTheDocument();
  }, LEGACY_PDV_FLOW_TIMEOUT_MS);

  it('requires customer before selecting debtor payment', async () => {
    const user = userEvent.setup();
    render(<PDV />);

    await selectSeller(user);
    await selectStore(user);
    await selectProduct(user);
    await user.click(screen.getByRole('button', { name: /Continuar|Avançar para pagamento/i }));

    expect(toastErrorMock).toHaveBeenCalledWith('Selecione um cliente antes de avançar para o pagamento.');
    expect(screen.queryByText('Configurar Devedor')).not.toBeInTheDocument();
  });

  it('finalizes sale and sends debtor metadata in addSale payload', async () => {
    const user = userEvent.setup();
    render(<PDV />);

    await selectSeller(user);
    await selectStore(user);
    await selectClient(user);

    await selectProduct(user);
    await user.click(screen.getByRole('button', { name: /Continuar|Avançar para pagamento/i }));
    await user.click(screen.getByRole('button', { name: 'Devedor' }));

    const debtDialog = screen.getByRole('dialog');
    const dateInput = debtDialog.querySelector('input[type="date"]') as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: '2026-03-15' } });
    fireEvent.change(within(debtDialog).getByPlaceholderText('Ex: parcela mensal todo dia 10'), {
      target: { value: 'Primeira cobrança em março' }
    });
    await user.click(within(debtDialog).getByRole('button', { name: 'Confirmar' }));

    await user.click(await screen.findByRole('button', { name: 'Finalizar Venda' }));

    expect(addSaleMock).toHaveBeenCalledTimes(1);
    const payload = addSaleMock.mock.calls[0][0];

    expect(payload.customerId).toBe('cust-1');
    expect(payload.sellerId).toBe('sel-1');
    expect(payload.storeId).toBe('store-1');
    expect(payload.total).toBe(3000);
    expect(payload.tradeIn).toBeUndefined();
    expect(payload.paymentMethods).toEqual([
      {
        type: 'Devedor',
        amount: 3000,
        debtDueDate: '2026-03-15',
        debtInstallments: 1,
        debtNotes: 'Primeira cobrança em março'
      }
    ]);

    const saleDate = new Date(payload.date);
    expect(payload.warrantyExpiresAt).not.toBeNull();
    const warrantyDate = new Date(payload.warrantyExpiresAt);
    const expectedWarranty = new Date(saleDate);
    expectedWarranty.setDate(expectedWarranty.getDate() + 90);

    expect(warrantyDate.getTime()).toBeGreaterThan(saleDate.getTime());
    expect(Math.abs(warrantyDate.getTime() - expectedWarranty.getTime())).toBeLessThan(60_000);

    expect(await screen.findByText('Venda Realizada!')).toBeInTheDocument();
    expect(toastSuccessMock).toHaveBeenCalledWith('Venda registrada.');
  }, LEGACY_PDV_FLOW_TIMEOUT_MS);

  it('finalizes a consolidated sale with two devices and two trade-ins', async () => {
    const user = userEvent.setup();
    render(<PDV />);

    await selectSeller(user);
    await selectStore(user);
    await selectClient(user);
    await user.click(screen.getByRole('button', { name: /2. Produtos/i }));

    await addProductToCart(user, 'iPhone 14', /iPhone 14 Test/);
    await addProductToCart(user, 'iPhone 13', /iPhone 13 Test/);
    const warrantySelects = screen.getAllByDisplayValue('90 dias');
    fireEvent.change(warrantySelects[0], { target: { value: '180' } });

    await user.click(screen.getByRole('button', { name: '+ Adicionar' }));
    await user.click(screen.getByRole('button', { name: 'Salvar trade-in mock' }));
    await user.click(screen.getByRole('button', { name: '+ Adicionar' }));
    await user.click(screen.getByRole('button', { name: 'Salvar trade-in mock' }));

    await user.click(screen.getByRole('button', { name: /Avançar para pagamento/i }));
    await user.click(screen.getByRole('button', { name: 'Devedor' }));
    const debtDialog = screen.getByRole('dialog');
    await user.click(within(debtDialog).getByRole('button', { name: 'Confirmar' }));
    await user.click(await screen.findByRole('button', { name: 'Finalizar Venda' }));

    expect(addSaleMock).toHaveBeenCalledTimes(1);
    const payload = addSaleMock.mock.calls[0][0];
    expect(payload.items).toHaveLength(2);
    expect(payload.tradeIns).toHaveLength(2);
    expect(payload.originalSubtotal).toBe(5500);
    expect(payload.negotiatedSubtotal).toBe(5500);
    expect(payload.tradeInValue).toBe(2000);
    expect(payload.total).toBe(3500);
    expect(payload.paymentMethods[0]).toMatchObject({ type: 'Devedor', amount: 3500 });
    expect(payload.items.every((item: any) => item.warrantyExpiresAt)).toBe(true);
    const firstWarrantyDate = new Date(payload.items[0].warrantyExpiresAt);
    const secondWarrantyDate = new Date(payload.items[1].warrantyExpiresAt);
    expect(firstWarrantyDate.getTime()).toBeGreaterThan(secondWarrantyDate.getTime());
    expect(payload.tradeIns.every((tradeIn: any) => tradeIn.stockSnapshot)).toBe(true);
  }, LEGACY_PDV_FLOW_TIMEOUT_MS);

  it('filters products in step 2 by selected store', async () => {
    const user = userEvent.setup();
    useDataMock.mockReturnValue({
      stock: [
        {
          id: 'stk-store-1',
          type: DeviceType.IPHONE,
          model: 'iPhone Centro',
          color: 'Preto',
          capacity: '128 GB',
          imei: '111111111111111',
          condition: Condition.USED,
          status: StockStatus.AVAILABLE,
          storeId: 'store-1',
          purchasePrice: 2200,
          sellPrice: 3000,
          maxDiscount: 0,
          warrantyType: WarrantyType.STORE,
          costs: [],
          photos: [],
          entryDate: '2026-02-15'
        },
        {
          id: 'stk-store-2',
          type: DeviceType.IPHONE,
          model: 'iPhone Sobral',
          color: 'Azul',
          capacity: '256 GB',
          imei: '222222222222222',
          condition: Condition.USED,
          status: StockStatus.AVAILABLE,
          storeId: 'store-2',
          purchasePrice: 2600,
          sellPrice: 3400,
          maxDiscount: 0,
          warrantyType: WarrantyType.STORE,
          costs: [],
          photos: [],
          entryDate: '2026-02-15'
        }
      ],
      customers: [
        {
          id: 'cust-1',
          name: 'Cliente Teste',
          cpf: '',
          phone: '',
          email: '',
          birthDate: '',
          purchases: 0,
          totalSpent: 0
        }
      ],
      sellers: [
        {
          id: 'sel-1',
          name: 'Vendedor Teste',
          email: '',
          authUserId: '',
          storeId: '',
          totalSales: 0
        }
      ],
      stores: [
        { id: 'store-1', name: 'Loja Centro', city: 'Fortaleza' },
        { id: 'store-2', name: 'Loja Sobral', city: 'Sobral' }
      ],
      addSale: addSaleMock,
      businessProfile: { name: 'Loja Teste' },
      cardFeeSettings: {
        visaMasterRates: [2.99, 4.09, 4.78, 5.47, 6.14, 6.81, 7.67, 8.33, 8.98, 9.63, 10.26, 10.9, 12.32, 12.94, 13.56, 14.17, 14.77, 15.37],
        otherRates: [3.99, 5.3, 5.99, 6.68, 7.35, 8.02, 9.47, 10.13, 10.78, 11.43, 12.06, 12.7, 13.32, 13.94, 14.56, 15.17, 15.77, 16.37],
        debitRate: 1.87
      }
    });
    render(<PDV />);

    await selectSeller(user);
    await selectStore(user, 'Loja Sobral');
    await selectClient(user);
    await user.click(screen.getByRole('button', { name: /2. Produtos/i }));

    await user.click(screen.getByRole('combobox', { name: 'Produto' }));
    await user.type(screen.getByPlaceholderText('Digite modelo, IMEI/Serial ou cor...'), 'iPhone');

    expect(screen.getByText('iPhone Sobral 256 GB')).toBeInTheDocument();
    expect(screen.queryByText('iPhone Centro 128 GB')).not.toBeInTheDocument();
  });

  it('opens print format modal and prints selected A4 layout', async () => {
    const user = userEvent.setup();
    render(<PDV />);

    await selectSeller(user);
    await selectStore(user);
    await selectClient(user);
    await selectProduct(user);
    await user.click(screen.getByRole('button', { name: /Continuar|Avançar para pagamento/i }));
    await user.click(screen.getByRole('button', { name: 'Devedor' }));
    const debtDialog = screen.getByRole('dialog');
    await user.click(within(debtDialog).getByRole('button', { name: 'Confirmar' }));
    await user.click(await screen.findByRole('button', { name: 'Finalizar Venda' }));
    expect(await screen.findByText('Venda Realizada!')).toBeInTheDocument();
    expect(document.getElementById('receipt-content-80mm')).toHaveTextContent('Cor: Preto');

    await user.click(screen.getByRole('button', { name: 'Imprimir Comprovante' }));
    const printDialog = screen.getByRole('dialog');
    expect(within(printDialog).getByRole('heading', { name: 'Escolher formato de impressão' })).toBeInTheDocument();

    const a4Option = within(printDialog).getByRole('button', { name: /A4 \(arquivo\/entrega formal\)/i });
    await user.click(a4Option);
    expect(a4Option).toHaveAttribute('aria-pressed', 'true');

    await user.click(within(printDialog).getByRole('button', { name: 'Imprimir agora' }));
    await waitFor(() => {
      expect(printMock).toHaveBeenCalledTimes(1);
    });
    expect(document.body).toHaveAttribute('data-print-layout', 'a4');
    expect(document.getElementById('pdv-print-page-style')).toHaveTextContent('@page { size: A4 portrait; margin: 6mm; }');
    expect(document.getElementById('pdv-print-page-style')).toHaveTextContent('--pdv-a4-print-scale: 0.74;');
  }, LEGACY_PDV_FLOW_TIMEOUT_MS);

  it('applies card surcharge from installments and persists net/liquid fields', async () => {
    const user = userEvent.setup();
    render(<PDV />);

    await selectSeller(user);
    await selectStore(user);
    await selectClient(user);
    await selectProduct(user);
    await user.click(screen.getByRole('button', { name: /Continuar|Avançar para pagamento/i }));

    await user.click(screen.getByRole('button', { name: 'Pix' }));
    const pixDialog = screen.getByRole('dialog');
    const pixAmountInput = within(pixDialog).getByRole('spinbutton');
    fireEvent.change(pixAmountInput, { target: { value: '2000' } });
    await user.click(within(pixDialog).getByRole('button', { name: 'Adicionar' }));

    await user.click(screen.getByRole('button', { name: 'Cartão Crédito' }));
    const cardDialog = screen.getByRole('dialog');
    expect(within(cardDialog).getByRole('heading', { name: 'Adicionar Cartão' })).toBeInTheDocument();
    await user.click(within(cardDialog).getByText('2x'));
    await user.click(within(cardDialog).getByRole('button', { name: 'Adicionar Cartão' }));

    await user.click(await screen.findByRole('button', { name: 'Finalizar Venda' }));

    expect(addSaleMock).toHaveBeenCalledTimes(1);
    const payload = addSaleMock.mock.calls[0][0];

    expect(payload.paymentMethods[0]).toEqual({
      type: 'Pix',
      amount: 2000,
      account: 'Conta Bancária'
    });
    expect(payload.paymentMethods[1]).toEqual({
      type: 'Cartão',
      amount: 1000,
      account: 'Conta Bancária',
      installments: 2,
      cardBrand: 'visa_master',
      customerAmount: 1042.64,
      feeRate: 4.09,
      feeAmount: 42.64
    });
  });

  it('allows negotiated price above catalog and applies percentage discount in step 3', async () => {
    const user = userEvent.setup();
    render(<PDV />);

    await selectSeller(user);
    await selectStore(user);
    await selectClient(user);
    await selectProduct(user);
    await user.click(screen.getByRole('button', { name: /Continuar|Avançar para pagamento/i }));

    const negotiatedInput = screen.getByLabelText('Valor negociado do aparelho');
    fireEvent.change(negotiatedInput, { target: { value: '3500' } });
    fireEvent.blur(negotiatedInput);

    await user.click(screen.getByRole('button', { name: 'Aplicar desconto' }));
    const discountDialog = screen.getByRole('dialog');
    await user.click(within(discountDialog).getByRole('button', { name: '%' }));
    const discountValueInput = within(discountDialog).getByLabelText('Valor do desconto (%)');
    fireEvent.change(discountValueInput, { target: { value: '10' } });
    await user.click(within(discountDialog).getByRole('button', { name: 'Aplicar' }));

    await user.click(screen.getByRole('button', { name: 'Devedor' }));
    const debtDialog = screen.getByRole('dialog');
    await user.click(within(debtDialog).getByRole('button', { name: 'Confirmar' }));
    await user.click(screen.getByRole('button', { name: 'Finalizar Venda' }));

    expect(addSaleMock).toHaveBeenCalledTimes(1);
    const payload = addSaleMock.mock.calls[0][0];

    expect(payload.total).toBe(3150);
    expect(payload.discount).toBe(350);
    expect(payload.discountType).toBe('percent');
    expect(payload.discountPercent).toBe(10);
    expect(payload.originalSubtotal).toBe(3000);
    expect(payload.negotiatedSubtotal).toBe(3500);
    expect(payload.items[0].sellPrice).toBe(3500);
    expect(payload.items[0].originalSellPrice).toBe(3000);
    expect(payload.paymentMethods[0]).toMatchObject({
      type: 'Devedor',
      amount: 3150
    });
  });

  it('blocks finalization when payment exceeds recalculated total', async () => {
    const user = userEvent.setup();
    render(<PDV />);

    await selectSeller(user);
    await selectStore(user);
    await selectClient(user);
    await selectProduct(user);
    await user.click(screen.getByRole('button', { name: /Continuar|Avançar para pagamento/i }));

    await user.click(screen.getByRole('button', { name: 'Pix' }));
    const pixDialog = screen.getByRole('dialog');
    fireEvent.change(within(pixDialog).getByRole('spinbutton'), { target: { value: '3000' } });
    await user.click(within(pixDialog).getByRole('button', { name: 'Adicionar' }));

    await user.click(screen.getByRole('button', { name: 'Aplicar desconto' }));
    const discountDialog = screen.getByRole('dialog');
    const amountInput = within(discountDialog).getByLabelText('Valor do desconto (R$)');
    fireEvent.change(amountInput, { target: { value: '500' } });
    await user.click(within(discountDialog).getByRole('button', { name: 'Aplicar' }));

    expect(screen.getByRole('button', { name: 'Pagamento Excedente' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Pagamento Excedente' }));

    expect(toastErrorMock).toHaveBeenCalledWith('Pagamento excedente. Ajuste ou remova pagamentos.');
    expect(addSaleMock).not.toHaveBeenCalled();
  });

  it('shows Apple warranty separately for new device receipts', async () => {
    const user = userEvent.setup();
    useDataMock.mockReturnValue({
      stock: [
        {
          id: 'stk-1',
          type: DeviceType.IPHONE,
          model: 'iPhone 14 Test',
          color: 'Preto',
          capacity: '256 GB',
          imei: '123456789012345',
          condition: Condition.NEW,
          status: StockStatus.AVAILABLE,
          storeId: 'store-1',
          purchasePrice: 2500,
          sellPrice: 3000,
          maxDiscount: 0,
          warrantyType: WarrantyType.APPLE,
          costs: [],
          photos: [],
          entryDate: '2026-02-15'
        }
      ],
      customers: [
        {
          id: 'cust-1',
          name: 'Cliente Teste',
          cpf: '',
          phone: '',
          email: '',
          birthDate: '',
          purchases: 0,
          totalSpent: 0
        }
      ],
      sellers: [
        {
          id: 'sel-1',
          name: 'Vendedor Teste',
          email: '',
          authUserId: '',
          storeId: '',
          totalSales: 0
        }
      ],
      stores: [
        { id: 'store-1', name: 'Loja Centro', city: 'Fortaleza' },
        { id: 'store-2', name: 'Loja Sobral', city: 'Sobral' }
      ],
      addSale: addSaleMock,
      businessProfile: { name: 'Loja Teste' },
      cardFeeSettings: {
        visaMasterRates: [2.99, 4.09, 4.78, 5.47, 6.14, 6.81, 7.67, 8.33, 8.98, 9.63, 10.26, 10.9, 12.32, 12.94, 13.56, 14.17, 14.77, 15.37],
        otherRates: [3.99, 5.3, 5.99, 6.68, 7.35, 8.02, 9.47, 10.13, 10.78, 11.43, 12.06, 12.7, 13.32, 13.94, 14.56, 15.17, 15.77, 16.37],
        debitRate: 1.87
      }
    });
    render(<PDV />);

    await selectSeller(user);
    await selectStore(user);
    await selectClient(user);
    await user.click(screen.getByRole('button', { name: /2. Produtos/i }));
    await user.click(screen.getByRole('button', { name: 'Novo' }));
    await selectProduct(user);
    await user.click(screen.getByRole('button', { name: /Continuar|Avançar para pagamento/i }));
    await user.click(screen.getByRole('button', { name: 'Devedor' }));
    const debtDialog = screen.getByRole('dialog');
    await user.click(within(debtDialog).getByRole('button', { name: 'Confirmar' }));
    await user.click(await screen.findByRole('button', { name: 'Finalizar Venda' }));

    expect(addSaleMock).toHaveBeenCalledTimes(1);
    const payload = addSaleMock.mock.calls[0][0];
    expect(payload.warrantyExpiresAt).toBeNull();
    expect(screen.queryByText('Garantia de 90 dias')).not.toBeInTheDocument();
    expect(document.getElementById('receipt-content-80mm')).toHaveTextContent('Garantia Apple: 1 ano');
  });
});
