import { describe, expect, it } from 'vitest';
import { buildSaleReceiptBuffer, type ThermalReceiptData } from './thermalPrinter';

describe('buildSaleReceiptBuffer', () => {
  it('prints the battery health for a sold used device', () => {
    const receipt: ThermalReceiptData = {
      saleId: 'sale-1',
      saleDate: '2026-08-12T12:00:00.000Z',
      businessName: 'Loja Teste',
      customerName: 'Cliente Teste',
      sellerName: 'Vendedor Teste',
      items: [{ model: 'iPhone 15', condition: 'Seminovo', batteryHealth: 86, sellPrice: 3000 }],
      tradeIns: [],
      tradeInSubtotal: 0,
      payments: [{ label: 'Pix', customerAmount: 3000, storeAmount: 3000 }],
      negotiatedSubtotal: 3000,
      discountAmount: 0,
      discountLabel: 'Desconto',
      saleGrossTotal: 3000,
      cardFeeTotal: 0,
      totalCustomerWithTradeIn: 3000,
      saleNetTotal: 3000,
      warrantyLine: null
    };

    expect(new TextDecoder().decode(buildSaleReceiptBuffer(receipt))).toContain('Saude bateria: 86%');
  });
});
