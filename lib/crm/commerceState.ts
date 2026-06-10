export type TradeInField =
  | 'capacity'
  | 'color'
  | 'scratches'
  | 'liquid_contact'
  | 'side_marks'
  | 'parts_swapped'
  | 'has_box_cable'
  | 'battery_pct'
  | 'apple_warranty'
  | 'warranty_until';

export type TradeInConsentStatus =
  | 'not_started'
  | 'awaiting_consent'
  | 'granted'
  | 'declined';

export interface TradeInAssessment {
  consentStatus?: TradeInConsentStatus;
  capacity?: string | null;
  color?: string | null;
  scratches?: boolean | null;
  liquidContact?: boolean | null;
  sideMarks?: boolean | null;
  partsSwapped?: boolean | null;
  hasBoxCable?: boolean | null;
  batteryPct?: number | null;
  appleWarranty?: boolean | null;
  warrantyUntil?: string | null;
  disqualified?: boolean;
  modelAccepted?: boolean | null;
}

export type CommerceAction =
  | 'ask_tradein_consent'
  | 'send_tradein_questionnaire'
  | 'search_inventory'
  | 'simulate_quote'
  | 'ask_missing_fields';

export interface CommerceDecisionInput {
  hasTradeIn: boolean;
  tradeIn?: TradeInAssessment | null;
  desiredDeviceCount: number;
  quoteReady: boolean;
}

export const TRADE_IN_QUESTION_FIELDS: readonly TradeInField[] = [
  'capacity',
  'color',
  'scratches',
  'liquid_contact',
  'side_marks',
  'parts_swapped',
  'has_box_cable',
  'battery_pct',
  'apple_warranty',
  'warranty_until',
];

const TRADE_IN_QUESTIONS: Record<TradeInField, string> = {
  capacity: 'Qual armazenamento?',
  color: 'Qual a cor do seu aparelho?',
  scratches: 'Apresenta arranhões?',
  liquid_contact: 'Aparelho já teve contato com líquido?',
  side_marks: 'Apresenta marcas de uso na lateral?',
  parts_swapped: 'Já foi realizada a troca de alguma peça?',
  has_box_cable: 'Possui caixa e cabo originais?',
  battery_pct: 'Qual % de bateria?',
  apple_warranty: 'Está dentro da garantia Apple?',
  warranty_until: 'Se sim, até quando vai a garantia Apple?',
};

const isMissing = (value: unknown) => value === null || value === undefined || value === '';

export const getMissingTradeInFields = (assessment: TradeInAssessment): TradeInField[] => {
  const values: Record<Exclude<TradeInField, 'warranty_until'>, unknown> = {
    capacity: assessment.capacity,
    color: assessment.color,
    scratches: assessment.scratches,
    liquid_contact: assessment.liquidContact,
    side_marks: assessment.sideMarks,
    parts_swapped: assessment.partsSwapped,
    has_box_cable: assessment.hasBoxCable,
    battery_pct: assessment.batteryPct,
    apple_warranty: assessment.appleWarranty,
  };

  return TRADE_IN_QUESTION_FIELDS.filter((field) => {
    if (field === 'warranty_until') {
      return assessment.appleWarranty === true && isMissing(assessment.warrantyUntil);
    }
    return isMissing(values[field]);
  });
};

export const buildTradeInQuestionnaire = (missing: readonly TradeInField[]): string => (
  ['Perfeito! Copie a mensagem, preencha após cada R: e me envie:', ...missing.flatMap((field) => [
    '',
    TRADE_IN_QUESTIONS[field],
    'R:',
  ])].join('\n')
);

export const canSimulateTradeIn = (assessment: TradeInAssessment): boolean => (
  assessment.consentStatus === 'granted'
  && assessment.disqualified !== true
  && assessment.modelAccepted !== false
  && getMissingTradeInFields(assessment).length === 0
);

const normalize = (value: string) => value
  .normalize('NFD')
  .replace(/\p{Diacritic}/gu, '')
  .toLowerCase();

export const resolveSimulationMode = (
  message: string,
  desiredDeviceCount: number,
): 'single' | 'comparison' | 'bundle' => {
  if (desiredDeviceCount < 2) return 'single';
  const text = normalize(message);
  const jointPurchase = /\b(comprar|levar|fechar|reservar)\b.*\b(os dois|dois aparelhos|2 aparelhos|ambos)\b/.test(text);
  const comparison = /\b(ou|versus|vs|comparar|comparativo|qual compensa|diferenca|cada um)\b/.test(text);
  return jointPurchase && !comparison ? 'bundle' : 'comparison';
};

export const decideCommerceAction = (input: CommerceDecisionInput): CommerceAction => {
  if (input.hasTradeIn) {
    const assessment = input.tradeIn ?? {};
    if (assessment.consentStatus === 'not_started' || assessment.consentStatus === 'awaiting_consent' || !assessment.consentStatus) {
      return 'ask_tradein_consent';
    }
    if (!canSimulateTradeIn(assessment)) return 'send_tradein_questionnaire';
  }
  if (!input.quoteReady) {
    return input.desiredDeviceCount > 0 ? 'search_inventory' : 'ask_missing_fields';
  }
  return 'simulate_quote';
};
