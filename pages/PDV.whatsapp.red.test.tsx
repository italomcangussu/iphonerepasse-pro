/**
 * RED TESTS (TDD) — Sending the WhatsApp receipt from the PDV success screen.
 *
 * Today's "Enviar via WhatsApp" button delegates to `sendReceiptWhatsApp`
 * without UX safeguards: it is clickable even when the customer has no
 * phone (the toast fires only after the click), it does not surface the
 * exact phone that will be used, and it does not protect against a flurry
 * of clicks while the upload is in-flight. These tests describe how the
 * button should behave and are expected to fail until the PDV is fixed.
 */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Condition, DeviceType, StockStatus, WarrantyType } from '../types';
import PDV from './PDV';

const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();
const useDataMock = vi.fn();
const useAuthMock = vi.fn();
const addSaleMock = vi.fn();

const { sendReceiptWhatsAppMock } = vi.hoisted(() => ({
  sendReceiptWhatsAppMock: vi.fn()
}));

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
vi.mock('../components/StockFormModal', () => ({
  StockFormModal: ({ open, onSave }: { open: boolean; onSave?: (item: any) => void }) =>
    open ? (
      <button
        type="button"
        onClick={() =>
          onSave?.({
            id: `trade-${Math.random()}`,
            type: DeviceType.IPHONE,
            model: 'iPhone 11 Trade',
            color: 'Azul',
            capacity: '128 GB',
            imei: `trade-imei-${Math.random()}`,
            condition: Condition.USED,
            status: StockStatus.PREPARATION,
            storeId: 'store-1',
            purchasePrice: 800,
            sellPrice: 0,
            maxDiscount: 0,
            warrantyType: WarrantyType.STORE,
            costs: [],
            photos: [],
            entryDate: '2026-02-20'
          })
        }
      >
        Salvar trade-in mock
      </button>
    ) : null
}));

vi.mock('../utils/sendReceiptWhatsApp', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/sendReceiptWhatsApp')>();
  return {
    ...actual,
    sendReceiptWhatsApp: sendReceiptWhatsAppMock
  };
});

const dataContext = (overrides: { customerPhone?: string } = {}) => ({
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
      phone: overrides.customerPhone === undefined ? '(85) 99999-0000' : overrides.customerPhone,
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
  stores: [{ id: 'store-1', name: 'Loja Centro', city: 'Fortaleza' }],
  addSale: addSaleMock,
  businessProfile: { name: 'Loja Teste' },
  cardFeeSettings: {
    visaMasterRates: Array(18).fill(2.99),
    otherRates: Array(18).fill(3.99),
    debitRate: 1.87
  }
});

const drive = async (user: ReturnType<typeof userEvent.setup>, withTradeIn = false) => {
  render(<PDV />);
  await user.click(screen.getByRole('combobox', { name: 'Vendedor' }));
  await user.click(screen.getByText('Vendedor Teste'));
  await user.click(screen.getByRole('combobox', { name: 'Loja' }));
  await user.click(screen.getByText('Loja Centro'));
  await user.click(screen.getByRole('combobox', { name: 'Cliente' }));
  await user.click(screen.getByText('Cliente Teste'));
  if (!screen.queryByRole('combobox', { name: 'Produto' })) {
    await user.click(screen.getByRole('button', { name: '2. Produto/Troca' }));
  }
  await user.click(screen.getByRole('combobox', { name: 'Produto' }));
  await user.type(screen.getByPlaceholderText('Digite modelo, IMEI/Serial ou cor...'), 'iPhone');
  await user.click(screen.getByText(/iPhone 14 Test/));
  await user.click(screen.getByRole('button', { name: 'Adicionar ao carrinho' }));
  if (withTradeIn) {
    await user.click(screen.getByRole('button', { name: '+ Adicionar' }));
    await user.click(screen.getByRole('button', { name: 'Salvar trade-in mock' }));
  }
  await user.click(screen.getByRole('button', { name: /Avançar para pagamento/i }));
  await user.click(screen.getByRole('button', { name: 'Pix' }));
  const pixDialog = screen.getByRole('dialog');
  await user.click(within(pixDialog).getByRole('button', { name: 'Adicionar' }));
  await user.click(screen.getByRole('button', { name: 'Finalizar Venda' }));
  await screen.findByText('Venda Realizada!');
};

