import { describe, expect, it } from 'vitest';
import {
  buildSaleReceiptPdf,
  composeSaleReceipt,
  formatReceiptCurrency,
  getReceiptSaleCode,
  receiptPdfFileName,
  type ReceiptBlock
} from './receiptPdf';
import type { ThermalReceiptData } from './thermalPrinter';

const baseReceipt = (overrides: Partial<ThermalReceiptData> = {}): ThermalReceiptData => ({
  saleId: 'sale-abc123def',
  saleNumber: 42,
  saleDate: '2026-08-12T16:00:00.000Z',
  businessName: 'iPhoneRepasse',
  businessAddress: 'Rua das Flores, 100',
  businessCnpj: '12.345.678/0001-90',
  businessPhone: '(11) 99999-0000',
  customerName: 'Maria Silva',
  customerCpf: '123.456.789-09',
  sellerName: 'João Vendedor',
  items: [
    {
      model: 'iPhone 15 Pro',
      capacity: '256GB',
      color: 'Titânio Natural',
      imei: '357000000000001',
      sellPrice: 6500,
      condition: 'Seminovo',
      batteryHealth: 92,
      warrantyExpiresAt: '2027-02-12T00:00:00.000Z'
    }
  ],
  tradeIns: [],
  tradeInSubtotal: 0,
  payments: [{ label: 'Pix', customerAmount: 6500, storeAmount: 6500 }],
  negotiatedSubtotal: 6500,
  discountAmount: 0,
  discountLabel: 'Desconto',
  saleGrossTotal: 6500,
  cardFeeTotal: 0,
  totalCustomerWithTradeIn: 6500,
  saleNetTotal: 6500,
  warrantyLine: 'Garantias descritas por aparelho.',
  ...overrides
});

/** Todo o texto visível do comprovante, na ordem em que aparece. */
const textOf = (blocks: ReceiptBlock[]): string[] =>
  blocks.flatMap((block) => {
    if (block.kind === 'text') return [block.text];
    if (block.kind === 'row') return [`${block.left}|${block.right}`];
    return [];
  });

describe('formatReceiptCurrency', () => {
  it('formata no padrão brasileiro com duas casas', () => {
    expect(formatReceiptCurrency(6500)).toBe('R$ 6.500,00');
    expect(formatReceiptCurrency(1234.5)).toBe('R$ 1.234,50');
  });

  it('normaliza -0 para zero positivo', () => {
    expect(formatReceiptCurrency(-0)).toBe('R$ 0,00');
  });
});

describe('getReceiptSaleCode', () => {
  it('usa o número da venda quando existe', () => {
    expect(getReceiptSaleCode(baseReceipt())).toBe('42');
  });

  it('cai para os últimos 6 caracteres do id quando não há número', () => {
    expect(getReceiptSaleCode(baseReceipt({ saleNumber: undefined }))).toBe('123DEF');
  });

  it('nomeia o arquivo pelo código da venda', () => {
    expect(receiptPdfFileName(baseReceipt())).toBe('comprovante-42.pdf');
  });
});

