/**
 * RED TESTS (TDD) — Trade-in as part of the payment value in PDV.
 *
 * These tests describe the behaviour we *want* when a sale uses one or more
 * trade-in devices to compose the amount paid. They are intentionally failing
 * today because they exercise gaps and latent bugs in the current sale flow:
 *
 *  - The PDV doesn't yet let the operator override the trade-in received value
 *    (it always uses the trade-in's catalog `purchasePrice`).
 *  - There is no IMEI cross-check between cart items and trade-ins.
 *  - Trade-ins with zero received value are silently dropped on persistence.
 *  - The trade-in surplus refund accepts payment methods that are not valid
 *    for refunds (Cartão/Cartão Débito).
 *  - State for the client-refund block leaks when all trade-ins are removed.
 *  - Multiple trade-in totals can drift in cents when summing floats.
 *
 * As each test goes green it documents one diagnosed bug being fixed.
 */
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Condition, DeviceType, StockStatus, WarrantyType } from '../types';
import PDV from './PDV';

const LEGACY_PDV_FLOW_TIMEOUT_MS = 60_000;

vi.setConfig({ testTimeout: LEGACY_PDV_FLOW_TIMEOUT_MS });

const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();
const useDataMock = vi.fn();
const useAuthMock = vi.fn();
const addSaleMock = vi.fn();

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

vi.mock('../components/AddCustomerModal', () => ({ AddCustomerModal: () => null }));
vi.mock('../components/AddSellerModal', () => ({ AddSellerModal: () => null }));

/**
 * The mocked StockFormModal accepts a numeric `purchasePrice` argument so each
 * test can craft trade-ins with specific received values, IMEIs and decimals
 * without going through the real (large) form component.
 */
let nextTradeInOverride: Partial<{
  id: string;
  imei: string;
  purchasePrice: number;
  model: string;
}> = {};

vi.mock('../components/StockFormModal', () => ({
  StockFormModal: ({ open, onSave }: { open: boolean; onSave?: (item: any) => void }) =>
    open ? (
      <button
        type="button"
        onClick={() => {
          const override = nextTradeInOverride;
          nextTradeInOverride = {};
          onSave?.({
            id: override.id || `trade-${Math.random()}`,
            type: DeviceType.IPHONE,
            model: override.model || 'iPhone Trade',
            color: 'Azul',
            capacity: '128 GB',
            imei: override.imei ?? `trade-imei-${Math.random()}`,
            condition: Condition.USED,
            status: StockStatus.PREPARATION,
            storeId: 'store-1',
            purchasePrice: override.purchasePrice ?? 1000,
            sellPrice: 0,
            maxDiscount: 0,
            warrantyType: WarrantyType.STORE,
            costs: [],
            photos: [],
            entryDate: '2026-02-20'
          });
        }}
      >
        Salvar trade-in mock
      </button>
    ) : null
}));

