/**
 * Espelho do estado no IndexedDB, gravado com `durability: 'strict'` (vai para o disco ao concluir a transação).
 * O app continua lendo e gravando no localStorage (síncrono, abre na hora), mas o Chrome grava o localStorage em disco
 * com atraso: se o Android matar o app logo depois de um toque, o último passo podia se perder. Cada gravação leva um
 * número de sequência; ao abrir, se o espelho tiver um número maior que o do localStorage, ele é o estado mais novo.
 * Sem IndexedDB (testes de unidade, navegador antigo) tudo aqui vira no-op.
 */

const BANCO = 'ferracine_prod';
const LOJA = 'estado';
const CHAVE = 'v3';

/** Estado gravado: o JSON do AppData e o número da gravação. */
export interface Gravacao {
  seq: number;
  json: string;
}

/** Usa o espelho só se ele for mais novo que o localStorage (o contador do localStorage não chegou ao disco). */
export function espelhoMaisNovo(local: number, espelho: Gravacao | null): espelho is Gravacao {
  return !!espelho && espelho.seq > local && typeof espelho.json === 'string';
}

let banco: Promise<IDBDatabase | null> | null = null;

function abrir(): Promise<IDBDatabase | null> {
  banco ??= new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const req = indexedDB.open(BANCO, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(LOJA);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return banco;
}

/** Grava sem bloquear o app; falha calada (o localStorage continua valendo). */
export function gravarEspelho(g: Gravacao): void {
  void abrir().then((db) => {
    if (!db) return;
    try {
      const tx = db.transaction(LOJA, 'readwrite', { durability: 'strict' });
      tx.objectStore(LOJA).put(g, CHAVE);
    } catch {
      // cota cheia, banco fechado: o localStorage continua valendo
    }
  });
}

export function lerEspelho(): Promise<Gravacao | null> {
  return abrir().then(
    (db) =>
      new Promise<Gravacao | null>((resolve) => {
        if (!db) return resolve(null);
        try {
          const req = db.transaction(LOJA, 'readonly').objectStore(LOJA).get(CHAVE);
          req.onsuccess = () => {
            const v = req.result as Partial<Gravacao> | undefined;
            resolve(v && typeof v.seq === 'number' && typeof v.json === 'string' ? { seq: v.seq, json: v.json } : null);
          };
          req.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      }),
  );
}
