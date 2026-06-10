import { describe, expect, it } from 'vitest';
import {
  buildTradeInQuestionnaire,
  canSimulateTradeIn,
  decideCommerceAction,
  getMissingTradeInFields,
  resolveSimulationMode,
} from './commerceState';

describe('trade-in assessment', () => {
  it('asks only essential fields that were not supplied', () => {
    expect(getMissingTradeInFields({
      consentStatus: 'granted',
      capacity: '128GB',
      color: 'preto',
      scratches: false,
      liquidContact: false,
      sideMarks: null,
      partsSwapped: null,
      hasBoxCable: true,
      batteryPct: 86,
      appleWarranty: false,
      warrantyUntil: null,
    })).toEqual([
      'side_marks',
      'parts_swapped',
    ]);
  });

  it('requires warranty date only when Apple warranty is active', () => {
    const base = {
      consentStatus: 'granted' as const,
      capacity: '128GB',
      color: 'preto',
      scratches: false,
      liquidContact: false,
      sideMarks: false,
      partsSwapped: false,
      hasBoxCable: true,
      batteryPct: 86,
    };

    expect(getMissingTradeInFields({ ...base, appleWarranty: false })).toEqual([]);
    expect(getMissingTradeInFields({ ...base, appleWarranty: true })).toEqual(['warranty_until']);
  });

  it('builds one copyable questionnaire with an answer marker per field', () => {
    const message = buildTradeInQuestionnaire(['liquid_contact', 'parts_swapped', 'battery_pct']);

    expect(message).toContain('Aparelho já teve contato com líquido?\nR:');
    expect(message).toContain('Já foi realizada a troca de alguma peça?\nR:');
    expect(message).toContain('Qual % de bateria?\nR:');
    expect(message.match(/\nR:/g)).toHaveLength(3);
  });

  it('blocks simulation until consent and all essential fields are complete', () => {
    expect(canSimulateTradeIn({
      consentStatus: 'awaiting_consent',
      capacity: '128GB',
    })).toBe(false);

    expect(canSimulateTradeIn({
      consentStatus: 'granted',
      capacity: '128GB',
      color: 'preto',
      scratches: false,
      liquidContact: false,
      sideMarks: false,
      partsSwapped: false,
      hasBoxCable: true,
      batteryPct: 86,
      appleWarranty: false,
      disqualified: false,
      modelAccepted: true,
    })).toBe(true);
  });
});

describe('commerce decisions', () => {
  it('defaults two desired devices to comparison unless joint purchase is explicit', () => {
    expect(resolveSimulationMode('iPhone 15 ou iPhone 16, qual compensa?', 2)).toBe('comparison');
    expect(resolveSimulationMode('quero comprar os dois aparelhos', 2)).toBe('bundle');
    expect(resolveSimulationMode('quero o iPhone 16', 1)).toBe('single');
  });

  it('keeps trade-in consent and questionnaire ahead of simulation', () => {
    expect(decideCommerceAction({
      hasTradeIn: true,
      tradeIn: { consentStatus: 'not_started' },
      desiredDeviceCount: 1,
      quoteReady: true,
    })).toBe('ask_tradein_consent');

    expect(decideCommerceAction({
      hasTradeIn: true,
      tradeIn: { consentStatus: 'granted', capacity: '128GB' },
      desiredDeviceCount: 1,
      quoteReady: true,
    })).toBe('send_tradein_questionnaire');
  });

  it('allows simulation only when quote and trade-in are complete', () => {
    expect(decideCommerceAction({
      hasTradeIn: true,
      tradeIn: {
        consentStatus: 'granted',
        capacity: '128GB',
        color: 'preto',
        scratches: false,
        liquidContact: false,
        sideMarks: false,
        partsSwapped: false,
        hasBoxCable: true,
        batteryPct: 86,
        appleWarranty: false,
      },
      desiredDeviceCount: 2,
      quoteReady: true,
    })).toBe('simulate_quote');
  });
});
