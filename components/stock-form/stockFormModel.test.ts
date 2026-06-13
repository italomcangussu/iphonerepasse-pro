import { describe, expect, it } from 'vitest';
import { Condition, DeviceType, StockStatus, WarrantyType, type StockItem, type StoreLocation } from '../../types';
import { buildStockItemPayload, clampBatteryHealth, createInitialStockFormState } from './stockFormModel';

const stores: StoreLocation[] = [{ id: 'store-1', name: 'Matriz', city: 'Fortaleza' }];

describe('stock form model', () => {
  it('creates defaults and restores observations from legacy notes', () => {
    const initialData = {
      id: 'stk-1',
      type: DeviceType.IPHONE,
      model: 'iPhone 15',
      color: 'Preto',
      capacity: '128 GB',
      imei: '111',
      condition: Condition.USED,
      status: StockStatus.AVAILABLE,
      storeId: 'store-1',
      purchasePrice: 3000,
      sellPrice: 4200,
      maxDiscount: 0,
      warrantyType: WarrantyType.STORE,
      notes: 'Trocar tela',
      costs: [],
      photos: [],
      entryDate: '2026-04-17T00:00:00.000Z'
    } satisfies StockItem;

    expect(createInitialStockFormState(stores)).toMatchObject({
      type: DeviceType.IPHONE,
      condition: Condition.USED,
      storeId: 'store-1',
      batteryHealth: 100
    });
    expect(createInitialStockFormState(stores, initialData).observations).toBe('Trocar tela');
  });

  it('clamps battery and creates edit/create payloads without changing field semantics', () => {
    expect(clampBatteryHealth(-5)).toBe(0);
    expect(clampBatteryHealth(87.6)).toBe(88);
    expect(clampBatteryHealth(150)).toBe(100);

    const payload = buildStockItemPayload({
      formData: {
        type: DeviceType.WATCH,
        model: 'Apple Watch',
        condition: Condition.NEW,
        sellPrice: '4200' as unknown as number,
        purchasePrice: '3000' as unknown as number,
        maxDiscount: '50' as unknown as number,
        observations: '',
        notes: 'legacy',
        photos: ['https://cdn/photo.jpg']
      },
      statusOverride: StockStatus.PREPARATION,
      stores,
      supportsCapacity: false,
      now: new Date('2026-06-13T12:00:00.000Z'),
      createId: () => 'stk-created'
    });

    expect(payload).toMatchObject({
      id: 'stk-created',
      type: DeviceType.WATCH,
      model: 'Apple Watch',
      capacity: '',
      condition: Condition.NEW,
      status: StockStatus.PREPARATION,
      batteryHealth: undefined,
      storeId: 'store-1',
      purchasePrice: 3000,
      sellPrice: 4200,
      maxDiscount: 50,
      notes: '',
      observations: '',
      photos: ['https://cdn/photo.jpg'],
      entryDate: '2026-06-13T12:00:00.000Z'
    });
  });
});
