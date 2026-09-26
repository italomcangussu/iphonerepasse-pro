import { describe, expect, it } from 'vitest';
import { Condition, StockStatus, type Customer, type Sale, type StockItem } from '../types';
import { buildCustomerReceiptFields, buildSaleReceiptData, toReceiptCustomer } from './receiptData';

const customer = (overrides: Partial<Customer> = {}): Customer => ({
  id: 'cus-1',
  name: 'Maria Silva',
  cpf: '12345678909',
  phone: '85999990000',
  alternativePhone: '8533334444',
  email: 'maria@exemplo.com',
  birthDate: '1990-04-17',
  purchases: 1,
  totalSpent: 6500,
  ...overrides
});

const stockItem = (): StockItem => ({
  id: 'stk-1',
  type: 'iPhone',
  model: 'iPhone 15 Pro',
  color: 'Titânio Natural',
  capacity: '256GB',
  imei: '357000000000001',
  condition: Condition.USED,
  status: StockStatus.SOLD,
  storeId: 'store-1',
  purchasePrice: 5000,
  sellPrice: 6500
} as StockItem);

const sale = (): Sale => ({
  id: 'sale-1',
  saleNumber: 42,
  date: '2026-08-12T16:00:00.000Z',
  customerId: 'cus-1',
  sellerId: 'sel-1',
  storeId: 'store-1',
  items: [stockItem()],
  paymentMethods: [{ type: 'Pix', amount: 6500 }],
  total: 6500,
  discount: 0,
  tradeInValue: 0
} as unknown as Sale);

const labelsOf = (fields: Array<{ label: string }>) => fields.map((field) => field.label);

describe('buildCustomerReceiptFields', () => {
  it('lists every registered customer field, in reading order', () => {
    expect(buildCustomerReceiptFields(toReceiptCustomer(customer()))).toEqual([
      { label: 'Cliente', value: 'Maria Silva' },
      { label: 'CPF', value: '123.456.789-09' },
      { label: 'Telefone', value: '(85) 99999-0000' },
      { label: 'Telefone alternativo', value: '(85) 3333-4444' },
      { label: 'E-mail', value: 'maria@exemplo.com' }
    ]);
  });

  it('omits fields the customer never filled in — sem linha em branco', () => {
    const fields = buildCustomerReceiptFields(
      toReceiptCustomer(customer({ alternativePhone: '', email: '' }))
    );

    expect(labelsOf(fields)).toEqual(['Cliente', 'CPF', 'Telefone']);
  });

  it('labels a company document as CNPJ', () => {
    const fields = buildCustomerReceiptFields(toReceiptCustomer(customer({ cpf: '12345678000190' })));

    expect(fields[1]).toEqual({ label: 'CNPJ', value: '12.345.678/0001-90' });
  });

  it('keeps a phone it cannot recognize instead of truncating it', () => {
    const fields = buildCustomerReceiptFields(
      toReceiptCustomer(customer({ phone: '+1 415 555 0100', alternativePhone: '' }))
    );

    expect(fields[2]).toEqual({ label: 'Telefone', value: '+1 415 555 0100' });
  });

  it('falls back to the calling screen name when the sale has no customer', () => {
    expect(buildCustomerReceiptFields(toReceiptCustomer(null, 'Sem cliente'))).toEqual([
      { label: 'Cliente', value: 'Sem cliente' }
    ]);
  });
});

describe('buildSaleReceiptData', () => {
  it('carries the whole customer record into the receipt payload', () => {
    const data = buildSaleReceiptData(sale(), {
      businessProfile: null,
      customer: toReceiptCustomer(customer()),
      sellerName: 'João Vendedor'
    });

    expect(data).toMatchObject({
      customerName: 'Maria Silva',
      customerCpf: '12345678909',
      customerPhone: '85999990000',
      customerAlternativePhone: '8533334444',
      customerEmail: 'maria@exemplo.com'
    });
    expect(data).not.toHaveProperty('customerBirthDate');
  });
});
