import { APPLE_MODELS, MODEL_COLORS } from '../../constants';
import { DeviceType, type DeviceCatalogItem, type StockItem } from '../../types';

export type SimTypeOption = NonNullable<StockItem['simType']>;

export type ImeiLookupState = {
  rawIdentifier: string;
  digits: string;
  isOnlyDigits: boolean;
  supportsLookup: boolean;
  canLookupByImei: boolean;
};

const unique = <T>(items: T[]): T[] => Array.from(new Set(items));

const selectedDeviceType = (type: DeviceType | undefined): DeviceType => type || DeviceType.IPHONE;

export const getDeviceModels = (
  type: DeviceType | undefined,
  deviceCatalog: DeviceCatalogItem[]
): string[] => {
  const selectedType = selectedDeviceType(type);
  const predefinedModels = APPLE_MODELS[selectedType] || [];
  const customModels = deviceCatalog
    .filter((entry) => entry.type === selectedType)
    .map((entry) => entry.model);

  return unique([...predefinedModels, ...customModels]);
};

export const getDeviceColors = (
  type: DeviceType | undefined,
  model: string | undefined,
  deviceCatalog: DeviceCatalogItem[]
): string[] => {
  if (!model) return [];

  const selectedType = selectedDeviceType(type);
  const predefinedColors = MODEL_COLORS[model] || [];
  const customColors = deviceCatalog
    .filter((entry) => entry.type === selectedType && entry.model === model && entry.color)
    .map((entry) => entry.color as string);

  return unique([...predefinedColors, ...customColors]);
};

export const getAllKnownDeviceModels = (deviceCatalog: DeviceCatalogItem[]): string[] => (
  unique([
    ...Object.values(APPLE_MODELS).flat(),
    ...deviceCatalog.map((entry) => entry.model),
  ])
);

export const getPredefinedModelColors = (model: string | undefined): string[] => (
  model ? MODEL_COLORS[model] || [] : []
);

export const supportsDeviceCapacity = (type: DeviceType | undefined): boolean => (
  type !== DeviceType.ACCESSORY && type !== DeviceType.WATCH
);

export const getChipOptions = (type: DeviceType | undefined): SimTypeOption[] => {
  switch (type) {
    case DeviceType.IPHONE:
      return ['Physical', 'Virtual', 'Both'];
    case DeviceType.IPAD:
      return ['Physical', 'Virtual', 'Both', 'None'];
    case DeviceType.WATCH:
      return ['None', 'Virtual'];
    default:
      return [];
  }
};

export const supportsDeviceChipSelection = (type: DeviceType | undefined): boolean => (
  getChipOptions(type).length > 0
);

export const resolveSelectedChipType = (
  type: DeviceType | undefined,
  simType: StockItem['simType'] | undefined
): SimTypeOption | undefined => {
  const chipOptions = getChipOptions(type);
  if (chipOptions.length === 0) return undefined;

  return chipOptions.includes(simType as SimTypeOption)
    ? (simType as SimTypeOption)
    : chipOptions[0];
};

export const getImeiLookupState = (
  type: DeviceType | undefined,
  identifier: string | undefined
): ImeiLookupState => {
  const rawIdentifier = (identifier || '').trim();
  const digits = rawIdentifier.replace(/\D/g, '');
  const isOnlyDigits = rawIdentifier.length > 0 && digits.length === rawIdentifier.length;
  const supportsLookup = type === DeviceType.IPHONE || type === DeviceType.IPAD;

  return {
    rawIdentifier,
    digits,
    isOnlyDigits,
    supportsLookup,
    canLookupByImei: supportsLookup && isOnlyDigits && digits.length >= 8,
  };
};
