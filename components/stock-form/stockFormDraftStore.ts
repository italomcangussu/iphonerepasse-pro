import type { StockItem } from '../../types';
import type { LocalPhotoQueueItem } from '../../utils/stockPhotoWorkflow';

export type StockFormTab = 'info' | 'condition' | 'financial';

/**
 * Estado completo do rascunho de edição/cadastro de aparelho mantido em memória
 * durante a sessão (inclui a fila local de fotos, que carrega objetos `File` não
 * serializáveis).
 */
export type StockFormDraftState = {
  formData: Partial<StockItem>;
  activeTab: StockFormTab;
  localPhotoQueue: LocalPhotoQueueItem[];
  isCameraCaptureMode: boolean;
};

/**
 * Subconjunto serializável persistido em `localStorage` para sobreviver ao
 * fechamento/reabertura do app. A fila local de fotos não é persistida porque
 * objetos `File` e URLs de preview não atravessam um reload.
 */
type PersistedStockFormDraft = {
  formData: Partial<StockItem>;
  activeTab: StockFormTab;
  savedAt: number;
};

const STORAGE_PREFIX = 'iphonerepasse:stock-form-draft:';
const DRAFT_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 dias

// Cache vivo da sessão (mantém a fila de fotos, que não é serializável).
const inMemoryDrafts = new Map<string, StockFormDraftState>();

const getStorage = (): Storage | null => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
};

export const buildStockFormDraftKey = (
  context: string,
  mode: 'new' | 'edit',
  itemId?: string,
): string => (mode === 'edit' ? `${context}:edit:${itemId ?? ''}` : `${context}:new`);

const loadPersistedDraft = (key: string): PersistedStockFormDraft | null => {
  const storage = getStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(STORAGE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedStockFormDraft;
    if (!parsed || typeof parsed !== 'object' || !parsed.formData) return null;
    if (typeof parsed.savedAt === 'number' && Date.now() - parsed.savedAt > DRAFT_TTL_MS) {
      storage.removeItem(STORAGE_PREFIX + key);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

/**
 * Lê o rascunho para uma chave. Prefere o cache da sessão (mais rico, com a fila
 * de fotos); se não houver, recupera o subconjunto persistido em `localStorage`.
 */
export const readStockFormDraft = (key: string): StockFormDraftState | null => {
  const live = inMemoryDrafts.get(key);
  if (live) return live;

  const persisted = loadPersistedDraft(key);
  if (!persisted) return null;

  return {
    formData: persisted.formData,
    activeTab: persisted.activeTab || 'info',
    localPhotoQueue: [],
    isCameraCaptureMode: false,
  };
};

/**
 * Persiste o rascunho nas duas camadas: cache da sessão (completo) e
 * `localStorage` (subconjunto serializável, para sobreviver ao reload do app).
 */
export const writeStockFormDraft = (key: string, state: StockFormDraftState): void => {
  inMemoryDrafts.set(key, state);

  const storage = getStorage();
  if (!storage) return;
  try {
    const payload: PersistedStockFormDraft = {
      formData: state.formData,
      activeTab: state.activeTab,
      savedAt: Date.now(),
    };
    storage.setItem(STORAGE_PREFIX + key, JSON.stringify(payload));
  } catch {
    // Ignora erros de quota/serialização — o cache em memória ainda vale na sessão.
  }
};

export const clearStockFormDraft = (key: string): void => {
  inMemoryDrafts.delete(key);
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(STORAGE_PREFIX + key);
  } catch {
    // no-op
  }
};

/** Usado em testes para isolar o estado entre casos. */
export const clearAllStockFormDrafts = (): void => {
  inMemoryDrafts.clear();
  const storage = getStorage();
  if (!storage) return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      if (key && key.startsWith(STORAGE_PREFIX)) keysToRemove.push(key);
    }
    keysToRemove.forEach((key) => storage.removeItem(key));
  } catch {
    // no-op
  }
};

const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(record[k])}`).join(',')}}`;
};

/** Compara dois estados de formulário ignorando a ordem das chaves. */
export const stockFormStateEquals = (a: unknown, b: unknown): boolean =>
  stableStringify(a) === stableStringify(b);
