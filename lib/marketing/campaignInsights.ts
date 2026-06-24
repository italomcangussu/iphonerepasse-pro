import { CampaignPlan, CampaignSegment, CustomerRfm, SegmentAgg } from './campaigns';

/**
 * Tradução das métricas de "Campanhas" em ARGUMENTOS e IDEIAS de campanha (PT-BR)
 * que mudam conforme os dados. Mantém a UI burra: a página só renderiza o que
 * estas funções decidem. Espelha o estilo de `opportunityInsights.ts`.
 */

const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
});

export function formatBRL(value: number): string {
  return BRL.format(Math.round(value || 0));
}

export function formatPct(value: number): string {
  return `${Math.round((value || 0) * 100)}%`;
}

export function formatDays(value: number | null): string {
  if (value == null) return '—';
  return `${Math.round(value)} dias`;
}

export const SEGMENT_META: Record<
  CampaignSegment,
  { label: string; tone: 'positive' | 'neutral' | 'warning' | 'negative'; emoji: string; action: string }
> = {
  champions: { label: 'Campeões', tone: 'positive', emoji: '🏆', action: 'Recompense (VIP, cashback, lançamentos antes de todos).' },
  loyal: { label: 'Leais', tone: 'positive', emoji: '💚', action: 'Estimule indicação e upsell de acessórios/upgrade.' },
  promising: { label: 'Promissores', tone: 'neutral', emoji: '🌱', action: 'Nutra com conteúdo e uma 2ª oferta para criar hábito.' },
  new: { label: 'Novos', tone: 'neutral', emoji: '✨', action: 'Onboarding caprichado e pedido de avaliação pós-venda.' },
  at_risk: { label: 'Em risco', tone: 'warning', emoji: '⚠️', action: 'Reative já: bons clientes esfriando. Oferta personalizada.' },
  dormant: { label: 'Sumidos', tone: 'negative', emoji: '😴', action: 'Win-back com gatilho forte (desconto/condição especial).' },
};

export const SEGMENT_COLOR: Record<CampaignSegment, string> = {
  champions: '#22c55e',
  loyal: '#10b981',
  promising: '#3b82f6',
  new: '#06b6d4',
  at_risk: '#f59e0b',
  dormant: '#ef4444',
};

/** Frase-argumento para um cliente, conforme seu segmento RFM. */
export function buildCustomerArgument(c: CustomerRfm): string {
  const meta = SEGMENT_META[c.segment];
  const valor = formatBRL(c.monetary);
  const compras = `${c.frequency} compra${c.frequency > 1 ? 's' : ''}`;
  const recencia = `última há ${formatDays(c.recencyDays)}`;
  switch (c.segment) {
    case 'champions':
      return `${compras}, ${valor} no total e ativo (${recencia}). ${meta.action}`;
    case 'loyal':
      return `Compra com frequência (${compras}, ${recencia}). ${meta.action}`;
    case 'promising':
      return `Cliente ativo recente (${recencia}, ${valor}). ${meta.action}`;
    case 'new':
      return `Primeira compra há ${formatDays(c.firstPurchaseDays)} (${valor}). ${meta.action}`;
    case 'at_risk':
      return `Já valeu ${valor} em ${compras}, mas sumiu (${recencia}). ${meta.action}`;
    case 'dormant':
      return `${compras}, ${valor}, ${recencia}. ${meta.action}`;
  }
}

export interface CampaignIdea {
  id: string;
  title: string;
  tone: 'positive' | 'neutral' | 'warning' | 'negative';
  emoji: string;
  body: string;
  audienceSize: number;
}

/**
 * Gera ideias de campanha prontas e data-driven a partir do plano. Cada ideia só
 * aparece se tiver público — o número e o texto mudam conforme os dados.
 */
