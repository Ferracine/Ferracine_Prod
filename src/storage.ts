import type { AppData } from './domain/types';

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
    return {
      version: 2,
      header: parsed.header ?? null,
      ordens: parsed.ordens,
      draft: parsed.draft ?? null,
      lastSheet: parsed.lastSheet ?? null,
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
