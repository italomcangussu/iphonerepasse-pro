import { describe, expect, it } from 'vitest';
import {
  buildSaleReceiptPdf,
  composeSaleReceipt,
  composeSaleReceiptHeader,
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
  businessName: 'iPhone Repasse',
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

/** Achata os blocos em texto comparável, na ordem em que aparecem. */
const textOf = (blocks: ReceiptBlock[]): string[] =>
  blocks.flatMap((block) => {
    switch (block.kind) {
      case 'text':
        return [block.text];
      case 'section':
        return [`# ${block.label}`];
      case 'row':
        return [`${block.left}|${block.right}`];
      case 'item':
        return [`${block.title}|${block.price}`, ...block.details];
      case 'fields':
        return block.entries.map((entry) => `${entry.label}=${entry.value}`);
      case 'total':
        return [`TOTAL ${block.label}|${block.value}`];
      case 'alert':
        return [`ALERTA ${block.label}|${block.value}`, ...(block.note ? [block.note] : [])];
      default:
        return [];
    }
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

describe('composeSaleReceiptHeader', () => {
  it('reúne identidade do negócio e do documento', () => {
    const header = composeSaleReceiptHeader(baseReceipt());

    expect(header.businessName).toBe('iPhone Repasse');
    expect(header.businessLines).toEqual([
      'Rua das Flores, 100',
      'CNPJ: 12.345.678/0001-90',
      'Tel: (11) 99999-0000'
    ]);
    expect(header.documentNumber).toBe('Nº 42');
  });

  it('descarta linhas vazias de endereço multilinha', () => {
    const header = composeSaleReceiptHeader(
      baseReceipt({ businessAddress: 'Av. Um, 1\n\n  \nAv. Dois, 2', businessCnpj: undefined, businessPhone: undefined })
    );

    // Linha em branco no perfil virava um buraco no meio do cabeçalho.
    expect(header.businessLines).toEqual(['Av. Um, 1', 'Av. Dois, 2']);
  });

  it('deriva o monograma das iniciais para quando não há logo', () => {
    expect(composeSaleReceiptHeader(baseReceipt()).monogram).toBe('IR');
    expect(composeSaleReceiptHeader(baseReceipt({ businessName: 'Loja' })).monogram).toBe('L');
  });
});

describe('composeSaleReceipt', () => {
  it('inclui identificação, itens, totais e pagamentos', () => {
    const lines = textOf(composeSaleReceipt(baseReceipt()));

    expect(lines).toContain('Cliente=Maria Silva');
    expect(lines).toContain('CPF=123.456.789-09');
    expect(lines).toContain('Vendedor=João Vendedor');
    expect(lines).toContain('# Itens');
    expect(lines).toContain('iPhone 15 Pro 256GB|R$ 6.500,00');
    expect(lines).toContain('IMEI/Serial: 357000000000001');
    expect(lines).toContain('Cor: Titânio Natural');
    expect(lines).toContain('Saúde da bateria: 92%');
    expect(lines).toContain('# Totais');
    expect(lines).toContain('Subtotal|R$ 6.500,00');
    expect(lines).toContain('# Pagamentos');
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

  it('esconde desconto e acréscimo de cartão quando são zero', () => {
    const lines = textOf(composeSaleReceipt(baseReceipt()));

    expect(lines.some((line) => line.startsWith('Desconto'))).toBe(false);
    // Linha de R$ 0,00 só ocupa espaço e não informa nada.
    expect(lines.some((line) => line.startsWith('Acréscimo cartão'))).toBe(false);
  });

  it('mostra desconto e acréscimo de cartão quando há valor', () => {
    const lines = textOf(
      composeSaleReceipt(baseReceipt({ discountAmount: 250, discountLabel: 'Desconto (5.00%)', cardFeeTotal: 180 }))
    );

    expect(lines).toContain('Desconto (5.00%)|-R$ 250,00');
    expect(lines).toContain('Acréscimo cartão|R$ 180,00');
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

    expect(lines).toContain('# Aparelhos recebidos na troca');
    expect(lines).toContain('iPhone 12 · 64GB · Azul|-R$ 1.800,00');
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
    expect(lines).toContain('Líquido loja|R$ 6.500,00');
    expect(lines).toContain('Acréscimo|R$ 500,00');
  });

  it('destaca o saldo em aberto quando parte da venda ficou como devedor', () => {
    const lines = textOf(
      composeSaleReceipt(
        baseReceipt({
          payments: [
            { label: 'Pix', customerAmount: 1500, storeAmount: 1500 },
            { label: 'Devedor', customerAmount: 1950, storeAmount: 1950, isPending: true }
          ]
        })
      )
    );

    expect(lines).toContain('ALERTA Saldo em aberto|R$ 1.950,00');
    // "Total pago" mentiria: o cliente ainda deve.
    expect(lines).toContain('TOTAL Total da compra|R$ 6.500,00');
    expect(lines.some((line) => line.startsWith('TOTAL Total pago'))).toBe(false);
  });

  it('chama de "total pago" quando a venda foi quitada', () => {
    const lines = textOf(composeSaleReceipt(baseReceipt()));

    expect(lines).toContain('TOTAL Total pago|R$ 6.500,00');
    expect(lines.some((line) => line.startsWith('ALERTA'))).toBe(false);
  });

  it('omite campos opcionais ausentes sem quebrar', () => {
    const blocks = composeSaleReceipt(
      baseReceipt({ customerCpf: undefined, warrantyLine: null })
    );
    const lines = textOf(blocks);

    expect(lines.some((line) => line.startsWith('CPF'))).toBe(false);
    expect(lines).toContain('Obrigado pela preferência!');
  });
});

describe('buildSaleReceiptPdf', () => {
  const logo = { dataUrl: 'data:image/png;base64,x', format: 'PNG' as const };

  it('gera o A4 no tamanho de página correto', () => {
    const doc = buildSaleReceiptPdf(baseReceipt(), 'a4');
    expect(Math.round(doc.internal.pageSize.getWidth())).toBe(210);
    expect(Math.round(doc.internal.pageSize.getHeight())).toBe(297);
  });

  it('gera a bobina com 80mm de largura e altura ajustada ao conteúdo', () => {
    const doc = buildSaleReceiptPdf(baseReceipt(), '80mm');
    expect(Math.round(doc.internal.pageSize.getWidth())).toBe(80);
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

  it('pagina o A4 e identifica as folhas seguintes', () => {
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

  it('cai no monograma quando a logo está corrompida, sem perder o comprovante', () => {
    // Uma logo ilegível no perfil não pode custar a venda inteira.
    expect(() => buildSaleReceiptPdf(baseReceipt(), 'a4', { logo })).not.toThrow();
    expect(() => buildSaleReceiptPdf(baseReceipt(), '80mm', { logo })).not.toThrow();
    expect(buildSaleReceiptPdf(baseReceipt(), 'a4', { logo }).output('blob').size).toBeGreaterThan(500);
  });

  it('produz um PDF válido e não vazio', () => {
    const blob = buildSaleReceiptPdf(baseReceipt(), 'a4').output('blob');
    expect(blob.type).toBe('application/pdf');
    expect(blob.size).toBeGreaterThan(500);
  });
});
