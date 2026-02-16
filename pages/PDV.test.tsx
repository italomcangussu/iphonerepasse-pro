import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Condition, DeviceType, StockStatus, WarrantyType } from '../types';
import PDV from './PDV';

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

vi.mock('../components/AddCustomerModal', () => ({
  AddCustomerModal: () => null
}));

vi.mock('../components/AddSellerModal', () => ({
  AddSellerModal: () => null
}));

vi.mock('../components/StockFormModal', () => ({
  StockFormModal: () => null
}));

describe('PDV page integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    addSaleMock.mockResolvedValue(undefined);
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
      addSale: addSaleMock,
      businessProfile: { name: 'Loja Teste' }
    });
  });

  it('renders updated payment methods in PDV', () => {
    render(<PDV />);

    expect(screen.getByRole('button', { name: 'Pix' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dinheiro' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cartão' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Devedor' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cartão Crédito' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cartão Débito' })).not.toBeInTheDocument();
  });

  it('opens debtor modal, captures metadata and adds debtor payment entry', async () => {
    const user = userEvent.setup();
    render(<PDV />);

    await user.click(screen.getByRole('button', { name: 'Buscar Vendedor...' }));
    await user.click(screen.getByText('Vendedor Teste'));

    await user.click(screen.getByRole('button', { name: 'Buscar Cliente...' }));
    await user.click(screen.getByText('Cliente Teste'));

    await user.click(screen.getByRole('button', { name: /iPhone 14 Test/ }));
    await user.click(screen.getByRole('button', { name: 'Devedor' }));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Configurar Devedor')).toBeInTheDocument();

    const dateInput = dialog.querySelector('input[type="date"]') as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: '2026-03-10' } });
    await user.type(within(dialog).getByPlaceholderText('Ex: parcela mensal todo dia 10'), 'Pagamento em 2 parcelas');
    expect(within(dialog).getByDisplayValue('Pagamento em 2 parcelas')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Confirmar' }));

    expect(screen.getAllByText('Devedor').length).toBeGreaterThan(0);
    expect(screen.getByText(/Venc\.:/)).toBeInTheDocument();
  });

  it('requires customer before selecting debtor payment', async () => {
    const user = userEvent.setup();
    render(<PDV />);

    await user.click(screen.getByRole('button', { name: 'Buscar Vendedor...' }));
    await user.click(screen.getByText('Vendedor Teste'));
    await user.click(screen.getByRole('button', { name: /iPhone 14 Test/ }));
    await user.click(screen.getByRole('button', { name: 'Devedor' }));

    expect(toastErrorMock).toHaveBeenCalledWith('Selecione um cliente antes de usar Devedor.');
    expect(screen.queryByText('Configurar Devedor')).not.toBeInTheDocument();
  });

  it('finalizes sale and sends debtor metadata in addSale payload', async () => {
    const user = userEvent.setup();
    render(<PDV />);

    await user.click(screen.getByRole('button', { name: 'Buscar Vendedor...' }));
    await user.click(screen.getByText('Vendedor Teste'));

    await user.click(screen.getByRole('button', { name: 'Buscar Cliente...' }));
    await user.click(screen.getByText('Cliente Teste'));

    await user.click(screen.getByRole('button', { name: /iPhone 14 Test/ }));
    await user.click(screen.getByRole('button', { name: 'Devedor' }));

    const debtDialog = screen.getByRole('dialog');
    const dateInput = debtDialog.querySelector('input[type="date"]') as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: '2026-03-15' } });
    await user.type(within(debtDialog).getByPlaceholderText('Ex: parcela mensal todo dia 10'), 'Primeira cobrança em março');
    await user.click(within(debtDialog).getByRole('button', { name: 'Confirmar' }));

    await user.click(screen.getByRole('button', { name: 'Finalizar Venda' }));

    expect(addSaleMock).toHaveBeenCalledTimes(1);
    const payload = addSaleMock.mock.calls[0][0];

    expect(payload.customerId).toBe('cust-1');
    expect(payload.sellerId).toBe('sel-1');
    expect(payload.total).toBe(3000);
    expect(payload.tradeIn).toBeUndefined();
    expect(payload.paymentMethods).toEqual([
      {
        type: 'Devedor',
        amount: 3000,
        debtDueDate: '2026-03-15',
        debtNotes: 'Primeira cobrança em março'
      }
    ]);

    const saleDate = new Date(payload.date);
    const warrantyDate = new Date(payload.warrantyExpiresAt);
    const expectedWarranty = new Date(saleDate);
    expectedWarranty.setMonth(expectedWarranty.getMonth() + 3);

    expect(warrantyDate.getTime()).toBeGreaterThan(saleDate.getTime());
    expect(Math.abs(warrantyDate.getTime() - expectedWarranty.getTime())).toBeLessThan(60_000);

    expect(await screen.findByText('Venda Realizada!')).toBeInTheDocument();
    expect(toastSuccessMock).toHaveBeenCalledWith('Venda registrada.');
  });
});
