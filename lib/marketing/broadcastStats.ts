/**
 * "Campanhas" — agregação do DESEMPENHO dos disparos (broadcasts) do CRM e da
 * ATRIBUIÇÃO de origem dos leads. Lógica PURA: recebe as linhas cruas das tabelas
 * `crm_broadcasts` / `crm_broadcast_recipients` / `crm_leads` (o fetch fica no
 * componente) e devolve os números prontos para render.
 *
 * Limite conhecido dos dados: `crm_broadcast_recipients.status` só registra
 * envio (sent/failed/skipped/pending) — não há abertura/clique/conversão. Por
 * isso a métrica é "taxa de sucesso de envio", não de engajamento.
 */

export type BroadcastStatus = 'draft' | 'scheduled' | 'processing' | 'completed' | 'failed' | 'canceled';
export type RecipientStatus = 'pending' | 'sent' | 'failed' | 'skipped';

export interface BroadcastRow {
  id: string;
  name: string | null;
  status: string | null;
  scheduled_for: string | null;
  sent_at: string | null;
  created_at: string | null;
}

export interface RecipientRow {
  broadcast_id: string;
  status: string | null;
}

export interface LeadRow {
  id: string;
  source: string | null;
  source_campaign_title: string | null;
  utm_source: string | null;
  utm_campaign: string | null;
  created_at: string | null;
}

export interface BroadcastSummaryItem {
  id: string;
  name: string;
  status: string;
  sentAt: string | null;
  scheduledFor: string | null;
  recipients: number;
  sent: number;
  failed: number;
}

export interface AttributionItem {
  label: string;
  count: number;
}

export interface BroadcastStats {
  totalBroadcasts: number;
  byStatus: Record<string, number>;
  totalRecipients: number;
  sent: number;
  failed: number;
  pending: number;
  skipped: number;
  sendSuccessRate: number | null; // sent ÷ (sent + failed); null se nada despachado
  recent: BroadcastSummaryItem[];
  sources: AttributionItem[];
  campaigns: AttributionItem[];
  leadsTracked: number;
  leadsWithSource: number;
}

export interface BroadcastStatsOptions {
  periodDays?: number | null;
  now?: Date;
  /** Quantos broadcasts recentes e quantas linhas de atribuição manter. */
  limit?: number;
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function increment(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function topItems(map: Map<string, number>, limit: number): AttributionItem[] {
  return Array.from(map.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export function computeBroadcastStats(
  broadcasts: BroadcastRow[],
  recipients: RecipientRow[],
  leads: LeadRow[],
  options: BroadcastStatsOptions = {}
): BroadcastStats {
  const now = options.now ?? new Date();
  const periodDays = options.periodDays ?? null;
  const cutoff = periodDays != null ? new Date(now.getTime() - periodDays * MS_PER_DAY) : null;
  const limit = options.limit ?? 6;

  const withinWindow = (value: string | null): boolean => {
    if (!cutoff) return true;
    const d = parseDate(value);
    return d != null && d >= cutoff;
  };

  // Broadcasts filtrados pela janela (referência: created_at).
  const scopedBroadcasts = broadcasts.filter((b) => withinWindow(b.created_at));
  const scopedIds = new Set(scopedBroadcasts.map((b) => b.id));

  // Recipients agrupados por broadcast (apenas os dos broadcasts na janela).
  const perBroadcast = new Map<string, { recipients: number; sent: number; failed: number }>();
  let sent = 0;
  let failed = 0;
  let pending = 0;
  let skipped = 0;
  let totalRecipients = 0;
  for (const r of recipients) {
    if (!scopedIds.has(r.broadcast_id)) continue;
    let agg = perBroadcast.get(r.broadcast_id);
    if (!agg) {
      agg = { recipients: 0, sent: 0, failed: 0 };
      perBroadcast.set(r.broadcast_id, agg);
    }
    agg.recipients += 1;
    totalRecipients += 1;
    switch (r.status) {
      case 'sent':
        agg.sent += 1;
        sent += 1;
        break;
      case 'failed':
        agg.failed += 1;
        failed += 1;
        break;
      case 'skipped':
        skipped += 1;
        break;
      default:
        pending += 1;
        break;
    }
  }

  const byStatus: Record<string, number> = {};
  for (const b of scopedBroadcasts) {
    const status = b.status || 'draft';
    byStatus[status] = (byStatus[status] ?? 0) + 1;
  }

  const recent: BroadcastSummaryItem[] = [...scopedBroadcasts]
    .sort((a, b) => {
      const da = parseDate(a.sent_at) ?? parseDate(a.scheduled_for) ?? parseDate(a.created_at);
      const db = parseDate(b.sent_at) ?? parseDate(b.scheduled_for) ?? parseDate(b.created_at);
      return (db?.getTime() ?? 0) - (da?.getTime() ?? 0);
    })
    .slice(0, limit)
    .map((b) => {
      const agg = perBroadcast.get(b.id) ?? { recipients: 0, sent: 0, failed: 0 };
      return {
        id: b.id,
        name: b.name || 'Sem nome',
        status: b.status || 'draft',
        sentAt: b.sent_at,
        scheduledFor: b.scheduled_for,
        recipients: agg.recipients,
        sent: agg.sent,
        failed: agg.failed,
      };
    });

  // Atribuição de origem dos leads (janela: created_at do lead).
  const scopedLeads = leads.filter((l) => withinWindow(l.created_at));
  const sourceMap = new Map<string, number>();
  const campaignMap = new Map<string, number>();
  let leadsWithSource = 0;
  for (const l of scopedLeads) {
    const source = (l.source || l.utm_source || '').trim();
    if (source) {
      increment(sourceMap, source);
      leadsWithSource += 1;
    }
    const campaign = (l.source_campaign_title || l.utm_campaign || '').trim();
    if (campaign) increment(campaignMap, campaign);
  }

  const dispatched = sent + failed;

  return {
    totalBroadcasts: scopedBroadcasts.length,
    byStatus,
    totalRecipients,
    sent,
    failed,
    pending,
    skipped,
    sendSuccessRate: dispatched > 0 ? sent / dispatched : null,
    recent,
    sources: topItems(sourceMap, limit),
    campaigns: topItems(campaignMap, limit),
    leadsTracked: scopedLeads.length,
    leadsWithSource,
  };
}