describe('composeSaleReceipt', () => {
  it('inclui cabeçalho, identificação, itens, totais e pagamentos', () => {
    const lines = textOf(composeSaleReceipt(baseReceipt()));

    expect(lines).toContain('IPHONEREPASSE');
    expect(lines).toContain('CNPJ: 12.345.678/0001-90');
    expect(lines).toContain('COMPROVANTE DE VENDA');
    expect(lines).toContain('Cliente: Maria Silva');
    expect(lines).toContain('CPF: 123.456.789-09');
    expect(lines).toContain('Vendedor: João Vendedor');
    expect(lines).toContain('ITENS');
    expect(lines).toContain('iPhone 15 Pro 256GB');
    expect(lines).toContain('IMEI/Serial: 357000000000001');
    expect(lines).toContain('Cor: Titânio Natural');
    expect(lines).toContain('Saúde da bateria: 92%');
    expect(lines).toContain('TOTAIS');
    expect(lines).toContain('Subtotal|R$ 6.500,00');
    expect(lines).toContain('TOTAL PAGO|R$ 6.500,00');
    expect(lines).toContain('PAGAMENTOS');
    expect(lines).toContain('Pix|R$ 6.500,00');
    expect(lines).toContain('Obrigado pela preferência!');
  });

  it('marca aparelho novo com a garantia Apple e omite saúde da bateria', () => {
    const lines = textOf(
      composeSaleReceipt(
        baseReceipt({
          items: [
            {
              model: 'iPhone 16',
              capacity: '128GB',
              color: 'Preto',
              imei: '357000000000002',
              sellPrice: 5000,
              condition: 'Novo',
              batteryHealth: 100,
              warrantyExpiresAt: null
            }
          ]
        })
      )
    );

    expect(lines).toContain('Garantia Apple: 1 ano');
    expect(lines.some((line) => line.startsWith('Saúde da bateria'))).toBe(false);
  });

  it('mostra o desconto apenas quando houver valor', () => {
    const semDesconto = textOf(composeSaleReceipt(baseReceipt()));
    expect(semDesconto.some((line) => line.startsWith('Desconto'))).toBe(false);

    const comDesconto = textOf(
      composeSaleReceipt(baseReceipt({ discountAmount: 250, discountLabel: 'Desconto (5.00%)' }))
    );
    expect(comDesconto).toContain('Desconto (5.00%)|-R$ 250,00');
  });

  it('detalha trade-in e o líquido em contas', () => {
    const lines = textOf(
      composeSaleReceipt(
        baseReceipt({
          tradeIns: [
            { model: 'iPhone 12', capacity: '64GB', color: 'Azul', imei: '357000000000009', receivedValue: 1800 }
          ],
          tradeInSubtotal: 1800,
          totalCustomerWithTradeIn: 6500,
          saleNetTotal: 4700
        })
      )
    );

    expect(lines).toContain('APARELHOS RECEBIDOS NA TROCA');
    expect(lines).toContain('iPhone 12 - 64GB - Azul');
    expect(lines).toContain('Entrada:|-R$ 1.800,00');
    expect(lines).toContain('Trade-in pago|R$ 1.800,00');
    expect(lines).toContain('Líquido em contas|R$ 4.700,00');
    expect(lines).toContain('Troca (1 aparelho)|R$ 1.800,00');
  });

  it('abre o acréscimo de cartão quando o cliente paga mais que o líquido da loja', () => {
    const lines = textOf(
      composeSaleReceipt(
        baseReceipt({
          payments: [{ label: 'Cartão Visa/Master 10x', customerAmount: 7000, storeAmount: 6500 }]
        })
      )
    );

    expect(lines).toContain('Cartão Visa/Master 10x|R$ 7.000,00');
    expect(lines).toContain('   Líquido loja|R$ 6.500,00');
    expect(lines).toContain('   Acréscimo|R$ 500,00');
  });

  it('omite campos opcionais ausentes sem quebrar', () => {
    const lines = textOf(
      composeSaleReceipt(
        baseReceipt({
          businessAddress: undefined,
          businessCnpj: undefined,
          businessPhone: undefined,
          customerCpf: undefined,
          warrantyLine: null
        })
      )
    );

    expect(lines.some((line) => line.startsWith('CNPJ:'))).toBe(false);
    expect(lines.some((line) => line.startsWith('CPF'))).toBe(false);
    expect(lines).toContain('Obrigado pela preferência!');
  });
});

describe('buildSaleReceiptPdf', () => {
  it('gera o A4 no tamanho de página correto', () => {
    const doc = buildSaleReceiptPdf(baseReceipt(), 'a4');
    expect(Math.round(doc.internal.pageSize.getWidth())).toBe(210);
    expect(Math.round(doc.internal.pageSize.getHeight())).toBe(297);
  });

  it('gera a bobina com 80mm de largura e altura ajustada ao conteúdo', () => {
    const doc = buildSaleReceiptPdf(baseReceipt(), '80mm');
    expect(Math.round(doc.internal.pageSize.getWidth())).toBe(80);
    // Altura sob medida: nem estourando A4, nem cortando o cupom.
    expect(doc.internal.pageSize.getHeight()).toBeGreaterThan(60);
    expect(doc.internal.pageSize.getHeight()).toBeLessThan(297);
  });

  it('cresce a bobina conforme o número de itens', () => {
    const items = Array.from({ length: 12 }, (_, index) => ({
      model: `iPhone 1${index}`,
      capacity: '128GB',
      color: 'Preto',
      imei: `35700000000${String(index).padStart(4, '0')}`,
      sellPrice: 4000,
      condition: 'Seminovo',
      batteryHealth: 90,
      warrantyExpiresAt: null
    }));

    const curto = buildSaleReceiptPdf(baseReceipt(), '80mm').internal.pageSize.getHeight();
    const longo = buildSaleReceiptPdf(baseReceipt({ items }), '80mm').internal.pageSize.getHeight();
    expect(longo).toBeGreaterThan(curto);
  });

  it('pagina o A4 quando o comprovante passa de uma folha', () => {
    const items = Array.from({ length: 40 }, (_, index) => ({
      model: `iPhone 1${index}`,
      capacity: '256GB',
      color: 'Preto',
      imei: `35700000000${String(index).padStart(4, '0')}`,
      sellPrice: 4000,
      condition: 'Seminovo',
      batteryHealth: 90,
      warrantyExpiresAt: null
    }));

    const doc = buildSaleReceiptPdf(baseReceipt({ items }), 'a4');
    expect(doc.getNumberOfPages()).toBeGreaterThan(1);
  });

  it('produz um PDF válido e não vazio', () => {
    const blob = buildSaleReceiptPdf(baseReceipt(), 'a4').output('blob');
    expect(blob.type).toBe('application/pdf');
    expect(blob.size).toBeGreaterThan(500);
  });
});
