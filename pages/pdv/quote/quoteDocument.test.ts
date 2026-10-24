import { describe, expect, it } from 'vitest';
import { DEFAULT_CARD_FEE_SETTINGS } from '../../../utils/cardFees';
import { buildQuoteDocumentHtml, quoteDocumentFileName, type QuoteDocumentData } from './quoteDocument';
import { computeQuoteTotals, createManualQuoteItem, DEFAULT_QUOTE_PAYMENT_PLAN, type QuoteItem, type QuotePresentation } from './quoteModel';

const items: QuoteItem[] = [
  { ...createManualQuoteItem('a'), name: 'iPhone 16 Pro <256GB>', unitPrice: 7000, details: ['Preto'], leadTime: '7 dias úteis', madeToOrder: true },
  { ...createManualQuoteItem('b'), name: 'Capinha', unitPrice: 100, quantity: 2 },
];

const buildData = (presentation: QuotePresentation, overrides: Partial<QuoteDocumentData> = {}): QuoteDocumentData => ({
  quoteNumber: 12,
  createdAt: new Date('2026-10-24T12:30:00Z'),
  expiresAt: new Date('2026-10-25T12:30:00Z'),
  validityDays: 1,
  business: { name: 'iPhoneRepasse', cnpj: '12345678000190', phone: '11999998888', email: '', address: 'Rua A, 10', instagram: 'iphonerepasse' },
  customerName: 'Maria',
  customerPhone: '11988887777',
  sellerName: 'João',
  items,
  presentation,
  cardBrand: 'visa_master',
  totals: computeQuoteTotals({ items, discount: 300, presentation, plan: DEFAULT_QUOTE_PAYMENT_PLAN }, DEFAULT_CARD_FEE_SETTINGS),
  notes: 'Linha 1\nLinha 2',
  ...overrides,
});

describe('buildQuoteDocumentHtml', () => {
  it('traz empresa, número, data/hora de emissão e validade no cabeçalho', () => {
    const html = buildQuoteDocumentHtml(buildData('sum'));
    expect(html).toContain('CNPJ 12.345.678/0001-90');
    expect(html).toContain('ORC-0012');
    expect(html).toContain('09:30');
    expect(html).toMatch(/Válido até .*25\/10\/2026 às 09:30/);
    expect(html).toContain('1 dia de validade');
  });

  it('modo soma mostra total com desconto, parcelas e prazo; escapa HTML; não diz encomenda', () => {
    const html = buildQuoteDocumentHtml(buildData('sum'));
    expect(html).toContain('R$ 6.900,00');
    expect(html).toContain('Desconto de R$ 300,00');
    expect(html).toContain('Crédito 18x');
    expect(html).toContain('Entrega: 7 dias úteis');
    expect(html).toContain('iPhone 16 Pro &lt;256GB&gt;');
    expect(html).not.toMatch(/encomenda/i);
    expect(html).toContain('Linha 1<br />Linha 2');
  });

  it('modo comparar lista cada opção com o próprio preço, sem total geral', () => {
    const html = buildQuoteDocumentHtml(buildData('compare'));
    expect(html).toContain('2 opções para você escolher');
    expect(html).toContain('R$ 7.000,00');
    expect(html).not.toContain('Total à vista</span>');
  });

  it('só à vista não mostra tabela de cartão; sem logo usa monograma', () => {
    const totals = computeQuoteTotals({ items, discount: 0, presentation: 'sum', plan: { ...DEFAULT_QUOTE_PAYMENT_PLAN, cashOnly: true } }, DEFAULT_CARD_FEE_SETTINGS);
    const html = buildQuoteDocumentHtml(buildData('sum', { totals }));
    expect(html).not.toContain('Crédito');
    expect(html).toContain('Pagamento à vista (Pix ou dinheiro)');
    expect(html).toContain('logo--mono');
  });

  it('nomeia o arquivo pelo número', () => {
    expect(quoteDocumentFileName(12)).toBe('orcamento-orc-0012.html');
  });
});
