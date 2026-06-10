import { describe, expect, it } from 'vitest';
import { normalizeAICommerceSnapshot } from './aiCommerceSnapshot';

describe('normalizeAICommerceSnapshot', () => {
  it('treats migration defaults as an uninitialized commercial state', () => {
    expect(normalizeAICommerceSnapshot({
      commerce_state: {},
      tradein_assessment: {},
      quote_versions: [],
      state_version: 0,
    }, null)).toBeNull();
  });

  it('normalizes snake_case trade-in fields persisted by n8n', () => {
    const snapshot = normalizeAICommerceSnapshot({
      commerce_state: {
        has_trade_in: true,
        next_action: 'send_tradein_questionnaire',
        simulation_mode: 'comparison',
      },
      tradein_assessment: {
        consent_status: 'granted',
        liquid_contact: false,
        battery_pct: 86,
      },
      quote_versions: [{ id: 'quote-1' }],
      state_version: 3,
    }, {
      action: 'send_tradein_questionnaire',
      outcome: 'waiting_customer',
      created_at: '2026-06-10T12:00:00.000Z',
    });

    expect(snapshot?.tradeInAssessment.consentStatus).toBe('granted');
    expect(snapshot?.tradeInAssessment.liquidContact).toBe(false);
    expect(snapshot?.tradeInAssessment.batteryPct).toBe(86);
    expect(snapshot?.lastEvent?.outcome).toBe('waiting_customer');
  });
});
