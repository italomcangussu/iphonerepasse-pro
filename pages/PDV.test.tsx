import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Condition, DeviceType, StockStatus, WarrantyType } from '../types';
import PDV from './PDV';

const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();
const useDataMock = vi.fn();
const useAuthMock = vi.fn();
const addSaleMock = vi.fn();
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

vi.mock('../components/AddCustomerModal', () => ({
  AddCustomerModal: () => null
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
    await user.click(screen.getByText('Vendedor Teste'));
  };

  const selectStore = async (user: ReturnType<typeof userEvent.setup>, storeName = 'Loja Centro') => {
    await user.click(screen.getByRole('combobox', { name: 'Loja' }));
    await user.click(screen.getByText(storeName));
  };

  const selectClient = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole('combobox', { name: 'Cliente' }));
    await user.click(screen.getByText('Cliente Teste'));
  };

  const selectProduct = async (user: ReturnType<typeof userEvent.setup>) => {
    if (!screen.queryByRole('combobox', { name: 'Produto' })) {
      await user.click(screen.getByRole('button', { name: '2. Produto/Troca' }));
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

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    document.body.removeAttribute('data-print-layout');
    document.getElementById('pdv-print-page-style')?.remove();
    addSaleMock.mockResolvedValue(undefined);
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
      businessProfile: { name: 'Loja Teste' },
      cardFeeSettings: {
        visaMasterRates: [2.99, 4.09, 4.78, 5.47, 6.14, 6.81, 7.67, 8.33, 8.98, 9.63, 10.26, 10.9, 12.32, 12.94, 13.56, 14.17, 14.77, 15.37],
        otherRates: [3.99, 5.3, 5.99, 6.68, 7.35, 8.02, 9.47, 10.13, 10.78, 11.43, 12.06, 12.7, 13.32, 13.94, 14.56, 15.17, 15.77, 16.37]
      }
    });
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
    expect(screen.getByRole('button', { name: 'Cartão' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Devedor' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cartão Crédito' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cartão Débito' })).not.toBeInTheDocument();
  }, 10000);

  it('does not list products by default and requires search to display options', async () => {
    const user = userEvent.setup();
    render(<PDV />);

    expect(screen.queryByText('iPhone 14 Test 256 GB')).not.toBeInTheDocument();

    await selectSeller(user);
    await selectStore(user);
    await selectClient(user);
    expect(screen.queryByRole('combobox', { name: 'Produto' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '2. Produto/Troca' }));
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

    await user.click(screen.getByRole('button', { name: '2. Produto/Troca' }));
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
  }, 15000);

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
  });

  it('finalizes a consolidated sale with two devices and two trade-ins', async () => {
    const user = userEvent.setup();
    render(<PDV />);

    await selectSeller(user);
    await selectStore(user);
    await selectClient(user);
    await user.click(screen.getByRole('button', { name: '2. Produto/Troca' }));

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
  }, 15000);

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
        otherRates: [3.99, 5.3, 5.99, 6.68, 7.35, 8.02, 9.47, 10.13, 10.78, 11.43, 12.06, 12.7, 13.32, 13.94, 14.56, 15.17, 15.77, 16.37]
      }
    });
    render(<PDV />);

    await selectSeller(user);
    await selectStore(user, 'Loja Sobral');
    await selectClient(user);
    await user.click(screen.getByRole('button', { name: '2. Produto/Troca' }));

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
  }, 15000);

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

    await user.click(screen.getByRole('button', { name: 'Cartão' }));
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
        otherRates: [3.99, 5.3, 5.99, 6.68, 7.35, 8.02, 9.47, 10.13, 10.78, 11.43, 12.06, 12.7, 13.32, 13.94, 14.56, 15.17, 15.77, 16.37]
      }
    });
    render(<PDV />);

    await selectSeller(user);
    await selectStore(user);
    await selectClient(user);
    await user.click(screen.getByRole('button', { name: '2. Produto/Troca' }));
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
