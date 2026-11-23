export type ProductSearchOption = {
  id: string;
  label: string;
  subLabel?: string;
};

export const normalizeProductSearchText = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

// ---------------------------------------------------------------------------
// Consulta → termos. "13 256 azul" vira geração 13 + 256 GB + cor azul, em
// qualquer ordem e com ou sem espaço ("13pro", "256gb", "1tb").
// ---------------------------------------------------------------------------

type SearchTerm =
  | { kind: 'generation'; value: string }
  | { kind: 'variant'; value: string }
  | { kind: 'capacity'; value: string }
  | { kind: 'digits'; value: string }
  | { kind: 'word'; value: string; synonyms: string[] };

const VARIANT_WORDS = new Set(['pro', 'max', 'plus', 'mini', 'se', 'air', 'ultra']);
const VARIANT_ALIASES: Record<string, string[]> = { promax: ['pro', 'max'], pm: ['pro', 'max'] };
const GB_CAPACITIES = new Set(['16', '32', '64', '128', '256', '512']);
const TB_CAPACITIES = new Set(['1', '2']);
const BARE_CAPACITY_NUMBERS = new Set(['32', '64', '128', '256', '512']);
const GB_SUFFIXES = new Set(['gb', 'g']);
const TB_SUFFIXES = new Set(['tb', 't']);
const MAX_GENERATION_DIGITS = 2;

const COLOR_SYNONYM_GROUPS = [
  ['preto', 'black'],
  ['branco', 'white'],
  ['azul', 'blue'],
  ['vermelho', 'red'],
  ['verde', 'green'],
  ['rosa', 'pink'],
  ['roxo', 'purple'],
  ['dourado', 'gold'],
  ['prata', 'silver'],
  ['cinza', 'gray', 'grey'],
  ['grafite', 'graphite'],
  ['estelar', 'starlight'],
  ['meia noite', 'midnight'],
  ['amarelo', 'yellow'],
  ['titanio', 'titanium'],
  ['deserto', 'desert']
];

const synonymsOf = (word: string) =>
  COLOR_SYNONYM_GROUPS.find((group) => group.includes(word))?.filter((synonym) => synonym !== word) ?? [];

const splitIntoRuns = (query: string) => query.match(/\d+|[a-z]+/g) ?? [];

const capacityFromNumberAndSuffix = (digits: string, suffix: string | undefined): string | null => {
  if (suffix && GB_SUFFIXES.has(suffix) && GB_CAPACITIES.has(digits)) return `${digits}gb`;
  if (suffix && TB_SUFFIXES.has(suffix) && TB_CAPACITIES.has(digits)) return `${digits}tb`;
  return null;
};

const classifyNumber = (digits: string): SearchTerm => {
  if (BARE_CAPACITY_NUMBERS.has(digits)) return { kind: 'capacity', value: `${digits}gb` };
  if (digits.length <= MAX_GENERATION_DIGITS) return { kind: 'generation', value: String(Number(digits)) };
  return { kind: 'digits', value: digits };
};

const classifyWord = (word: string): SearchTerm[] => {
  const aliased = VARIANT_ALIASES[word];
  if (aliased) return aliased.map((value) => ({ kind: 'variant', value }));
  if (VARIANT_WORDS.has(word)) return [{ kind: 'variant', value: word }];
  return [{ kind: 'word', value: word, synonyms: synonymsOf(word) }];
};

const parseSearchTerms = (normalizedQuery: string): SearchTerm[] => {
  const runs = splitIntoRuns(normalizedQuery);
  const terms: SearchTerm[] = [];

  for (let index = 0; index < runs.length; index += 1) {
    const run = runs[index];
    if (!/^\d/.test(run)) {
      terms.push(...classifyWord(run));
      continue;
    }
    const nextRun = runs[index + 1];
    const capacity = capacityFromNumberAndSuffix(run, nextRun);
    if (capacity) {
      terms.push({ kind: 'capacity', value: capacity });
      index += 1;
      continue;
    }
    // "13gb" é erro de digitação comum para "iPhone 13": o sufixo não vale.
    if (nextRun && GB_SUFFIXES.has(nextRun) && run.length <= MAX_GENERATION_DIGITS) index += 1;
    terms.push(classifyNumber(run));
  }

  return terms;
};

// ---------------------------------------------------------------------------
// Texto do aparelho → palavras comparáveis ("128 GB" vira "128gb").
// ---------------------------------------------------------------------------

type ProductText = { labelWords: string[]; labelText: string; allWords: string[]; allText: string };

const toComparableText = (text: string) =>
  normalizeProductSearchText(text).replace(/(\d+)\s*(gb|tb)\b/g, '$1$2');

const toWords = (comparableText: string) => comparableText.split(/[^a-z0-9]+/).filter(Boolean);

const buildProductText = (label: string, details: string): ProductText => {
  const labelWords = toWords(toComparableText(label));
  const allWords = [...labelWords, ...toWords(toComparableText(details))];
  return { labelWords, labelText: labelWords.join(' '), allWords, allText: allWords.join(' ') };
};

const hasWordStartingWith = (words: string[], prefix: string) => words.some((word) => word.startsWith(prefix));

type WordTerm = Extract<SearchTerm, { kind: 'word' }>;
type WordSource = { words: string[]; text: string };

const matchesWordTerm = (source: WordSource, term: WordTerm) =>
  hasWordStartingWith(source.words, term.value) || term.synonyms.some((synonym) => source.text.includes(synonym));

