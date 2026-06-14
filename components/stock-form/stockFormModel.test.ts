import { describe, expect, it } from 'vitest';
import { Condition, DeviceType, StockStatus, WarrantyType, type StockItem, type StoreLocation } from '../../types';
import {
  buildStockItemPayload,
  clampBatteryHealth,
  createDefaultStockFormState,
  createInitialStockFormState
} from './stockFormModel';

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

  it('keeps every default form field explicit for controlled inputs', () => {
    expect(createDefaultStockFormState(stores)).toEqual({
      type: DeviceType.IPHONE,
      condition: Condition.USED,
      status: StockStatus.AVAILABLE,
      simType: 'Physical',
      storeId: 'store-1',
      batteryHealth: 100,
      warrantyType: WarrantyType.STORE,
      costs: [],
      photos: [],
      origin: '',
      notes: '',
      observations: '',
      hasBox: false,
      purchasePrice: 0,
      maxDiscount: 0,
      model: '',
      color: '',
      capacity: '128 GB',
      imei: ''
    });

    expect(createDefaultStockFormState([])).toMatchObject({
      storeId: '',
      costs: [],
      photos: []
    });
  });

  it('prefers explicit observations over legacy notes when editing', () => {
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
      notes: 'legado',
      observations: 'observacao atual',
      costs: [],
      photos: [],
      entryDate: '2026-04-17T00:00:00.000Z'
    } satisfies StockItem;

    expect(createInitialStockFormState(stores, initialData).observations).toBe('observacao atual');
  });

  it('uses empty observations when edited stock has no notes or observations', () => {
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
      costs: [],
      photos: [],
      entryDate: '2026-04-17T00:00:00.000Z'
    } satisfies StockItem;

    expect(createInitialStockFormState(stores, initialData).observations).toBe('');
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

  it('builds a used device payload preserving editable fields and existing identity', () => {
    const payload = buildStockItemPayload({
      formData: {
        id: 'stk-existing',
        type: DeviceType.IPHONE,
        model: 'iPhone 15 Pro',
        color: 'Titânio',
        hasBox: true,
        capacity: '256 GB',
        imei: ' 123456789012345 ',
        condition: Condition.USED,
        status: StockStatus.AVAILABLE,
        simType: 'Virtual',
        batteryHealth: 79.4,
        storeId: 'store-2',
        purchasePrice: 4100,
        sellPrice: 5300,
        maxDiscount: 250,
        warrantyType: WarrantyType.APPLE,
        warrantyEnd: '2026-12-31',
        origin: 'Trade-in',
        notes: 'nota legada',
        observations: 'observacao final',
        costs: [{ id: 'cost-1', description: 'Tela', amount: 100, date: '2026-06-01' }],
        photos: ['https://cdn/photo-1.jpg'],
        entryDate: '2026-05-01T00:00:00.000Z'
      },
      stores,
      supportsCapacity: true,
      selectedChipType: 'Virtual',
      now: new Date('2026-06-13T12:00:00.000Z'),
      createId: () => 'should-not-be-used'
    });

    expect(payload).toEqual({
      id: 'stk-existing',
      type: DeviceType.IPHONE,
      model: 'iPhone 15 Pro',
      color: 'Titânio',
      hasBox: true,
      capacity: '256 GB',
      imei: ' 123456789012345 ',
      condition: Condition.USED,
      status: StockStatus.AVAILABLE,
      simType: 'Virtual',
      batteryHealth: 79,
      storeId: 'store-2',
      purchasePrice: 4100,
      sellPrice: 5300,
      maxDiscount: 250,
      warrantyType: WarrantyType.APPLE,
      warrantyEnd: '2026-12-31',
      origin: 'Trade-in',
      notes: 'observacao final',
      observations: 'observacao final',
      costs: [{ id: 'cost-1', description: 'Tela', amount: 100, date: '2026-06-01' }],
      photos: ['https://cdn/photo-1.jpg'],
      entryDate: '2026-05-01T00:00:00.000Z'
    });
  });

  it('builds a minimal new payload with empty fallbacks when optional fields are absent', () => {
    const payload = buildStockItemPayload({
      formData: {
        model: 'iPhone 16',
        condition: Condition.USED
      },
      stores: [],
      supportsCapacity: true,
      now: new Date('2026-06-13T12:00:00.000Z')
    });

    expect(payload.id).toMatch(/^stk-/);
    expect(payload).toMatchObject({
      type: DeviceType.IPHONE,
      model: 'iPhone 16',
      color: '',
      hasBox: false,
      capacity: '',
      imei: '',
      condition: Condition.USED,
      status: StockStatus.AVAILABLE,
      batteryHealth: 100,
      storeId: '',
      purchasePrice: 0,
      sellPrice: 0,
      maxDiscount: 0,
      warrantyType: WarrantyType.STORE,
      warrantyEnd: undefined,
      origin: '',
      notes: '',
      observations: '',
      costs: [],
      photos: [],
      entryDate: '2026-06-13T12:00:00.000Z'
    });
  });
});
