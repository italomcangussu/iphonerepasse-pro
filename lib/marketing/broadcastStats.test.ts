import { describe, expect, it } from 'vitest';
import {
  computeBroadcastStats,
  type BroadcastRow,
  type LeadRow,
  type RecipientRow,
} from './broadcastStats';

const NOW = new Date('2026-06-24T12:00:00.000Z');

describe('computeBroadcastStats', () => {
  const broadcasts: BroadcastRow[] = [
    { id: 'b1', name: 'Promo junina', status: 'completed', scheduled_for: '2026-06-10', sent_at: '2026-06-10', created_at: '2026-06-09' },
    { id: 'b2', name: 'Black de inverno', status: 'completed', scheduled_for: '2026-06-20', sent_at: '2026-06-20', created_at: '2026-06-19' },
    { id: 'b3', name: 'Rascunho antigo', status: 'draft', scheduled_for: null, sent_at: null, created_at: '2025-01-01' },
  ];

  const recipients: RecipientRow[] = [
    { broadcast_id: 'b1', status: 'sent' },
    { broadcast_id: 'b1', status: 'sent' },
    { broadcast_id: 'b1', status: 'failed' },
    { broadcast_id: 'b2', status: 'sent' },
    { broadcast_id: 'b2', status: 'skipped' },
    { broadcast_id: 'b3', status: 'pending' },
  ];

  const leads: LeadRow[] = [
    { id: 'l1', source: 'meta_ads', source_campaign_title: 'Campanha iPhone 13', utm_source: null, utm_campaign: null, created_at: '2026-06-01' },
    { id: 'l2', source: 'meta_ads', source_campaign_title: 'Campanha iPhone 13', utm_source: null, utm_campaign: null, created_at: '2026-06-02' },
    { id: 'l3', source: 'instagram', source_campaign_title: null, utm_source: null, utm_campaign: null, created_at: '2026-06-03' },
    { id: 'l4', source: null, source_campaign_title: null, utm_source: 'whatsapp', utm_campaign: null, created_at: '2026-06-04' },
    { id: 'l5', source: null, source_campaign_title: null, utm_source: null, utm_campaign: null, created_at: '2025-01-01' },
  ];

  it('agrega envios, falhas e taxa de sucesso (janela exclui o antigo)', () => {
    const stats = computeBroadcastStats(broadcasts, recipients, leads, { now: NOW, periodDays: 90 });
    expect(stats.totalBroadcasts).toBe(2); // b3 (2025) fora da janela de 90 dias
    expect(stats.sent).toBe(3);
    expect(stats.failed).toBe(1);
    expect(stats.skipped).toBe(1);
    expect(stats.pending).toBe(0); // o pending era do b3, fora da janela
    expect(stats.sendSuccessRate).toBeCloseTo(3 / 4, 5); // 3 sent / (3 sent + 1 failed)
  });

  it('lista broadcasts recentes com contagem por status', () => {
    const stats = computeBroadcastStats(broadcasts, recipients, leads, { now: NOW, periodDays: 90 });
    expect(stats.recent[0].id).toBe('b2'); // mais recente por sent_at
    const b1 = stats.recent.find((r) => r.id === 'b1')!;
    expect(b1.sent).toBe(2);
    expect(b1.failed).toBe(1);
    expect(b1.recipients).toBe(3);
  });

  it('atribui a origem dos leads (source + utm_source), excluindo fora da janela', () => {
    const stats = computeBroadcastStats(broadcasts, recipients, leads, { now: NOW, periodDays: 90 });
    expect(stats.leadsTracked).toBe(4); // l5 (2025) fora da janela
    expect(stats.leadsWithSource).toBe(4);
    expect(stats.sources[0]).toEqual({ label: 'meta_ads', count: 2 });
    expect(stats.campaigns[0]).toEqual({ label: 'Campanha iPhone 13', count: 2 });
  });

  it('sem janela considera todo o histórico', () => {
    const stats = computeBroadcastStats(broadcasts, recipients, leads, { now: NOW, periodDays: null });
    expect(stats.totalBroadcasts).toBe(3);
    expect(stats.pending).toBe(1);
    expect(stats.leadsTracked).toBe(5);
  });

  it('taxa nula quando nada foi despachado', () => {
    const stats = computeBroadcastStats(
      [{ id: 'x', name: 'Vazio', status: 'draft', scheduled_for: null, sent_at: null, created_at: '2026-06-01' }],
      [],
      [],
      { now: NOW, periodDays: 90 }
    );
    expect(stats.sendSuccessRate).toBeNull();
  });
});