const baseDataContext = () => ({
  stock: [
    {
      id: 'stk-1',
      type: DeviceType.IPHONE,
      model: 'iPhone 14 Test',
      color: 'Preto',
      capacity: '256 GB',
      imei: 'imei-cart-001',
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
    }
  ],
  customers: [
    {
      id: 'cust-1',
      name: 'Cliente Teste',
      cpf: '',
      phone: '(85) 99999-0000',
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
    { id: 'store-1', name: 'Loja Centro', city: 'Fortaleza' }
  ],
  addSale: addSaleMock,
  businessProfile: { name: 'Loja Teste' },
  cardFeeSettings: {
    visaMasterRates: Array(18).fill(2.99),
    otherRates: Array(18).fill(3.99),
    debitRate: 1.87
  }
});

describe('PDV trade-in as paid value — diagnostic RED tests', () => {
  const selectSeller = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole('combobox', { name: 'Vendedor' }));
    await user.click(await screen.findByText('Vendedor Teste'));
  };
  const selectStore = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole('combobox', { name: 'Loja' }));
    await user.click(await screen.findByText('Loja Centro'));
  };
  const selectClient = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole('combobox', { name: 'Cliente' }));
    await user.click(await screen.findByText('Cliente Teste'));
  };
  const selectProduct = async (user: ReturnType<typeof userEvent.setup>) => {
    if (!screen.queryByRole('combobox', { name: 'Produto' })) {
      await user.click(screen.getByRole('button', { name: /2\. Produtos/i }));
    }
    await user.click(screen.getByRole('combobox', { name: 'Produto' }));
    await user.type(screen.getByPlaceholderText('Digite modelo, IMEI/Serial ou cor...'), 'iPhone');
    await user.click(screen.getByText(/iPhone 14 Test/));
    await user.click(screen.getByRole('button', { name: 'Adicionar ao carrinho' }));
  };
  const addTradeIn = async (
    user: ReturnType<typeof userEvent.setup>,
    overrides: typeof nextTradeInOverride = {}
  ) => {
    nextTradeInOverride = overrides;
    await user.click(screen.getByRole('button', { name: '+ Adicionar' }));
    await user.click(screen.getByRole('button', { name: 'Salvar trade-in mock' }));
  };

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    nextTradeInOverride = {};
    addSaleMock.mockResolvedValue(undefined);
    useAuthMock.mockReturnValue({ role: 'admin' });
    useDataMock.mockReturnValue(baseDataContext());
  });

  // ---------------------------------------------------------------------------
  // 1. Editable trade-in received value (independent of catalog purchasePrice)
  // ---------------------------------------------------------------------------
  it('allows operator to override the trade-in received value inline before finalizing', async () => {
    const user = userEvent.setup();
    render(<PDV />);

    await selectSeller(user);
    await selectStore(user);
    await selectClient(user);
    await selectProduct(user);
    await addTradeIn(user, { purchasePrice: 1000 });

    // RED: this control does not exist yet. The PDV should expose a dedicated
    // input that lets the seller register the negotiated received value of the
    // trade-in, independent from the catalog purchase price.
    const valueInput = screen.getByLabelText(/Valor recebido da troca/i) as HTMLInputElement;
    fireEvent.change(valueInput, { target: { value: '1500' } });
    fireEvent.blur(valueInput);

    await user.click(screen.getByRole('button', { name: /Avançar para pagamento/i }));
    await user.click(screen.getByRole('button', { name: 'Pix' }));
    const pixDialog = screen.getByRole('dialog');
    await user.click(within(pixDialog).getByRole('button', { name: 'Adicionar' }));
    await user.click(screen.getByRole('button', { name: 'Finalizar Venda' }));

    expect(addSaleMock).toHaveBeenCalledTimes(1);
    const payload = addSaleMock.mock.calls[0][0];
    expect(payload.tradeInValue).toBe(1500);
    expect(payload.tradeIns).toHaveLength(1);
    expect(payload.tradeIns[0].receivedValue).toBe(1500);
    expect(payload.total).toBe(1500); // 3000 - 1500 trade-in
  });

  // ---------------------------------------------------------------------------
  // 2. Trade-in IMEI must not duplicate an item already in the sale cart
  // ---------------------------------------------------------------------------
  it('blocks adding a trade-in whose IMEI/Serial matches a product already in the cart', async () => {
    const user = userEvent.setup();
    render(<PDV />);

    await selectSeller(user);
    await selectStore(user);
    await selectClient(user);
    await selectProduct(user);

    // RED: the PDV should refuse a trade-in IMEI that collides with the
    // product currently being sold (a real cause of stock duplications).
    await addTradeIn(user, { imei: 'imei-cart-001', purchasePrice: 500 });

    expect(toastErrorMock).toHaveBeenCalledWith(
      expect.stringMatching(/IMEI.*(carrinho|venda|repetid|duplicad)/i)
    );
    expect(screen.queryByText(/Subtotal das entradas/)).not.toBeInTheDocument();
  });

  // ---------------------------------------------------------------------------
  // 3. Zero-value trade-ins must not be silently dropped
  // ---------------------------------------------------------------------------
  it('refuses to register a trade-in with received value of zero (instead of silently dropping it)', async () => {
    const user = userEvent.setup();
    render(<PDV />);

    await selectSeller(user);
    await selectStore(user);
    await selectClient(user);
    await selectProduct(user);
    await addTradeIn(user, { purchasePrice: 0 });

    // RED: dataContext.addSale currently filters trade-ins with
    // `receivedValue === 0` (silent loss). The PDV should prevent the user
    // from registering a zero-valued trade-in upfront.
    expect(toastErrorMock).toHaveBeenCalledWith(
      expect.stringMatching(/Valor.*troca|trade-in.*valor/i)
    );
    expect(screen.queryByText(/Subtotal das entradas/)).not.toBeInTheDocument();
  });

  // ---------------------------------------------------------------------------
  // 4. Floating-point precision when summing several trade-ins
  // ---------------------------------------------------------------------------
  it('keeps cumulative trade-in value precise in centavos across multiple devices', async () => {
    const user = userEvent.setup();
    render(<PDV />);

    await selectSeller(user);
    await selectStore(user);
    await selectClient(user);
    await selectProduct(user);

    await addTradeIn(user, { id: 'trade-a', imei: 'imei-a', purchasePrice: 333.33 });
    await addTradeIn(user, { id: 'trade-b', imei: 'imei-b', purchasePrice: 333.33 });
    await addTradeIn(user, { id: 'trade-c', imei: 'imei-c', purchasePrice: 333.34 });

    await user.click(screen.getByRole('button', { name: /Avançar para pagamento/i }));
    await user.click(screen.getByRole('button', { name: 'Pix' }));
    const pixDialog = screen.getByRole('dialog');
    await user.click(within(pixDialog).getByRole('button', { name: 'Adicionar' }));
    await user.click(screen.getByRole('button', { name: 'Finalizar Venda' }));

    expect(addSaleMock).toHaveBeenCalledTimes(1);
    const payload = addSaleMock.mock.calls[0][0];
    // Exact equality — no drift such as 999.9999999999999.
    expect(payload.tradeInValue).toBe(1000);
    expect(payload.tradeIns.reduce((acc: number, t: any) => acc + t.receivedValue, 0)).toBe(1000);
    expect(payload.total).toBe(2000);
  });

  // ---------------------------------------------------------------------------
  // 5. Removing all trade-ins clears the client refund configuration
  // ---------------------------------------------------------------------------
  it('clears client-refund state when every trade-in is removed before finalizing', async () => {
    const user = userEvent.setup();
    render(<PDV />);

    await selectSeller(user);
    await selectStore(user);
    await selectClient(user);
    await selectProduct(user);
    // Trade-in exceeds product → entering "loja paga cliente" flow.
    await addTradeIn(user, { purchasePrice: 5000 });
    await user.click(screen.getByRole('button', { name: /Avançar para pagamento/i }));
    // Operator changes their mind and removes the trade-in.
    await user.click(screen.getByRole('button', { name: /Voltar/i }));
    await user.click(screen.getByRole('button', { name: /Remover troca/i }));
    await user.click(screen.getByRole('button', { name: /Avançar para pagamento/i }));

    // RED: the screen must now ask the customer to pay R$ 3.000 instead of
    // still showing "Loja deve R$ 2.000 ao cliente".
    expect(screen.queryByText(/Loja deve/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pix' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Pix' }));
    const pixDialog = screen.getByRole('dialog');
    await user.click(within(pixDialog).getByRole('button', { name: 'Adicionar' }));
    await user.click(screen.getByRole('button', { name: 'Finalizar Venda' }));

    const payload = addSaleMock.mock.calls[0][0];
    expect(payload.clientPaymentAmount).toBeUndefined();
    expect(payload.clientPaymentMode).toBeUndefined();
    expect(payload.total).toBe(3000);
  });

  // ---------------------------------------------------------------------------
  // 6. Refunding the client via credit/debit card is not allowed
  // ---------------------------------------------------------------------------
  it('rejects refund-to-client via Cartão (credit/debit) when trade-in exceeds the sale', async () => {
    const user = userEvent.setup();
    render(<PDV />);

    await selectSeller(user);
    await selectStore(user);
    await selectClient(user);
    await selectProduct(user);
    await addTradeIn(user, { purchasePrice: 5000 });
    await user.click(screen.getByRole('button', { name: /Avançar para pagamento/i }));

    // RED: the refund-method picker should only expose Pix and Dinheiro.
    expect(screen.queryByRole('button', { name: /Cartão Crédito/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Cartão/i })).not.toBeInTheDocument();
  });

  // ---------------------------------------------------------------------------
  // 7. Receipt for a multi trade-in sale lists every received device
  // ---------------------------------------------------------------------------
  it('renders one receipt row per trade-in (model + IMEI + received value) on the 80mm receipt', async () => {
    const user = userEvent.setup();
    render(<PDV />);

    await selectSeller(user);
    await selectStore(user);
    await selectClient(user);
    await selectProduct(user);
    await addTradeIn(user, { id: 'trade-a', imei: 'IMEI-A', purchasePrice: 800, model: 'iPhone 11' });
    await addTradeIn(user, { id: 'trade-b', imei: 'IMEI-B', purchasePrice: 900, model: 'iPhone 12' });

    await user.click(screen.getByRole('button', { name: /Avançar para pagamento/i }));
    await user.click(screen.getByRole('button', { name: 'Pix' }));
    const pixDialog = screen.getByRole('dialog');
    await user.click(within(pixDialog).getByRole('button', { name: 'Adicionar' }));
    await user.click(screen.getByRole('button', { name: 'Finalizar Venda' }));

    await screen.findByText('Venda Realizada!');
    const receipt = document.getElementById('receipt-content-80mm');
    expect(receipt).not.toBeNull();
    expect(receipt!.textContent).toMatch(/iPhone 11/);
    expect(receipt!.textContent).toMatch(/IMEI-A/);
    expect(receipt!.textContent).toMatch(/iPhone 12/);
    expect(receipt!.textContent).toMatch(/IMEI-B/);
    // RED: each trade-in line should carry its own received value, not a single
    // collapsed subtotal that hides the per-device amount.
    expect(receipt!.textContent).toMatch(/R\$ 800,00/);
    expect(receipt!.textContent).toMatch(/R\$ 900,00/);
  });

  // ---------------------------------------------------------------------------
  // 8. Cart-side trade-in value uses BRL formatting with two decimals
  // ---------------------------------------------------------------------------
  it('formats the trade-in price in step 2 as Brazilian currency with two decimals', async () => {
    const user = userEvent.setup();
    render(<PDV />);

    await selectSeller(user);
    await selectStore(user);
    await selectClient(user);
    await selectProduct(user);
    await addTradeIn(user, { purchasePrice: 1234.5 });

    // RED: today `purchasePrice.toLocaleString('pt-BR')` outputs "1.234,5".
    // We want consistent "1.234,50" so receipts and screen never disagree.
    const tradeInCard = screen.getByLabelText(/Remover troca/i).closest('div');
    expect(tradeInCard?.textContent).toMatch(/R\$\s*1\.234,50/);
  });

  // ---------------------------------------------------------------------------
  // 9. Persisted Sale never carries the legacy single-trade-in field
  // ---------------------------------------------------------------------------
  it('does not include the legacy `tradeIn` snapshot in the persisted sale when `tradeIns` is non-empty', async () => {
    const user = userEvent.setup();
    render(<PDV />);

    await selectSeller(user);
    await selectStore(user);
    await selectClient(user);
    await selectProduct(user);
    await addTradeIn(user, { id: 'trade-x', imei: 'IMEI-X', purchasePrice: 1000 });

    await user.click(screen.getByRole('button', { name: /Avançar para pagamento/i }));
    await user.click(screen.getByRole('button', { name: 'Pix' }));
    const pixDialog = screen.getByRole('dialog');
    await user.click(within(pixDialog).getByRole('button', { name: 'Adicionar' }));
    await user.click(screen.getByRole('button', { name: 'Finalizar Venda' }));

    const payload = addSaleMock.mock.calls[0][0];
    expect(payload.tradeIn).toBeUndefined();
    expect(payload.tradeIns).toHaveLength(1);
    // RED-leaning: persisted tradeIns row must carry the stockSnapshot so the
    // financial trigger can move the received device into inventory.
    expect(payload.tradeIns[0].stockSnapshot).toBeDefined();
    expect(payload.tradeIns[0].stockSnapshot.imei).toBe('IMEI-X');
  });

  // ---------------------------------------------------------------------------
  // 10. Empty/whitespace IMEI on a trade-in is rejected at PDV level
  // ---------------------------------------------------------------------------
  it('rejects trade-ins without an IMEI/Serial number', async () => {
    const user = userEvent.setup();
    render(<PDV />);

    await selectSeller(user);
    await selectStore(user);
    await selectClient(user);
    await user.click(screen.getByRole('button', { name: /2\. Produtos/i }));
    await addTradeIn(user, { imei: '   ', purchasePrice: 1000 });

    expect(toastErrorMock.mock.calls.some(([message]) => /IMEI|Serial/i.test(String(message)))).toBe(true);
    expect(screen.queryByText(/Subtotal das entradas/)).not.toBeInTheDocument();
  });

  it('lets the operator continue adding a trade-in after the missing IMEI/Serial warning', async () => {
    const user = userEvent.setup();
    render(<PDV />);

    await selectSeller(user);
    await selectStore(user);
    await selectClient(user);
    await selectProduct(user);
    await addTradeIn(user, { imei: '   ', purchasePrice: 1000 });

    expect(toastErrorMock).toHaveBeenCalledWith(
      expect.stringMatching(/IMEI|Serial/i),
      expect.objectContaining({
        action: expect.objectContaining({
          label: expect.stringMatching(/continuar/i),
        }),
      })
    );
    expect(screen.queryByText(/Subtotal das entradas/)).not.toBeInTheDocument();

    const [, opts] = toastErrorMock.mock.calls.find(([message]) =>
      /IMEI|Serial/i.test(String(message))
    ) || [];
    await act(async () => {
      opts.action.onClick();
    });

    expect(screen.getByText(/Subtotal das entradas/)).toBeInTheDocument();
    expect(screen.getByText(/iPhone Trade/)).toBeInTheDocument();
  }, LEGACY_PDV_FLOW_TIMEOUT_MS);

  // ---------------------------------------------------------------------------
  // 11. clientOwedAmount precision with mixed centavo trade-ins
  // ---------------------------------------------------------------------------
  it('rounds the client-owed amount to 2 decimals when trade-ins exceed the sale by a fractional value', async () => {
    const user = userEvent.setup();
    render(<PDV />);

    await selectSeller(user);
    await selectStore(user);
    await selectClient(user);
    await selectProduct(user);
    // Trade-in slightly above 3000 by R$ 0.07.
    await addTradeIn(user, { id: 'trade-1', imei: 'IMEI-1', purchasePrice: 1500.05 });
    await addTradeIn(user, { id: 'trade-2', imei: 'IMEI-2', purchasePrice: 1500.02 });

    await user.click(screen.getByRole('button', { name: /Avançar para pagamento/i }));
    await user.click(screen.getByRole('button', { name: 'Finalizar Venda' }));

    const payload = addSaleMock.mock.calls[0][0];
    expect(payload.total).toBe(0);
    // 3000.07 - 3000 = 0.07 exactly — no 0.07000000000000028.
    expect(payload.clientPaymentAmount).toBe(0.07);
    expect(payload.tradeInValue).toBe(3000.07);
  });
});