export function buildCampaignIdeas(plan: CampaignPlan): CampaignIdea[] {
  const ideas: CampaignIdea[] = [];
  const seg = (s: CampaignSegment): SegmentAgg | undefined => plan.segments.find((x) => x.segment === s);

  if (plan.winBack.length > 0) {
    const pool = plan.winBack.reduce((s, c) => s + c.monetary, 0);
    ideas.push({
      id: 'winback',
      title: 'Reativar clientes sumidos',
      tone: 'negative',
      emoji: '😴',
      body: `${plan.winBack.length} cliente(s) sem comprar há +${plan.recencyCutoff} dias somam ${formatBRL(pool)} em histórico. Dispare um win-back com gatilho forte (desconto/cashback) — reativar custa menos que adquirir.`,
      audienceSize: plan.winBack.length,
    });
  }

  if (plan.upgrades.length > 0) {
    const target = plan.upgrades[0].suggestedModel;
    ideas.push({
      id: 'upgrade',
      title: 'Oferta de upgrade',
      tone: 'positive',
      emoji: '🚀',
      body: `${plan.upgrades.length} cliente(s) compraram há +${Math.round(plan.upgrades[0].recencyDays)} dias. Ofereça o ${target} (modelo que está girando e em estoque) com entrada do aparelho atual.`,
      audienceSize: plan.upgrades.length,
    });
  }

  const champions = seg('champions');
  if (champions) {
    ideas.push({
      id: 'vip',
      title: 'Programa VIP / fidelidade',
      tone: 'positive',
      emoji: '🏆',
      body: `${champions.count} campeão(ões) movimentam ${formatBRL(champions.totalValue)} (ticket médio ${formatBRL(champions.avgTicket)}). Dê acesso antecipado a lançamentos e cashback para blindar essa base.`,
      audienceSize: champions.count,
    });
  }

  const atRisk = seg('at_risk');
  if (atRisk) {
    ideas.push({
      id: 'rescue',
      title: 'Resgate de bons clientes',
      tone: 'warning',
      emoji: '⚠️',
      body: `${atRisk.count} bom(ns) cliente(s) esfriando (${formatBRL(atRisk.totalValue)} em histórico). Aja antes de virarem sumidos: oferta personalizada do que costumam comprar.`,
      audienceSize: atRisk.count,
    });
  }

  const novos = seg('new');
  if (novos) {
    ideas.push({
      id: 'second-sale',
      title: 'Segunda compra dos novos',
      tone: 'neutral',
      emoji: '✨',
      body: `${novos.count} cliente(s) novo(s) nos últimos meses. Uma 2ª oferta cedo cria hábito e aumenta o valor de vida (LTV).`,
      audienceSize: novos.count,
    });
  }

  return ideas;
}

/** Headline de timing (melhor mês/dia para disparar). */
export function timingHeadline(plan: CampaignPlan): string {
  if (!plan.bestWeekday && !plan.bestMonth) {
    return 'Ainda sem histórico suficiente para identificar a melhor janela.';
  }
  const parts: string[] = [];
  if (plan.bestWeekday) parts.push(`${plan.bestWeekday.label} é o dia que mais vende`);
  if (plan.bestMonth) parts.push(`${plan.bestMonth.label} é o mês de pico`);
  return `${parts.join(' e ')}. Programe os disparos para perto dessas janelas.`;
}

/** Leitura "nerd" de cada KPI do topo. */
export function campaignHeadlines(plan: CampaignPlan): {
  active: string;
  ticket: string;
  dormant: string;
  repurchase: string;
} {
  return {
    active: plan.totalCustomers > 0
      ? `${plan.activeCustomers} de ${plan.totalCustomers} clientes ativos (compra ≤ ${plan.recencyCutoff} dias).`
      : 'Sem clientes com compras registradas ainda.',
    ticket: plan.avgTicket > 0
      ? `Ticket médio de ${formatBRL(plan.avgTicket)} por compra.`
      : 'Sem vendas para calcular o ticket.',
    dormant: plan.dormantCustomers > 0
      ? `${plan.dormantCustomers} cliente(s) sumido(s) — base reativável esperando uma campanha.`
      : 'Nenhum cliente sumido. Base bem aquecida. 👏',
    repurchase: plan.avgRepurchaseDays != null
      ? `Recompra a cada ~${Math.round(plan.avgRepurchaseDays)} dias: programe a próxima oferta nesse ritmo.`
      : 'Ainda sem recompras suficientes para medir a cadência.',
  };
}
