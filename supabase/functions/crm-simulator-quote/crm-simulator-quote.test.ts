import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const source = readFileSync('supabase/functions/crm-simulator-quote/index.ts', 'utf8');

describe('crm-simulator-quote Edge Function contract', () => {
  it('requires authenticated CRM role and loads simulator inputs', () => {
    expect(source).toContain('requireAuthenticatedRole(req, supabase)');
    expect(source).toContain('simulator_trade_in_values');
    expect(source).toContain('simulator_trade_in_adjustments');
    expect(source).toContain('card_fee_settings');
    expect(source).toContain('stock_items');
  });

  it('allows CRM_N8N_API_KEY as an n8n fallback credential', () => {
    expect(source).toContain('CRM_N8N_API_KEY');
    expect(source).toContain('x-api-key');
    expect(source).toContain('Unauthorized. Use x-api-key ou Bearer válido.');
  });

  it('validates stock status and returns messageText', () => {
    expect(source).toContain('Disponível');
    expect(source).toContain('Reservado');
    expect(source).toContain('stock_unavailable');
    expect(source).toContain('messageText');
  });

  it('treats trade-in as optional for card and entry simulations', () => {
    expect(source).toContain('const hasTradeIn = Boolean');
    expect(source).toContain('hasTradeIn && (!tradeInModel || !tradeInCapacity)');
    expect(source).toContain('hasTradeIn ?');
  });
});
