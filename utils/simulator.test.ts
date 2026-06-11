import { describe, expect, it } from 'vitest';
import { DEFAULT_CARD_FEE_SETTINGS } from './cardFees';
import {
  calculateSimulatorQuote,
  DEFAULT_SIMULATOR_TRADE_IN_VALUES,
  findTradeInValueRule,
  formatSimulatorMessage,
  getApplicableTradeInAdjustments,
  SIMULATOR_RESERVATION_HINT_AMOUNT,
  type TradeInAdjustmentRule,
} from './simulator';

const generatedAt = new Date('2026-05-28T14:33:33.000Z');

describe('simulator engine', () => {
  it('finds base trade-in values ignoring case and spacing', () => {
    const rule = findTradeInValueRule(DEFAULT_SIMULATOR_TRADE_IN_VALUES, ' iphone 15 pro max ', '256gb');

    expect(rule?.baseValue).toBe(4100);
  });

  it('filters active global, model and capacity adjustments', () => {
    const adjustments: TradeInAdjustmentRule[] = [
      { id: 'global', label: 'Sem caixa', amountDelta: -100, isActive: true },
      { id: 'model', label: 'Marcas na lateral', model: 'iPhone 15 Pro Max', amountDelta: -500, isActive: true },
      { id: 'capacity', label: 'Bateria alta', model: 'iPhone 15 Pro Max', capacity: '256GB', amountDelta: 200, isActive: true },
      { id: 'inactive', label: 'Inativo', model: 'iPhone 15 Pro Max', amountDelta: -50, isActive: false },
      { id: 'other', label: 'Outro modelo', model: 'iPhone 14', amountDelta: -300, isActive: true },
    ];

    expect(getApplicableTradeInAdjustments(adjustments, 'iPhone 15 Pro Max', '256GB').map((item) => item.id)).toEqual([
      'global',
      'model',
      'capacity',
    ]);
  });

  it('calculates trade-in, entries, card installments and formatted message', () => {
    const quote = calculateSimulatorQuote({
      desiredDevice: {
        label: 'iPhone 17 Pro Max 512GB Azul',
        price: 9950,
      },
      tradeIn: {
        model: 'iPhone 15 Pro Max',
        capacity: '256GB',
        color: 'Branco',
        selectedAdjustmentIds: ['scratches'],
      },
      entries: [{ type: 'Pix', amount: 1000 }],
      cardBrand: 'visa_master',
      valueRules: DEFAULT_SIMULATOR_TRADE_IN_VALUES,
      adjustmentRules: [
        { id: 'scratches', label: 'Marcas de uso na lateral', model: 'iPhone 15 Pro Max', amountDelta: -500, isActive: true },
      ],
      cardFeeSettings: DEFAULT_CARD_FEE_SETTINGS,
      generatedAt,
    });

    expect(quote.summary.tradeInBaseValue).toBe(4100);
    expect(quote.summary.tradeInAdjustmentsTotal).toBe(-500);
    expect(quote.summary.tradeInReceivedValue).toBe(3600);
    expect(quote.summary.entriesTotal).toBe(1000);
    expect(quote.summary.cardNetAmount).toBe(5350);
    expect(quote.summary.reservationHintAmount).toBe(SIMULATOR_RESERVATION_HINT_AMOUNT);
    expect(quote.installments).toHaveLength(18);
    expect(quote.installments[0]).toMatchObject({
      installments: 1,
      feeRate: 2.99,
      customerAmount: 5514.9,
      installmentAmount: 5514.9,
    });
    expect(quote.messageText).toContain('iPhone 17 Pro Max 512GB Azul');
    expect(quote.messageText).toContain('iPhone 15 Pro Max 256GB Branco');
    expect(quote.messageText).toContain('Marcas de uso na lateral: -R$ 500,00');
    expect(quote.messageText).toContain('Pix: R$ 1.000,00');
    expect(quote.messageText).toContain('Resta a pagar R$ 5.350,00');
    expect(quote.messageText).not.toContain('Reserva/sinal opcional');
    expect(quote.messageText).not.toContain('R$ 250,00');
    expect(quote.messageText).toContain('28/05/2026, 11:33:33');
  });

  it('lets manual received value override configured trade-in value', () => {
    const quote = calculateSimulatorQuote({
      desiredDevice: { label: 'iPhone 16 256GB Preto', price: 7000 },
      tradeIn: {
        model: 'iPhone 11',
        capacity: '64GB',
        color: 'Preto',
        manualReceivedValue: 650,
      },
      entries: [],
      cardBrand: 'outras',
      valueRules: DEFAULT_SIMULATOR_TRADE_IN_VALUES,
      adjustmentRules: [],
      cardFeeSettings: DEFAULT_CARD_FEE_SETTINGS,
      generatedAt,
    });

    expect(quote.summary.tradeInBaseValue).toBe(800);
    expect(quote.summary.tradeInReceivedValue).toBe(650);
    expect(quote.summary.cardNetAmount).toBe(6350);
    expect(quote.summary.cardBrandLabel).toBe('Outras');
  });

  it('allows simulations without trade-in using entries and card only', () => {
    const quote = calculateSimulatorQuote({
      desiredDevice: { label: 'iPhone 16 256GB Preto', price: 7000 },
      tradeIn: { model: '', capacity: '', color: '' },
      entries: [{ type: 'Pix', amount: 1000 }],
      cardBrand: 'visa_master',
      valueRules: DEFAULT_SIMULATOR_TRADE_IN_VALUES,
      adjustmentRules: [],
      cardFeeSettings: DEFAULT_CARD_FEE_SETTINGS,
      generatedAt,
    });

    expect(quote.ok).toBe(true);
    expect(quote.summary.tradeInLabel).toBe('');
    expect(quote.summary.tradeInBaseValue).toBe(0);
    expect(quote.summary.tradeInReceivedValue).toBe(0);
    expect(quote.summary.entriesTotal).toBe(1000);
    expect(quote.summary.cardNetAmount).toBe(6000);
    expect(quote.installments).toHaveLength(18);
    expect(quote.messageText).toContain('Pix: R$ 1.000,00');
    expect(quote.messageText).not.toContain('📲');
  });

  it('returns validation errors for missing base value and entries above balance', () => {
    const missingBase = calculateSimulatorQuote({
      desiredDevice: { label: 'iPhone 16 256GB Preto', price: 7000 },
      tradeIn: { model: 'iPhone XR', capacity: '64GB', color: 'Branco' },
      entries: [],
      cardBrand: 'visa_master',
      valueRules: DEFAULT_SIMULATOR_TRADE_IN_VALUES,
      adjustmentRules: [],
      cardFeeSettings: DEFAULT_CARD_FEE_SETTINGS,
    });

    expect(missingBase.ok).toBe(false);
    expect(missingBase.errors[0].code).toBe('trade_in_value_not_found');

    const excessiveEntries = calculateSimulatorQuote({
      desiredDevice: { label: 'iPhone 16 256GB Preto', price: 7000 },
      tradeIn: { model: 'iPhone 15 Pro Max', capacity: '256GB', color: 'Branco' },
      entries: [{ type: 'Pix', amount: 5000 }],
      cardBrand: 'visa_master',
      valueRules: DEFAULT_SIMULATOR_TRADE_IN_VALUES,
      adjustmentRules: [],
      cardFeeSettings: DEFAULT_CARD_FEE_SETTINGS,
    });

    expect(excessiveEntries.ok).toBe(false);
    expect(excessiveEntries.errors[0].code).toBe('entries_exceed_balance');
  });

  it('formats a standalone message from a quote result', () => {
    const quote = calculateSimulatorQuote({
      desiredDevice: { label: 'iPhone 15 128GB Rosa', price: 5200 },
      tradeIn: { model: 'iPhone 11', capacity: '64GB', color: 'Preto' },
      entries: [],
      cardBrand: 'visa_master',
      valueRules: DEFAULT_SIMULATOR_TRADE_IN_VALUES,
      adjustmentRules: [],
      cardFeeSettings: DEFAULT_CARD_FEE_SETTINGS,
      generatedAt,
    });

    expect(formatSimulatorMessage(quote)).toBe(quote.messageText);
  });
});
