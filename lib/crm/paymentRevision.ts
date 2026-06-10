export type CardFeeGroup = 'visa_master' | 'outras';

export interface CardAllocation {
  brand: string;
  amount: number;
}

const toCents = (value: number) => Math.round((Number(value) + Number.EPSILON) * 100);
const fromCents = (value: number) => value / 100;

export const normalizeCardGroup = (brand: string): CardFeeGroup => {
  const normalized = String(brand ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  return ['visa', 'master', 'mastercard', 'visamaster'].includes(normalized)
    ? 'visa_master'
    : 'outras';
};

export const validateCardAllocations = (
  expectedTotal: number,
  cards: readonly CardAllocation[],
): boolean => (
  cards.length >= 1
  && cards.length <= 2
  && cards.every((card) => toCents(card.amount) > 0)
  && cards.reduce((sum, card) => sum + toCents(card.amount), 0) === toCents(expectedTotal)
);

export const splitSameGroupTaxedTotal = ({
  taxedTotal,
  installments,
  cards,
}: {
  taxedTotal: number;
  installments: number;
  cards: readonly CardAllocation[];
}) => {
  if (!validateCardAllocations(taxedTotal, cards)) {
    throw new Error('A divisão dos cartões deve fechar o total com taxa.');
  }
  const groups = new Set(cards.map((card) => normalizeCardGroup(card.brand)));
  if (groups.size !== 1) {
    throw new Error('Cartões de grupos diferentes exigem divisão do valor líquido.');
  }
  const safeInstallments = Math.max(1, Math.trunc(installments));
  return cards.map((card) => {
    const totalCents = toCents(card.amount);
    return {
      brand: card.brand,
      group: normalizeCardGroup(card.brand),
      total: fromCents(totalCents),
      installments: safeInstallments,
      installmentAmount: fromCents(Math.round(totalCents / safeInstallments)),
    };
  });
};

export const calculateMixedGroupCards = ({
  netTotal,
  installments,
  cards,
  feeRates,
}: {
  netTotal: number;
  installments: number;
  cards: readonly CardAllocation[];
  feeRates: Record<CardFeeGroup, number>;
}) => {
  if (!validateCardAllocations(netTotal, cards)) {
    throw new Error('A divisão dos cartões deve fechar o valor líquido financiado.');
  }
  const groups = new Set(cards.map((card) => normalizeCardGroup(card.brand)));
  if (groups.size < 2) {
    throw new Error('Use a divisão do total com taxa para cartões do mesmo grupo.');
  }
  const safeInstallments = Math.max(1, Math.trunc(installments));
  const results = cards.map((card) => {
    const group = normalizeCardGroup(card.brand);
    const netCents = toCents(card.amount);
    const rate = Math.max(0, Math.min(99.99, Number(feeRates[group]) || 0));
    const taxedCents = Math.round(netCents / (1 - rate / 100));
    return {
      brand: card.brand,
      group,
      netAmount: fromCents(netCents),
      feeRate: rate,
      taxedTotal: fromCents(taxedCents),
      feeAmount: fromCents(taxedCents - netCents),
      installments: safeInstallments,
      installmentAmount: fromCents(Math.round(taxedCents / safeInstallments)),
    };
  });

  return {
    netTotal: fromCents(toCents(netTotal)),
    taxedTotal: fromCents(results.reduce((sum, card) => sum + toCents(card.taxedTotal), 0)),
    cards: results,
  };
};
