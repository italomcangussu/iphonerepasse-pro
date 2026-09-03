import type { Customer, Sale, StoreLocation } from '../../types';

const safeText = (value: unknown): string => (typeof value === 'string' ? value : '');

const escapeCsvField = (value: unknown): string => {
  const text = safeText(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const uniqueTexts = (values: unknown[]): string[] => {
  const seen = new Set<string>();
  return values.reduce<string[]>((result, value) => {
    const text = safeText(value).trim();
    if (text && !seen.has(text)) {
      seen.add(text);
      result.push(text);
    }
    return result;
  }, []);
};

export function buildClientExportCsv(
  customers: Customer[],
  sales: Sale[],
  stores: StoreLocation[],
): string {
  const salesByCustomer = new Map<string, Sale[]>();
  sales.forEach((sale) => {
    const customerSales = salesByCustomer.get(sale.customerId) || [];
    customerSales.push(sale);
    salesByCustomer.set(sale.customerId, customerSales);
  });
  const cityByStoreId = new Map(stores.map((store) => [store.id, safeText(store.city)]));

  const rows = customers.map((customer) => {
    const customerSales = salesByCustomer.get(customer.id) || [];
    const models = uniqueTexts(customerSales.flatMap((sale) => sale.items.map((item) => item.model)));
    const cities = uniqueTexts(customerSales.map((sale) => (
      cityByStoreId.get(sale.storeId || sale.items[0]?.storeId || '')
    )));

    return [
      customer.name,
      customer.phone,
      customer.cpf,
      customer.birthDate,
      models.join(' | '),
      cities.join(' | '),
    ].map(escapeCsvField).join(',');
  });

  return `\uFEFF${['nome,telefone,cpf,data de nascimento,modelo de aparelho comprado,cidade', ...rows].join('\r\n')}`;
}
