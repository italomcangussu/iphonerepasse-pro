import { describe, expect, it } from 'vitest';
import type { Customer, Sale, StoreLocation } from '../../types';
import { buildClientExportCsv } from './clientExport';

describe('buildClientExportCsv', () => {
  it('consolida aparelhos e cidades únicos em uma linha por cliente', () => {
    const customers = [{
      id: 'customer-1',
      name: 'Ana',
      phone: '88999999999',
      cpf: '123',
      birthDate: '',
      email: '',
      purchases: 2,
      totalSpent: 0,
    }] as Customer[];
    const sales = [
      { id: 'sale-1', customerId: 'customer-1', storeId: 'store-1', items: [{ model: 'iPhone 15' }] },
      { id: 'sale-2', customerId: 'customer-1', storeId: 'store-2', items: [{ model: 'iPhone 15' }, { model: 'iPad Air' }] },
    ] as Sale[];
    const stores = [
      { id: 'store-1', name: 'Loja Sobral', city: 'Sobral' },
      { id: 'store-2', name: 'Loja Fortaleza', city: 'Fortaleza' },
    ] as StoreLocation[];

    const csv = buildClientExportCsv(customers, sales, stores);

    expect(csv).toContain('Ana,88999999999,123,,iPhone 15 | iPad Air,Sobral | Fortaleza');
  });
});
