import { HEADER_FIELDS, type AppData, type ShiftHeader } from './domain/types';

/** Completa com vazio os campos que não existiam quando o cabeçalho foi salvo (ex.: equipe, viatura, bodycam2). */
function normalizeHeader(raw: Partial<ShiftHeader> | null | undefined): ShiftHeader | null {
  if (!raw) return null;
  return Object.fromEntries(HEADER_FIELDS.map((k) => [k, typeof raw[k] === 'string' ? raw[k] : ''])) as ShiftHeader;
}

export const STORAGE_KEY = 'ferracine_prod:v2';

export type KeyValueStore = Pick<Storage, 'getItem' | 'setItem'>;

export function emptyData(): AppData {
  return { version: 2, header: null, ordens: [], draft: null, lastSheet: null };
}

/** Lê o estado salvo; qualquer dado ausente, corrompido ou de outra versão vira estado vazio. */
export function loadData(store: KeyValueStore): AppData {
  let raw: string | null;
  try {
    raw = store.getItem(STORAGE_KEY);
  } catch {
    return emptyData();
  }
  if (!raw) return emptyData();
  try {
    const parsed = JSON.parse(raw) as Partial<AppData> | null;
    if (!parsed || parsed.version !== 2 || !Array.isArray(parsed.ordens)) return emptyData();
    const last = parsed.lastSheet;
    const lastHeader = normalizeHeader(last?.header);
    return {
      version: 2,
      header: normalizeHeader(parsed.header),
      ordens: parsed.ordens,
      draft: parsed.draft ?? null,
      lastSheet: last && lastHeader ? { ...last, header: lastHeader } : null,
    };
  } catch {
    return emptyData();
  }
}

/** Grava o estado. Retorna false se o navegador recusar (cota cheia, modo privado). */
export function saveData(store: KeyValueStore, data: AppData): boolean {
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}
