import type { StockItem } from '../../types';
import type { LocalPhotoQueueItem } from '../../utils/stockPhotoWorkflow';

export type StockFormTab = 'info' | 'condition' | 'financial';

/**
 * Estado completo do rascunho de edição/cadastro de aparelho mantido em memória
 * durante a sessão (inclui a fila local de fotos, que carrega objetos `File` não
 * serializáveis).
 *
 * `baseFormData` é o estado "original" de quando o rascunho foi salvo (registro
 * em edição ou formulário em branco no cadastro). Guardá-lo permite restaurar
 * apenas os campos que o usuário realmente alterou, sem sobrescrever dados que
 * mudaram no registro desde então.
 */
export type StockFormDraftState = {
  formData: Partial<StockItem>;
  baseFormData?: Partial<StockItem>;
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
  baseFormData?: Partial<StockItem>;
  activeTab: StockFormTab;
  savedAt: number;
};

const STORAGE_PREFIX = 'iphonerepasse:stock-form-draft:';
const DRAFT_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 dias
const PERSIST_DEBOUNCE_MS = 400;

// Cache vivo da sessão (mantém a fila de fotos, que não é serializável).
const inMemoryDrafts = new Map<string, StockFormDraftState>();

// Gravações em `localStorage` são debounced (uma por chave) para não rodar
// `JSON.stringify` + `setItem` síncronos a cada tecla digitada. O cache em
// memória acima já é atualizado de forma síncrona, então a restauração dentro
// da mesma sessão nunca depende deste flush.
const pendingPersists = new Map<string, PersistedStockFormDraft>();
let persistTimer: ReturnType<typeof setTimeout> | null = null;

const getStorage = (): Storage | null => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
};

const flushPersistedDrafts = (): void => {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  if (pendingPersists.size === 0) return;

  const storage = getStorage();
  if (storage) {
    for (const [key, draft] of pendingPersists) {
      try {
        storage.setItem(STORAGE_PREFIX + key, JSON.stringify(draft));
      } catch {
        // Ignora erros de quota/serialização — o cache em memória ainda vale na sessão.
      }
    }
  }
  pendingPersists.clear();
};

// Garante que a última edição chegue ao `localStorage` mesmo se o app for
// fechado/escondido antes do debounce disparar (cenário central do recurso:
// o usuário sai do app sem salvar).
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('pagehide', flushPersistedDrafts);
  window.addEventListener('beforeunload', flushPersistedDrafts);
  if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flushPersistedDrafts();
    });
  }
}

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
    baseFormData: persisted.baseFormData,
    activeTab: persisted.activeTab || 'info',
    localPhotoQueue: [],
    isCameraCaptureMode: false,
  };
};

/**
 * Persiste o rascunho nas duas camadas: cache da sessão (completo, síncrono) e
 * `localStorage` (subconjunto serializável, gravado com debounce para sobreviver
 * ao reload do app sem penalizar a digitação).
 */
export const writeStockFormDraft = (key: string, state: StockFormDraftState): void => {
  inMemoryDrafts.set(key, state);

  const storage = getStorage();
  if (!storage) return;

  pendingPersists.set(key, {
    formData: state.formData,
    baseFormData: state.baseFormData,
    activeTab: state.activeTab,
    savedAt: Date.now(),
  });
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(flushPersistedDrafts, PERSIST_DEBOUNCE_MS);
};

export const clearStockFormDraft = (key: string): void => {
  inMemoryDrafts.delete(key);
  pendingPersists.delete(key);
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
  pendingPersists.clear();
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
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

/**
 * Retorna apenas os campos do rascunho que divergem da base de quando ele foi
 * salvo — ou seja, o que o usuário de fato alterou. Aplicando esse subconjunto
 * sobre o registro atual, campos intocados seguem o valor mais recente do
 * servidor e um rascunho idêntico à base resulta em objeto vazio (sem
 * "recuperação" falsa).
 */
export const collectChangedFields = (
  draftFormData: Partial<StockItem> | undefined,
  baseFormData: Partial<StockItem> | undefined,
): Partial<StockItem> => {
  const draft = (draftFormData ?? {}) as Record<string, unknown>;
  const base = (baseFormData ?? {}) as Record<string, unknown>;
  const changed: Record<string, unknown> = {};
  const keys = new Set<string>([...Object.keys(draft), ...Object.keys(base)]);
  keys.forEach((key) => {
    if (!stockFormStateEquals(draft[key], base[key])) {
      changed[key] = draft[key];
    }
  });
  return changed as Partial<StockItem>;
};
