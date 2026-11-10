import { describe, expect, it } from 'vitest';
import type { TransferTenant, TransferableItem } from '../services/tenants';
import {
  describeStoreTransfer,
  findStore,
  flattenStores,
  itemDetail,
  itemLabel,
  stockTransferTargets,
  storeTransferTargets,
  transferButtonLabel,
} from './companies';

const catalog: TransferTenant[] = [
  {
    id: 't1',
    name: 'iPhone Repasse',
    isPrimary: true,
    stores: [
      { id: 'hdi', name: 'HDI', city: 'Fortaleza', transferableCount: 3 },
      { id: 'gr', name: 'GR Imports', city: 'Fortaleza', transferableCount: 0 },
    ],
  },
  { id: 't2', name: 'Nova', isPrimary: false, stores: [{ id: 'nb', name: 'Loja B', city: null, transferableCount: 1 }] },
];

describe('companies', () => {
  it('achata as lojas mantendo a empresa dona', () => {
    expect(flattenStores(catalog).map((s) => `${s.storeId}@${s.tenantId}`)).toEqual(['hdi@t1', 'gr@t1', 'nb@t2']);
  });

  it('loja só vai para empresa diferente da dona', () => {
    expect(storeTransferTargets(catalog, 'hdi').map((t) => t.id)).toEqual(['t2']);
    expect(storeTransferTargets(catalog, 'nb').map((t) => t.id)).toEqual(['t1']);
    expect(storeTransferTargets(catalog, 'inexistente')).toEqual([]);
  });

  it('aparelhos vão para qualquer outra loja, nos dois sentidos', () => {
    expect(stockTransferTargets(catalog, 'hdi').map((s) => s.storeId)).toEqual(['gr', 'nb']);
    expect(stockTransferTargets(catalog, 'nb').map((s) => s.storeId)).toEqual(['hdi', 'gr']);
  });

  it('resumo diz o que vai e o que fica', () => {
    const hdi = findStore(catalog, 'hdi')!;
    const lines = describeStoreTransfer(hdi, 'Nova');
    expect(lines[0]).toBe('A loja HDI passa a ser da Nova.');
    expect(lines[1]).toContain('3 aparelhos disponíveis');
    expect(lines[2]).toContain('ficam na iPhone Repasse');
    expect(describeStoreTransfer(findStore(catalog, 'gr')!, 'Nova')[1]).toContain('não há aparelho disponível');
  });

  it('textos do aparelho e do botão', () => {
    const item = {
      id: 'i1', type: 'iPhone', model: 'iPhone 15', color: 'Preto', capacity: '128GB', imei: '359000000001234',
      condition: 'Seminovo', status: 'Disponível', battery_health: 91, sell_price: 3000, cost: 2500,
    } satisfies TransferableItem;
    expect(itemLabel(item)).toBe('iPhone 15 · 128GB · Preto');
    expect(itemDetail(item)).toBe('Seminovo · bateria 91% · IMEI final 1234');
    expect(transferButtonLabel(0, null)).toBe('Escolha os aparelhos');
    expect(transferButtonLabel(2, null)).toBe('Escolha a loja de destino');
    expect(transferButtonLabel(1, findStore(catalog, 'nb'))).toBe('Transferir 1 aparelho para Loja B');
  });
});