const matchesCapacity = (words: string[], capacity: string) =>
  words.includes(capacity) || words.includes(capacity.replace(/gb$/, ''));

type TermMatch = 'label' | 'details' | null;

const matchWordTerm = (product: ProductText, term: WordTerm): TermMatch => {
  if (matchesWordTerm({ words: product.labelWords, text: product.labelText }, term)) return 'label';
  return matchesWordTerm({ words: product.allWords, text: product.allText }, term) ? 'details' : null;
};

const matchTerm = (product: ProductText, term: SearchTerm): TermMatch => {
  switch (term.kind) {
    case 'generation':
    case 'variant':
      return product.labelWords.includes(term.value) ? 'label' : null;
    case 'capacity':
      return matchesCapacity(product.allWords, term.value) ? 'label' : null;
    case 'digits':
      return product.allWords.some((word) => word.includes(term.value)) ? 'details' : null;
    case 'word':
      return matchWordTerm(product, term);
  }
};

// ---------------------------------------------------------------------------
// Ordenação: primeiro o que bateu só no nome, depois a variante mais próxima
// do que foi digitado ("13" → 13, 13 Pro, 13 Pro Max; "13 pro" → 13 Pro, 13 Pro Max).
// ---------------------------------------------------------------------------

type ProductAccessors<T> = { getLabel: (item: T) => string; getDetails: (item: T) => string };
type RankedItem<T> = { item: T; index: number; matchedOnlyInLabel: boolean; extraVariants: number; label: string };
type RankOrder = { tieBreak: 'label' | 'input'; preferFewerVariants: boolean };

const countExtraVariants = (labelWords: string[], requestedVariants: Set<string>) =>
  labelWords.filter((word) => VARIANT_WORDS.has(word) && !requestedVariants.has(word)).length;

const rankProduct = (product: ProductText, terms: SearchTerm[]) => {
  const matches = terms.map((term) => matchTerm(product, term));
  if (matches.includes(null)) return null;

  const requestedVariants = new Set(terms.filter((term) => term.kind === 'variant').map((term) => term.value));
  return {
    matchedOnlyInLabel: matches.every((match) => match === 'label'),
    extraVariants: countExtraVariants(product.labelWords, requestedVariants),
    label: product.labelText
  };
};

const compareRanked = <T,>(order: RankOrder) => (a: RankedItem<T>, b: RankedItem<T>) => {
  if (a.matchedOnlyInLabel !== b.matchedOnlyInLabel) return a.matchedOnlyInLabel ? -1 : 1;
  if (order.preferFewerVariants && a.extraVariants !== b.extraVariants) return a.extraVariants - b.extraVariants;
  if (order.tieBreak === 'label') return a.label.localeCompare(b.label, 'pt-BR') || a.index - b.index;
  return a.index - b.index;
};

const containsWholeQuery = (label: string, details: string, normalizedQuery: string) =>
  normalizeProductSearchText(`${label} ${details}`).includes(normalizedQuery);

type RankRequest<T> = ProductAccessors<T> & { items: T[]; normalizedQuery: string; tieBreak: RankOrder['tieBreak'] };

const rankByTerms = <T,>(request: RankRequest<T>, terms: SearchTerm[]) =>
  request.items.flatMap((item, index): RankedItem<T>[] => {
    const rank = rankProduct(buildProductText(request.getLabel(item), request.getDetails(item)), terms);
    return rank ? [{ item, index, ...rank }] : [];
  });

const rankProductSearchItems = <T,>(request: RankRequest<T>) => {
  const { items, normalizedQuery, getLabel, getDetails, tieBreak } = request;
  const terms = parseSearchTerms(normalizedQuery);
  const ranked = rankByTerms(request, terms);
  if (terms.length === 0 || ranked.length === 0) {
    return items.filter((item) => containsWholeQuery(getLabel(item), getDetails(item), normalizedQuery));
  }

  const preferFewerVariants = terms.some((term) => term.kind === 'generation');
  return ranked.sort(compareRanked({ tieBreak, preferFewerVariants })).map((entry) => entry.item);
};

/** Diz se um aparelho (nome + detalhes como cor, capacidade, IMEI) atende à busca digitada. */
export const matchesProductSearch = (label: string, details: string, query: string) => {
  const normalizedQuery = normalizeProductSearchText(query);
  if (normalizedQuery.length === 0) return true;
  const terms = parseSearchTerms(normalizedQuery);
  if (terms.length > 0 && rankProduct(buildProductText(label, details), terms)) return true;
  return containsWholeQuery(label, details, normalizedQuery);
};

export const filterProductSearchOptions = (options: ProductSearchOption[], query: string) => {
  const normalizedQuery = normalizeProductSearchText(query);
  if (normalizedQuery.length < 2) return [];
  return rankProductSearchItems({
    items: options,
    normalizedQuery,
    getLabel: (option) => option.label,
    getDetails: (option) => option.subLabel || '',
    tieBreak: 'label'
  });
};

export const filterStockItemsByProductSearch = <T,>(
  items: T[],
  query: string,
  getLabel: (item: T) => string,
  getDetails: (item: T) => string,
  compareDefault: (a: T, b: T) => number
) => {
  const sortedItems = [...items].sort(compareDefault);
  const normalizedQuery = normalizeProductSearchText(query);
  if (normalizedQuery.length === 0) return sortedItems;
  return rankProductSearchItems({ items: sortedItems, normalizedQuery, getLabel, getDetails, tieBreak: 'input' });
};
