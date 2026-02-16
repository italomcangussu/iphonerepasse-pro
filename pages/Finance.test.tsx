import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Finance from './Finance';
import { Condition, DeviceType, StockStatus, WarrantyType } from '../types';

const useDataMock = vi.fn();
const toastErrorMock = vi.fn();
const toastSuccessMock = vi.fn();

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

describe('Finance page resilience', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
      addTransaction: vi.fn()
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
});
