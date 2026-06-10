import type { TradeInAssessment } from './commerceState';

export type CommerceState = {
  has_trade_in?: boolean;
  next_action?: string;
  simulation_mode?: 'single' | 'comparison' | 'bundle' | string;
};

export type AICommerceSnapshot = {
  stateVersion: number;
  commerceState: CommerceState;
  tradeInAssessment: TradeInAssessment;
  quoteVersions: Array<Record<string, unknown>>;
  lastEvent: {
    action: string;
    outcome: string | null;
    createdAt: string;
  } | null;
};

export type LeadStateRow = {
  commerce_state?: Record<string, unknown> | null;
  tradein_assessment?: Record<string, unknown> | null;
  quote_versions?: Array<Record<string, unknown>> | null;
  state_version?: number | null;
};

export type AITurnEventRow = {
  action: string;
  outcome: string | null;
  created_at: string;
};

const readFirst = <T,>(source: Record<string, unknown>, ...keys: string[]): T | undefined => {
  for (const key of keys) {
    if (source[key] !== undefined) return source[key] as T;
  }
  return undefined;
};

export const normalizeAICommerceSnapshot = (
  stateRow: LeadStateRow | null,
  eventRow: AITurnEventRow | null,
): AICommerceSnapshot | null => {
  if (!stateRow) return null;
  const commerce = stateRow.commerce_state || {};
  const tradeIn = stateRow.tradein_assessment || {};
  const quotes = Array.isArray(stateRow.quote_versions) ? stateRow.quote_versions : [];
  const stateVersion = Number(stateRow.state_version || 0);
  const initialized = stateVersion > 0
    || Object.keys(commerce).length > 0
    || Object.keys(tradeIn).length > 0
    || quotes.length > 0;
  if (!initialized) return null;

  return {
    stateVersion,
    commerceState: {
      has_trade_in: readFirst<boolean>(commerce, 'has_trade_in', 'hasTradeIn'),
      next_action: readFirst<string>(commerce, 'next_action', 'nextAction'),
      simulation_mode: readFirst<string>(commerce, 'simulation_mode', 'simulationMode'),
    },
    tradeInAssessment: {
      consentStatus: readFirst(tradeIn, 'consentStatus', 'consent_status'),
      capacity: readFirst(tradeIn, 'capacity'),
      color: readFirst(tradeIn, 'color'),
      scratches: readFirst(tradeIn, 'scratches'),
      liquidContact: readFirst(tradeIn, 'liquidContact', 'liquid_contact'),
      sideMarks: readFirst(tradeIn, 'sideMarks', 'side_marks'),
      partsSwapped: readFirst(tradeIn, 'partsSwapped', 'parts_swapped'),
      hasBoxCable: readFirst(tradeIn, 'hasBoxCable', 'has_box_cable'),
      batteryPct: readFirst(tradeIn, 'batteryPct', 'battery_pct'),
      appleWarranty: readFirst(tradeIn, 'appleWarranty', 'apple_warranty'),
      warrantyUntil: readFirst(tradeIn, 'warrantyUntil', 'warranty_until'),
      disqualified: readFirst(tradeIn, 'disqualified'),
      modelAccepted: readFirst(tradeIn, 'modelAccepted', 'model_accepted'),
    },
    quoteVersions: quotes,
    lastEvent: eventRow ? {
      action: eventRow.action,
      outcome: eventRow.outcome,
      createdAt: eventRow.created_at,
    } : null,
  };
};
