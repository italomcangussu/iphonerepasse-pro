import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Condition, DeviceType, StockStatus, WarrantyType, type StockItem } from '../types';
import { StockDetailsModal } from './StockDetailsModal';

const toastMock = {
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
};

vi.mock('./ui/ToastProvider', () => ({
  useToast: () => toastMock,
}));

const stockItem: StockItem = {
  id: 'stock-1',
  type: DeviceType.IPHONE,
  model: 'iPhone 17 Pro Max',
  capacity: '512GB',
  color: 'Azul',
  imei: '123456789012345',
  condition: Condition.NEW,
  status: StockStatus.AVAILABLE,
  storeId: 'store-1',
  purchasePrice: 8000,
  sellPrice: 9950,
  maxDiscount: 0,
  warrantyType: WarrantyType.STORE,
  costs: [],
  photos: [],
  entryDate: '2026-06-03',
};

describe('StockDetailsModal simulator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.open = vi.fn();
  });

  it('opens the simulator with the current stock item preselected', async () => {
    const user = userEvent.setup({ writeToClipboard: false });

    render(
      <StockDetailsModal
        open
        onClose={vi.fn()}
        item={stockItem}
        storeName="Sobral"
        simulatorTradeInValues={[
          {
            id: 'value-1',
            model: 'iPhone 15 Pro Max',
            capacity: '256GB',
            baseValue: 4100,
            isActive: true,
            createdAt: '2026-06-03T12:00:00.000Z',
            updatedAt: '2026-06-03T12:00:00.000Z',
          },
        ]}
        simulatorTradeInAdjustments={[
          {
            id: 'adj-1',
            label: 'Marcas de uso',
            model: 'iPhone 15 Pro Max',
            capacity: null,
            amountDelta: -500,
            isActive: true,
            createdAt: '2026-06-03T12:00:00.000Z',
            updatedAt: '2026-06-03T12:00:00.000Z',
          },
        ]}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Simulador' }));

    expect(screen.getByRole('heading', { name: 'Simulador' })).toBeInTheDocument();
    expect(screen.getAllByText('iPhone 17 Pro Max 512GB Azul').length).toBeGreaterThan(0);
  });

  it('renders reservation details with responsible seller', () => {
    const reservedItem: StockItem = {
      ...stockItem,
      status: StockStatus.RESERVED,
      reservation: {
        id: 'res-1',
        stockItemId: 'stock-1',
        customerName: 'FRANCISCO CLEBER DO NASCIMENTO FLORENCIO',
        customerPhone: '(88) 99703-7275',
        reservedAt: '2026-08-21T15:59:53.372Z',
        expiresAt: '2026-08-26T00:00:00.000Z',
        depositAmount: 250,
        depositPaymentMethod: 'Pix',
        sellerId: 'sel-1',
        notes: 'CLIENTE RETORNA QUARTA',
        status: 'active',
        createdAt: '2026-08-21T15:59:53.372Z',
        updatedAt: '2026-08-21T15:59:53.372Z'
      }
    };

    const sellers = [
      { id: 'sel-1', name: 'Kauan Lean', email: 'kauan@teste.com', authUserId: 'u-1', storeId: 'store-1', totalSales: 0 }
    ];

    render(
      <StockDetailsModal
        open
        onClose={vi.fn()}
        item={reservedItem}
        storeName="Sobral"
        sellers={sellers}
      />
    );

    expect(screen.getByText('FRANCISCO CLEBER DO NASCIMENTO FLORENCIO')).toBeInTheDocument();
    expect(screen.getByText('Responsável:')).toBeInTheDocument();
    expect(screen.getByText('Kauan Lean')).toBeInTheDocument();
    expect(screen.getByText('Pix')).toBeInTheDocument();
  });
});
