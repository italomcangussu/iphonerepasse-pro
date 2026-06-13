import { Condition, DeviceType, StockStatus, WarrantyType, type StockItem, type StoreLocation } from '../../types';
import { newId } from '../../utils/id';

export type BuildStockItemInput = {
  formData: Partial<StockItem>;
  statusOverride?: StockStatus;
  stores: StoreLocation[];
  supportsCapacity: boolean;
  selectedChipType?: NonNullable<StockItem['simType']>;
  now?: Date;
  createId?: () => string;
};

export const clampBatteryHealth = (value: number): number =>
  Math.min(100, Math.max(0, Math.round(value)));

export const createDefaultStockFormState = (stores: StoreLocation[]): Partial<StockItem> => ({
  type: DeviceType.IPHONE,
  condition: Condition.USED,
  status: StockStatus.AVAILABLE,
  simType: 'Physical',
  storeId: stores.length > 0 ? stores[0].id : '',
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

export const createInitialStockFormState = (
  stores: StoreLocation[],
  initialData?: StockItem
): Partial<StockItem> => {
  const defaultState = createDefaultStockFormState(stores);
  if (!initialData) return defaultState;
  return {
    ...defaultState,
    ...initialData,
    observations: initialData.observations ?? initialData.notes ?? ''
  };
};

export const buildStockItemPayload = ({
  formData,
  statusOverride,
  stores,
  supportsCapacity,
  selectedChipType,
  now = new Date(),
  createId = () => newId('stk')
}: BuildStockItemInput): StockItem => {
  const purchasePrice = Number(formData.purchasePrice || 0);
  const sellPrice = Number(formData.sellPrice || 0);
  const observations = formData.observations ?? formData.notes ?? '';

  return {
    id: formData.id || createId(),
    type: formData.type || DeviceType.IPHONE,
    model: formData.model,
    color: formData.color || '',
    hasBox: formData.hasBox ?? false,
    capacity: supportsCapacity ? (formData.capacity || '') : '',
    imei: formData.imei || '',
    condition: formData.condition || Condition.USED,
    status: statusOverride || formData.status || StockStatus.AVAILABLE,
    simType: selectedChipType,
    batteryHealth:
      formData.condition === Condition.USED
        ? clampBatteryHealth(formData.batteryHealth ?? 100)
        : undefined,
    storeId: formData.storeId || (stores.length > 0 ? stores[0].id : ''),
    purchasePrice,
    sellPrice,
    maxDiscount: Number(formData.maxDiscount || 0),
    warrantyType: formData.warrantyType || WarrantyType.STORE,
    warrantyEnd: formData.warrantyEnd,
    origin: formData.origin || '',
    notes: observations,
    observations,
    costs: formData.costs || [],
    photos: formData.photos || [],
    entryDate: formData.entryDate || now.toISOString()
  };
};