describe('PDV success screen — WhatsApp receipt RED tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    addSaleMock.mockResolvedValue(undefined);
    sendReceiptWhatsAppMock.mockResolvedValue(undefined);
    useAuthMock.mockReturnValue({ role: 'admin' });
    useDataMock.mockReturnValue(dataContext());
  });

  // ---------------------------------------------------------------------------
  // 1. Customer has no phone → button disabled (not just toast on click)
  // ---------------------------------------------------------------------------
  it('disables the WhatsApp button when the customer has no phone', async () => {
    useDataMock.mockReturnValue(dataContext({ customerPhone: '' }));
    const user = userEvent.setup();
    await drive(user);

    const button = screen.getByRole('button', { name: /Enviar via WhatsApp/i });
    // RED: today the button is enabled and the toast only fires after the
    // click. We want a clear disabled state with tooltip-grade affordance.
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription(/sem telefone/i);

    await user.click(button);
    expect(sendReceiptWhatsAppMock).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // 2. Concurrent clicks must not fire twice
  // ---------------------------------------------------------------------------
  it('does not invoke sendReceiptWhatsApp twice on rapid double-click', async () => {
    let resolveSend: () => void = () => {};
    sendReceiptWhatsAppMock.mockImplementation(
      () => new Promise<void>((resolve) => (resolveSend = resolve))
    );

    const user = userEvent.setup();
    await drive(user);

    const button = screen.getByRole('button', { name: /Enviar via WhatsApp/i });
    await user.click(button);
    // Second click while the first invocation is still pending — should be a
    // no-op (the button must be disabled while loading).
    await user.click(button);

    resolveSend();
    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith(
        expect.stringMatching(/Comprovante.*WhatsApp/i)
      );
    });
    expect(sendReceiptWhatsAppMock).toHaveBeenCalledTimes(1);
  });

  // ---------------------------------------------------------------------------
  // 3. Normalised phone is passed to the utility
  // ---------------------------------------------------------------------------
  it('passes the digits-only normalised phone to sendReceiptWhatsApp', async () => {
    const user = userEvent.setup();
    await drive(user);

    await user.click(screen.getByRole('button', { name: /Enviar via WhatsApp/i }));

    await waitFor(() => {
      expect(sendReceiptWhatsAppMock).toHaveBeenCalledWith(
        expect.objectContaining({ phone: '5585999990000' })
      );
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Error surfaces the underlying message
  // ---------------------------------------------------------------------------
  it('shows the specific error returned by sendReceiptWhatsApp', async () => {
    sendReceiptWhatsAppMock.mockRejectedValue(new Error('UAZ instance offline'));
    const user = userEvent.setup();
    await drive(user);

    await user.click(screen.getByRole('button', { name: /Enviar via WhatsApp/i }));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith('UAZ instance offline');
    });
    // The button should be re-enabled after an error so the seller can retry.
    expect(screen.getByRole('button', { name: /Enviar via WhatsApp/i })).toBeEnabled();
  });

  // ---------------------------------------------------------------------------
  // 5. Receipt with trade-in lists trade-in details before sending
  // ---------------------------------------------------------------------------
  it('sends a receipt whose A4 DOM contains every trade-in row that backed the sale', async () => {
    const user = userEvent.setup();
    await drive(user, true);

    const receipt = document.getElementById('receipt-content-a4');
    expect(receipt).not.toBeNull();

    await user.click(screen.getByRole('button', { name: /Enviar via WhatsApp/i }));

    await waitFor(() => {
      expect(sendReceiptWhatsAppMock).toHaveBeenCalled();
    });

    // RED: the success state must render the A4 receipt with trade-in detail
    // *before* the WhatsApp send fires (the PDF is generated from this DOM).
    const a4Text = receipt!.textContent || '';
    expect(a4Text).toMatch(/iPhone 11 Trade/);
    expect(a4Text).toMatch(/R\$\s*800,00/);

    expect(sendReceiptWhatsAppMock).toHaveBeenCalledWith(
      expect.objectContaining({
        elementId: 'receipt-content-a4',
        saleId: expect.any(String),
        storeId: 'store-1',
        customerName: 'Cliente Teste'
      })
    );
  });

  // ---------------------------------------------------------------------------
  // 6. Success toast must mention the channel/phone for accountability
  // ---------------------------------------------------------------------------
  it('confirms the destination phone in the success toast', async () => {
    const user = userEvent.setup();
    await drive(user);

    await user.click(screen.getByRole('button', { name: /Enviar via WhatsApp/i }));

    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith(
        expect.stringMatching(/Comprovante.*WhatsApp.*\(85\)\s*99999-0000/)
      );
    });
  });
});
