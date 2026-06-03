export type ProductSearchOption = {
  id: string;
  label: string;
  subLabel?: string;
};

export const normalizeProductSearchText = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const getIphoneVariantRank = (label: string) => {
  const normalizedLabel = normalizeProductSearchText(label);
  if (/\bpro max\b/.test(normalizedLabel)) return 2;
  if (/\bpro\b/.test(normalizedLabel)) return 1;
  return 0;
};

const compareIphoneVariantSearchOrder = (a: string, b: string) => {
  const variantDiff = getIphoneVariantRank(a) - getIphoneVariantRank(b);
  if (variantDiff !== 0) return variantDiff;
  return normalizeProductSearchText(a).localeCompare(normalizeProductSearchText(b), 'pt-BR');
};

const filterProductSearchItems = <T,>(
  items: T[],
  query: string,
  getLabel: (item: T) => string,
  getDetails: (item: T) => string
) => {
  const normalizedQuery = normalizeProductSearchText(query);

  const generationOnly = normalizedQuery.match(/^\d{1,2}$/)?.[0];
  if (generationOnly) {
    const generationRegex = new RegExp(`\\biphone\\s+${generationOnly}\\b`);
    const generationMatches = items.filter((item) =>
      generationRegex.test(normalizeProductSearchText(getLabel(item)))
    );

    if (generationMatches.length > 0) {
      return [...generationMatches].sort((a, b) =>
        compareIphoneVariantSearchOrder(getLabel(a), getLabel(b))
      );
    }
  }

  const labelMatches: T[] = [];
  const detailMatches: T[] = [];

  items.forEach((item) => {
    if (normalizeProductSearchText(getLabel(item)).includes(normalizedQuery)) {
      labelMatches.push(item);
      return;
    }
    if (normalizeProductSearchText(getDetails(item)).includes(normalizedQuery)) {
      detailMatches.push(item);
    }
  });

  return [...labelMatches, ...detailMatches];
};

export const filterProductSearchOptions = (options: ProductSearchOption[], query: string) => {
  const normalizedQuery = normalizeProductSearchText(query);
  if (normalizedQuery.length < 2) return [];
  return filterProductSearchItems(options, normalizedQuery, (option) => option.label, (option) => option.subLabel || '');
};

export const filterStockItemsByProductSearch = <T,>(
  items: T[],
  query: string,
  getLabel: (item: T) => string,
  getDetails: (item: T) => string,
  compareDefault: (a: T, b: T) => number
) => {
  const normalizedQuery = normalizeProductSearchText(query);
  if (normalizedQuery.length === 0) return [...items].sort(compareDefault);
  return filterProductSearchItems(items, normalizedQuery, getLabel, getDetails);
};
