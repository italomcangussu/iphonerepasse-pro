import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import DevicesSoldAnalytics from './DevicesSoldAnalytics';
import { Condition, DeviceType, StockStatus, WarrantyType, type Sale, type StockItem } from '../types';

const useDataMock = vi.fn();

vi.mock('../services/dataContext', () => ({
  useData: () => useDataMock(),
}));

const makeStockItem = (id: string, model: string, condition: Condition): StockItem => ({
  id,
  type: DeviceType.IPHONE,
  model,
  color: 'Preto',
  capacity: '128GB',
  imei: id,
  condition,
  status: StockStatus.SOLD,
  storeId: 'store-1',
  purchasePrice: 1000,
  sellPrice: 2000,
  maxDiscount: 0,
  warrantyType: WarrantyType.STORE,
  costs: [],
  photos: [],
  entryDate: '2026-01-01T00:00:00.000Z',
});

const makeSale = (id: string, date: string, items: StockItem[]): Sale => ({
  id,
  customerId: 'customer-1',
  sellerId: 'seller-1',
  items,
  tradeInValue: 0,
  discount: 0,
  total: items.reduce((sum, item) => sum + item.sellPrice, 0),
  paymentMethods: [],
  date,
  warrantyExpiresAt: null,
});

describe('DevicesSoldAnalytics', () => {
  it('filters sold devices by custom start and end dates', async () => {
    const user = userEvent.setup();
    useDataMock.mockReturnValue({
      sales: [
        makeSale('sale-before', '2026-04-10T12:00:00.000Z', [
          makeStockItem('iphone-11', 'iPhone 11', Condition.USED),
        ]),
        makeSale('sale-inside', '2026-04-20T12:00:00.000Z', [
          makeStockItem('iphone-12', 'iPhone 12', Condition.USED),
        ]),
        makeSale('sale-after', '2026-05-01T12:00:00.000Z', [
          makeStockItem('iphone-13', 'iPhone 13', Condition.NEW),
        ]),
      ],
    });

    render(<DevicesSoldAnalytics />);

    await user.selectOptions(screen.getByLabelText('Período'), 'all');
    await user.type(screen.getByLabelText('Data inicial'), '2026-04-15');
    await user.type(screen.getByLabelText('Data final'), '2026-04-30');

    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('Aparelho vendido')).toBeInTheDocument();
  });
});
