import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Condition, DeviceType, StockStatus, WarrantyType } from '../types';
import InUse from './InUse';

const useDataMock = vi.fn();
const toastMock = {
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  confirm: vi.fn(),
  dismiss: vi.fn(),
  clear: vi.fn()
};

vi.mock('../services/dataContext', () => ({
  useData: () => useDataMock()
}));

vi.mock('../components/ui/ToastProvider', () => ({
  useToast: () => toastMock
}));

describe('InUse', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useDataMock.mockReturnValue({
      stock: [
        {
          id: 'stk-in-use',
          type: DeviceType.IPHONE,
          model: 'iPhone 15 Interno',
          color: 'Preto',
          hasBox: false,
          capacity: '128 GB',
          imei: '151515151515151',
          condition: Condition.USED,
          status: StockStatus.IN_USE,
          batteryHealth: 90,
          storeId: 'store-1',
          purchasePrice: 3000,
          sellPrice: 4200,
          maxDiscount: 0,
          warrantyType: WarrantyType.STORE,
          warrantyEnd: '',
          origin: '',
          notes: '',
          observations: '',
          costs: [],
          photos: [],
          entryDate: '2026-04-17T00:00:00.000Z'
        },
        {
          id: 'stk-available',
          type: DeviceType.IPHONE,
          model: 'iPhone 16 Venda',
          color: 'Branco',
          hasBox: true,
          capacity: '256 GB',
          imei: '161616161616161',
          condition: Condition.NEW,
          status: StockStatus.AVAILABLE,
          batteryHealth: 100,
          storeId: 'store-1',
          purchasePrice: 5500,
          sellPrice: 6700,
          maxDiscount: 0,
          warrantyType: WarrantyType.STORE,
          warrantyEnd: '',
          origin: '',
          notes: '',
          observations: '',
          costs: [],
          photos: [],
          entryDate: '2026-04-17T00:00:00.000Z'
        }
      ],
      updateStockItem: vi.fn().mockResolvedValue(undefined),
      stores: [{ id: 'store-1', name: 'Matriz Fortaleza', city: 'Fortaleza' }]
    });
  });

  it('lists only internal-use devices and returns one to available stock', async () => {
    const user = userEvent.setup();
    render(<InUse />);

    expect(screen.getByRole('heading', { name: 'Em Uso' })).toBeInTheDocument();
    expect(screen.getByText('iPhone 15 Interno')).toBeInTheDocument();
    expect(screen.queryByText('iPhone 16 Venda')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /iPhone 15 Interno/i }));
    await user.click(screen.getByRole('button', { name: 'Devolver ao estoque' }));
    await user.click(screen.getByRole('button', { name: 'Disponível para venda' }));

    await waitFor(() => {
      expect(useDataMock().updateStockItem).toHaveBeenCalledWith('stk-in-use', { status: StockStatus.AVAILABLE });
    });
    expect(toastMock.success).toHaveBeenCalledWith('Aparelho devolvido para venda.');
  });

  it('returns an internal-use device to preparation', async () => {
    const user = userEvent.setup();
    render(<InUse />);

    await user.click(screen.getByRole('button', { name: /iPhone 15 Interno/i }));
    await user.click(screen.getByRole('button', { name: 'Devolver ao estoque' }));
    await user.click(screen.getByRole('button', { name: 'Em preparação' }));

    await waitFor(() => {
      expect(useDataMock().updateStockItem).toHaveBeenCalledWith('stk-in-use', { status: StockStatus.PREPARATION });
    });
    expect(toastMock.success).toHaveBeenCalledWith('Aparelho devolvido para preparação.');
  });
});
