type WarrantyDeviceLike = {
  model?: string | null;
  capacity?: string | null;
  color?: string | null;
  batteryHealth?: number | null;
  imei?: string | null;
  imeiMasked?: string | null;
};

export interface WarrantyDeviceDisplay {
  title: string;
  capacity: string | null;
  battery: string | null;
  imei: string | null;
}

const normalizeSpaces = (value?: string | null) => (value || '').replace(/\s+/g, ' ').trim();

const stripAccents = (value: string) =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const normalizeSearch = (value?: string | null) => stripAccents(normalizeSpaces(value)).toUpperCase();

const CAPACITY_PATTERN = /(\d{2,4})\s*(GB|TB)\b/i;
const BATTERY_PATTERN = /\b(100|[1-9]\d)\s*%/;

const COLOR_ALIAS: Array<{ pattern: RegExp; value: string }> = [
  { pattern: /\bTITANIO\s+NATURAL\b|\bTITANIO\s+NAT\b|\bNATURAL\b/, value: 'Natural' },
  { pattern: /\bTITANIO\s+PRETO\b|\bPRETO\b|\bBLACK\b/, value: 'Preto' },
  { pattern: /\bTITANIO\s+BRANCO\b|\bBRANCO\b|\bWHITE\b/, value: 'Branco' },
  { pattern: /\bTITANIO\s+AZUL\b|\bAZUL\b|\bBLUE\b/, value: 'Azul' },
  { pattern: /\bTITANIO\s+DESERTO\b|\bDESERTO\b|\bDESERT\b/, value: 'Deserto' },
  { pattern: /\bROXO\b|\bPURPLE\b/, value: 'Roxo' },
  { pattern: /\bVERDE\b|\bGREEN\b/, value: 'Verde' },
  { pattern: /\bROSA\b|\bPINK\b/, value: 'Rosa' },
  { pattern: /\bDOURADO\b|\bGOLD\b/, value: 'Dourado' },
  { pattern: /\bGRAFITE\b|\bGRAPHITE\b/, value: 'Grafite' },
  { pattern: /\bPRATEADO\b|\bSILVER\b/, value: 'Prateado' },
  { pattern: /\bMEIA[- ]?NOITE\b/, value: 'Meia-noite' },
  { pattern: /\bESTELAR\b|\bSTARLIGHT\b/, value: 'Estelar' }
];

const resolveCapacity = (capacity?: string | null, model?: string | null) => {
  const fromCapacity = normalizeSpaces(capacity).match(CAPACITY_PATTERN);
  if (fromCapacity) return `${fromCapacity[1]}${fromCapacity[2].toUpperCase()}`;

  const fromModel = normalizeSpaces(model).match(CAPACITY_PATTERN);
  if (fromModel) return `${fromModel[1]}${fromModel[2].toUpperCase()}`;

  return null;
};

const resolveBattery = (batteryHealth?: number | null, model?: string | null) => {
  if (typeof batteryHealth === 'number' && Number.isFinite(batteryHealth) && batteryHealth > 0 && batteryHealth <= 100) {
    return `${Math.round(batteryHealth)}%`;
  }

  const fromModel = normalizeSpaces(model).match(BATTERY_PATTERN);
  if (fromModel) return `${fromModel[1]}%`;

  return null;
};

const resolveColor = (color?: string | null, model?: string | null) => {
  const normalizedColor = normalizeSpaces(color);
  if (normalizedColor) return normalizedColor;

  const rawModelUpper = normalizeSearch(model);
  for (const alias of COLOR_ALIAS) {
    if (alias.pattern.test(rawModelUpper)) return alias.value;
  }

  return null;
};

const formatIphoneModel = (series: string, variant?: string) => {
  const model = `iPhone ${series}`;
  if (!variant) return model;
  if (variant === 'PM') return `${model} Pro Max`;
  if (variant === 'P') return `${model} Pro`;
  if (variant === 'PLUS') return `${model} Plus`;
  return model;
};

const resolveIphoneModel = (model?: string | null) => {
  const rawModelUpper = normalizeSearch(model);
  if (!rawModelUpper) return null;

  const explicit = rawModelUpper.match(/\bIPHONE\s*(1[1-9])(?:\s*(PRO\s*MAX|PROMAX|PRO|PLUS))?\b/);
  if (explicit) {
    const series = explicit[1];
    const variantToken = (explicit[2] || '').replace(/\s+/g, '');
    const variant = variantToken === 'PROMAX' ? 'PM' : variantToken === 'PRO' ? 'P' : variantToken === 'PLUS' ? 'PLUS' : undefined;
    return formatIphoneModel(series, variant);
  }

  const shorthandPm = rawModelUpper.match(/\b(1[1-9])\s*PM\b/);
  if (shorthandPm) return formatIphoneModel(shorthandPm[1], 'PM');

  const shorthandPro = rawModelUpper.match(/\b(1[1-9])\s*P\b/);
  if (shorthandPro) return formatIphoneModel(shorthandPro[1], 'P');

  const shorthandPlus = rawModelUpper.match(/\b(1[1-9])\s*(PLUS|\+)/);
  if (shorthandPlus) return formatIphoneModel(shorthandPlus[1], 'PLUS');

  const shorthandBase = rawModelUpper.match(/\b(1[1-9])\s*G\b/);
  if (shorthandBase) return formatIphoneModel(shorthandBase[1]);

  return null;
};

const sanitizeModel = (model?: string | null) => {
  const compact = normalizeSpaces(model)
    .replace(/\([^)]*\)/g, ' ')
    .replace(/(\d{2,4})\s*(GB|TB)\b/gi, ' ')
    .replace(/\b(100|[1-9]\d)\s*%/g, ' ');

  return normalizeSpaces(compact);
};

const buildTitle = (model?: string | null, color?: string | null) => {
  const parsedModel = resolveIphoneModel(model) || sanitizeModel(model) || 'Aparelho';
  const normalizedColor = normalizeSpaces(color);

  if (!normalizedColor) return parsedModel;

  const titleUpper = normalizeSearch(parsedModel);
  const colorUpper = normalizeSearch(normalizedColor);
  if (colorUpper && titleUpper.includes(colorUpper)) return parsedModel;

  return `${parsedModel} ${normalizedColor}`;
};

export const formatWarrantyDevice = (device?: WarrantyDeviceLike | null): WarrantyDeviceDisplay => {
  const model = device?.model || '';
  const color = resolveColor(device?.color, model);

  return {
    title: buildTitle(model, color),
    capacity: resolveCapacity(device?.capacity, model),
    battery: resolveBattery(device?.batteryHealth, model),
    imei: normalizeSpaces(device?.imei || device?.imeiMasked) || null
  };
};
