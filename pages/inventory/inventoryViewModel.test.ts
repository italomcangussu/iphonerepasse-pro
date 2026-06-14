import { describe, expect, it } from 'vitest';
import { Condition, DeviceType, StockStatus, WarrantyType, type StockItem, type StoreLocation } from '../../types';
import {
  buildStockShareText,
  compareStockItemsForDisplay,
  getReservationSummary,
  isReservationExpired,
  parseCapacityToGb,
  selectInventoryRows
} from './inventoryViewModel';

const stores: StoreLocation[] = [
  { id: 'store-1', name: 'Matriz Fortaleza', city: 'Fortaleza' },
  { id: 'store-2', name: 'Matriz Sobral', city: 'Sobral' }
];

const stockItem = (overrides: Partial<StockItem> = {}): StockItem => ({
  id: overrides.id || 'stock-1',
  type: DeviceType.IPHONE,
  model: overrides.model || 'iPhone 15',
  color: overrides.color || 'Preto',
  hasBox: true,
  capacity: overrides.capacity || '128 GB',
  imei: overrides.imei || '111111111111111',
  condition: overrides.condition || Condition.USED,
  status: overrides.status || StockStatus.AVAILABLE,
  batteryHealth: overrides.batteryHealth,
  storeId: overrides.storeId || 'store-1',
  purchasePrice: overrides.purchasePrice ?? 3000,
  sellPrice: overrides.sellPrice ?? 3900,
  maxDiscount: 0,
  warrantyType: WarrantyType.STORE,
  warrantyEnd: '',
  origin: '',
  notes: '',
  observations: '',
  costs: [],
  photos: [],
  entryDate: overrides.entryDate || '2026-02-01',
  ...overrides
});

describe('inventory view model', () => {
  it('parses capacities and orders by model, capacity, battery and entry date', () => {
    expect(parseCapacityToGb('1 TB')).toBe(1024);
    expect(parseCapacityToGb('512 GB')).toBe(512);
    expect(parseCapacityToGb('')).toBe(0);

    const ordered = [
      stockItem({ id: '128', model: 'iPhone 15', capacity: '128 GB', batteryHealth: 99, entryDate: '2026-02-05' }),
      stockItem({ id: '256-low', model: 'iPhone 15', capacity: '256 GB', batteryHealth: 86, entryDate: '2026-02-06' }),
      stockItem({ id: '256-high', model: 'iPhone 15', capacity: '256 GB', batteryHealth: 93, entryDate: '2026-02-05' }),
      stockItem({ id: '16', model: 'iPhone 16', capacity: '128 GB', condition: Condition.NEW, entryDate: '2026-02-01' })
    ].sort(compareStockItemsForDisplay);

    expect(ordered.map((item) => item.id)).toEqual(['16', '256-high', '256-low', '128']);
  });

  it('filters by status, condition, city store and product search', () => {
    const rows = selectInventoryRows({
      stock: [
        stockItem({ id: 'fortaleza-used', model: 'iPhone 14', storeId: 'store-1', condition: Condition.USED }),
        stockItem({ id: 'fortaleza-new', model: 'iPhone 14', storeId: 'store-1', condition: Condition.NEW }),
        stockItem({ id: 'sobral-used', model: 'iPhone 14 Pro', storeId: 'store-2', condition: Condition.USED }),
        stockItem({ id: 'sold', model: 'iPhone 14', status: StockStatus.SOLD, storeId: 'store-1', condition: Condition.USED })
      ],
      search: '14',
      statuses: [StockStatus.AVAILABLE],
      condition: Condition.USED,
      storeId: 'city:fortaleza',
      stores,
      now: new Date('2026-06-13T12:00:00.000Z')
    });

    expect(rows.map((item) => item.id)).toEqual(['fortaleza-used']);
  });

  it('ignores condition for preparation views and preserves exact generation search ranking', () => {
    const rows = selectInventoryRows({
      stock: [
        stockItem({ id: '13-pro-max', model: 'iPhone 13 Pro Max', status: StockStatus.PREPARATION }),
        stockItem({ id: '13-pro', model: 'iPhone 13 Pro', status: StockStatus.PREPARATION }),
        stockItem({ id: '13', model: 'iPhone 13', status: StockStatus.PREPARATION, condition: Condition.NEW }),
        stockItem({ id: '14-imei', model: 'iPhone 14', status: StockStatus.PREPARATION, imei: '001300000000000' })
      ],
      search: '13',
      statuses: [StockStatus.PREPARATION],
      condition: Condition.USED,
      storeId: 'all',
      stores,
      ignoreCondition: true,
      now: new Date('2026-06-13T12:00:00.000Z')
    });

    expect(rows.map((item) => item.id)).toEqual(['13', '13-pro', '13-pro-max']);
  });

  it('formats share text with sorted groups and card installment values', () => {
    const text = buildStockShareText([
      stockItem({ id: 'used', model: 'iPhone 14', condition: Condition.USED, batteryHealth: 85, sellPrice: 3500 }),
      stockItem({ id: 'new', model: 'iPhone 16', condition: Condition.NEW, batteryHealth: 100, sellPrice: 6700 })
    ], 'whatsapp', { installments: 2, feeRate: 4.09 });

    expect(text).toContain('*📱 LISTA DE ESTOQUE*');
    expect(text).toContain('🆕 *NOVOS*');
    expect(text).toContain('iPhone 16');
    expect(text).toContain('♻️ *SEMINOVOS*');
    expect(text).toContain('iPhone 14');
    expect(text).toContain('2x de');
  });

  it('truncates Instagram share text and keeps reservation dates deterministic', () => {
    const manyItems = Array.from({ length: 80 }, (_, index) => stockItem({
      id: `item-${index}`,
      model: `iPhone ${16 - (index % 4)}`,
      condition: index % 2 === 0 ? Condition.NEW : Condition.USED
    }));
    const instagramText = buildStockShareText(manyItems, 'instagram');
    expect(instagramText.length).toBeLessThanOrEqual(1000);
    expect(instagramText).toContain('...');

    const reserved = stockItem({
      status: StockStatus.RESERVED,
      reservation: {
        id: 'res-1',
        stockItemId: 'stock-1',
        customerName: 'Cliente Reserva',
        customerPhone: '88999990000',
        reservedAt: '2026-06-01T12:00:00.000Z',
        expiresAt: '2026-06-02T00:00:00.000Z',
        depositAmount: null,
        depositPaymentMethod: null,
        notes: null,
        status: 'active',
        releasedAt: null,
        soldAt: null,
        createdAt: '2026-06-01T12:00:00.000Z',
        updatedAt: '2026-06-01T12:00:00.000Z'
      }
    });

    expect(isReservationExpired(reserved, new Date('2026-06-13T12:00:00.000Z'))).toBe(true);
    expect(getReservationSummary(reserved)).toContain('Cliente Reserva');
  });
});
