import type { TransferTenant, TransferableItem } from '../services/tenants';

// Regras de apresentação da tela Empresas. Quem decide o que pode ser
// transferido é o banco; aqui só montamos as escolhas e os textos.

export type StoreOption = {
  storeId: string;
  storeName: string;
  city: string | null;
  tenantId: string;
  tenantName: string;
  transferableCount: number;
};

export const flattenStores = (catalog: TransferTenant[]): StoreOption[] =>
  catalog.flatMap((tenant) =>
    tenant.stores.map((store) => ({
      storeId: store.id,
      storeName: store.name,
      city: store.city,
      tenantId: tenant.id,
      tenantName: tenant.name,
      transferableCount: store.transferableCount,
    })),
  );

export const findStore = (catalog: TransferTenant[], storeId: string): StoreOption | null =>
  flattenStores(catalog).find((store) => store.storeId === storeId) ?? null;

// Uma loja só pode ir para uma empresa diferente da que já é dona dela.
export const storeTransferTargets = (catalog: TransferTenant[], storeId: string): TransferTenant[] => {
  const store = findStore(catalog, storeId);
  if (!store) return [];
  return catalog.filter((tenant) => tenant.id !== store.tenantId);
};

// Aparelhos podem ir para qualquer outra loja, de qualquer empresa que a pessoa administra.
export const stockTransferTargets = (catalog: TransferTenant[], originStoreId: string): StoreOption[] =>
  flattenStores(catalog).filter((store) => store.storeId !== originStoreId);

export const storeLabel = (store: StoreOption, showTenant: boolean): string =>
  showTenant ? `${store.storeName} · ${store.tenantName}` : store.storeName;

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

export const describeStoreTransfer = (store: StoreOption, targetName: string): string[] => [
  `A loja ${store.storeName} passa a ser da ${targetName}.`,
  store.transferableCount > 0
    ? `Vão junto ${plural(store.transferableCount, 'aparelho disponível', 'aparelhos disponíveis')}, com os custos, e os leads do CRM da loja.`
    : 'Vão junto os leads do CRM da loja (não há aparelho disponível).',
  `Vendas, contratos Care e aparelhos vendidos ficam na ${store.tenantName} como histórico.`,
];

export const itemLabel = (item: TransferableItem): string =>
  [item.model, item.capacity, item.color].filter(Boolean).join(' · ');

export const itemDetail = (item: TransferableItem): string =>
  [
    item.condition,
    item.battery_health ? `bateria ${item.battery_health}%` : null,
    item.imei ? `IMEI final ${item.imei.slice(-4)}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

export const transferButtonLabel = (count: number, target: StoreOption | null): string => {
  if (count === 0) return 'Escolha os aparelhos';
  if (!target) return 'Escolha a loja de destino';
  return `Transferir ${plural(count, 'aparelho', 'aparelhos')} para ${target.storeName}`;
};
