import { Condition, StockStatus, type StockItem, type StoreLocation } from '../../types';
import { calculateCardCharge } from '../../utils/cardFees';
import { formatCurrencyBRL } from '../../utils/inputMasks';
import { filterStockItemsByProductSearch } from '../../utils/productSearch';

export type InventoryConditionFilter = Condition | 'all';
export type ShareChannel = 'whatsapp' | 'instagram';
export type SharePaymentPlan = {
  installments: number;
  feeRate: number;
};

export type InventorySelectionInput = {
  stock: StockItem[];
  search: string;
  statuses: StockStatus[];
  condition: InventoryConditionFilter;
  storeId: string;
  stores: StoreLocation[];
  ignoreCondition?: boolean;
  now: Date;
};

const modelCollator = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' });

const formatShareCurrency = (value: number) => formatCurrencyBRL(value).replace(/\s/g, ' ');

export const parseCapacityToGb = (value?: string): number => {
  if (!value) return 0;

  const normalized = value.trim().toUpperCase();
  const match = normalized.match(/(\d+(?:[.,]\d+)?)(?:\s*)(TB|GB)?/);
  if (!match) return 0;

  const numericValue = Number(match[1].replace(',', '.'));
  if (!Number.isFinite(numericValue)) return 0;

  const unit = match[2] || 'GB';
  if (unit === 'TB') return numericValue * 1024;
  return numericValue;
};

export const resolveBatterySortValue = (item: StockItem): number => {
  if (typeof item.batteryHealth === 'number' && Number.isFinite(item.batteryHealth)) {
    return item.batteryHealth;
  }
  return item.condition === Condition.NEW ? 100 : -1;
};

export const compareStockItemsForDisplay = (a: StockItem, b: StockItem): number => {
  const byModel = modelCollator.compare(a.model || '', b.model || '');
  if (byModel !== 0) return -byModel;

  const byCapacity = parseCapacityToGb(b.capacity) - parseCapacityToGb(a.capacity);
  if (byCapacity !== 0) return byCapacity;

  const byBattery = resolveBatterySortValue(b) - resolveBatterySortValue(a);
  if (byBattery !== 0) return byBattery;

  return (b.entryDate || '').localeCompare(a.entryDate || '');
};

const matchesStoreFilter = (item: StockItem, storeId: string, stores: StoreLocation[]): boolean => {
  if (storeId === 'all') return true;
  if (storeId.startsWith('city:')) {
    const cityFilter = storeId.replace('city:', '').toLowerCase();
    const storeCity = stores.find((store) => store.id === item.storeId)?.city?.toLowerCase() || '';
    return storeCity.includes(cityFilter);
  }
  return item.storeId === storeId;
};

export const selectInventoryRows = ({
  stock,
  search,
  statuses,
  condition,
  storeId,
  stores,
  ignoreCondition = false
}: InventorySelectionInput): StockItem[] => {
  const filteredByFacets = stock.filter((item) => {
    const matchesStatus = statuses.includes(item.status);
    const matchesCondition = ignoreCondition || condition === 'all' ? true : item.condition === condition;
    const matchesStore = matchesStoreFilter(item, storeId, stores);

    return matchesStatus && matchesCondition && matchesStore;
  });

  return filterStockItemsByProductSearch(
    filteredByFacets,
    search,
    (item) => item.model,
    (item) => item.imei || '',
    compareStockItemsForDisplay
  );
};

const normalizeInlineShareText = (value: string) => value.replace(/\s+/g, ' ').trim();

const truncateShareSegmentByLine = (value: string, maxLength: number): string => {
  if (value.length <= maxLength) return value;
  if (maxLength <= 3) return '.'.repeat(Math.max(0, maxLength));

  const lines = value.split('\n');
  const nextLines: string[] = [];

  for (const line of lines) {
    const candidate = [...nextLines, line].join('\n');
    if (candidate.length + 4 > maxLength) break;
    nextLines.push(line);
  }

  if (nextLines.length === 0) return `${value.slice(0, maxLength - 3).trimEnd()}...`;
  return `${nextLines.join('\n')}\n...`;
};

const formatStockShareItem = (
  item: StockItem,
  channel: ShareChannel,
  paymentPlan?: SharePaymentPlan
): string => {
  const battery = resolveBatterySortValue(item);
  const batteryLabel = battery >= 0 ? `${battery}%` : 'Bateria nao informada';
  const deviceLabel = normalizeInlineShareText(`${item.model} ${item.capacity || ''} ${item.color || ''}`);
  const cardCharge = paymentPlan
    ? calculateCardCharge(item.sellPrice, paymentPlan.feeRate, paymentPlan.installments)
    : null;

  if (channel === 'whatsapp') {
    return [
      `• ${deviceLabel}`,
      `  🔋 ${batteryLabel} | 💰 À vista ${formatShareCurrency(item.sellPrice)}`,
      cardCharge ? `  💳 ${cardCharge.installments}x de ${formatShareCurrency(cardCharge.installmentAmount)}` : null
    ].filter(Boolean).join('\n');
  }

  return [
    `${deviceLabel} 🔋 ${batteryLabel}`,
    `À vista ${formatShareCurrency(item.sellPrice)}${cardCharge ? ` | ${cardCharge.installments}x de ${formatShareCurrency(cardCharge.installmentAmount)}` : ''}`
  ].join('\n');
};

export const buildStockShareText = (
  items: StockItem[],
  channel: ShareChannel,
  paymentPlan?: SharePaymentPlan
): string => {
  const sortedItems = [...items].sort(compareStockItemsForDisplay);
  const groups = [
    { condition: Condition.NEW, label: channel === 'whatsapp' ? '🆕 *NOVOS*' : 'Novos' },
    { condition: Condition.USED, label: channel === 'whatsapp' ? '♻️ *SEMINOVOS*' : 'Seminovos' }
  ];

  const groupTexts = groups
    .map(({ condition, label }) => {
      const groupItems = sortedItems.filter((item) => item.condition === condition);
      const groupText = groupItems.length > 0
        ? groupItems.map((item) => formatStockShareItem(item, channel, paymentPlan)).join('\n')
        : 'Nenhum';
      return { label, text: groupText };
    });

  if (channel === 'instagram') {
    const header = 'Lista de estoque\n';
    const fixedLength = header.length + groupTexts.reduce((sum, group) => sum + `${group.label}:\n`.length, 0) + '\n'.length;
    const segmentBudget = Math.max(0, Math.floor((1000 - fixedLength) / groupTexts.length));
    return (
      `${header}${groupTexts
        .map((group) => `${group.label}:\n${truncateShareSegmentByLine(group.text, segmentBudget)}`)
        .join('\n')}`
    );
  }

  return `*📱 LISTA DE ESTOQUE*\n\n${groupTexts.map((group) => `${group.label}\n${group.text}`).join('\n\n')}`;
};

export const isReservationExpired = (item: StockItem, now: Date): boolean => {
  if (item.status !== StockStatus.RESERVED || !item.reservation?.expiresAt) return false;
  const expiresAt = new Date(item.reservation.expiresAt);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return expiresAt < today;
};

export const getReservationSummary = (item: StockItem): string => {
  if (!item.reservation) return 'Reserva sem dados vinculados';
  const expiresAt = item.reservation.expiresAt
    ? new Date(item.reservation.expiresAt).toLocaleDateString('pt-BR')
    : 'sem validade';
  return `${item.reservation.customerName} · ${expiresAt}`;
};
