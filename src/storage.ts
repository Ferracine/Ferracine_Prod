import { escolha, questionsFor } from './domain/catalog';
import { HEADER_FIELDS, SHEETS_KEPT, type Answer, type AppData, type ClosedSheet, type Eletricista, type OrdemServico, type ServiceType, type ShiftHeader, type Tecnico, type OSDraft } from './domain/types';

export const STORAGE_KEY = 'ferracine_prod:v3';

export type KeyValueStore = Pick<Storage, 'getItem' | 'setItem'>;

export function emptyData(): AppData {
  return { version: 3, header: null, ordens: [], draft: null, sheets: [], lastHeader: null, tecnicos: [], eletricistas: [] };
}

/** Completa com vazio os campos que não existiam quando o cabeçalho foi salvo (ex.: equipe, viatura, bodycam2). */
function normalizeHeader(raw: Partial<ShiftHeader> | null | undefined): ShiftHeader | null {
  if (!raw) return null;
  return Object.fromEntries(HEADER_FIELDS.map((k) => [k, typeof raw[k] === 'string' ? raw[k] : ''])) as ShiftHeader;
}

function normalizeTecnicos(raw: unknown): Tecnico[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((t): t is Tecnico => !!t && typeof t.id === 'string' && typeof t.nome === 'string' && typeof t.telefone === 'string');
}

/**
 * Eletricistas cadastrados. Sem a lista (até a 1.4.4), o cadastro começa com quem estava nos últimos cabeçalhos, para
 * a dupla de sempre já aparecer para escolher.
 */
function normalizeEletricistas(raw: unknown, ...headers: (ShiftHeader | null)[]): Eletricista[] {
  if (Array.isArray(raw)) {
    return raw.filter((e): e is Eletricista => !!e && typeof e.id === 'string' && typeof e.nome === 'string' && typeof e.matricula === 'string');
  }
  const out: Eletricista[] = [];
  for (const h of headers) {
    if (!h) continue;
    for (const [nome, matricula] of [[h.nome1, h.mat1], [h.nome2, h.mat2]] as const) {
      const n = nome.trim().toUpperCase();
      if (n && !out.some((e) => e.nome === n)) out.push({ id: `ele-migrado-${out.length + 1}`, nome: n, matricula: matricula.trim().toUpperCase() });
    }
  }
  return out;
}

/** `undefined` = chave ausente; `null` = ilegível (corrompida ou armazenamento indisponível). */
function readJson(store: KeyValueStore, key: string): unknown {
  try {
    const raw = store.getItem(key);
    return raw === null ? undefined : JSON.parse(raw);
  } catch {
    return null;
  }
}

/** OS ou rascunho com tipo conhecido e respostas; o resto (gravação cortada, edição à mão) é descartado. */
function isValidOS(o: unknown): o is OrdemServico {
  if (!o || typeof o !== 'object') return false;
  const { serviceType, answers } = o as Partial<OrdemServico>;
  return (serviceType === 'COMERCIAL' || serviceType === 'OCORRENCIA') && !!answers && typeof answers === 'object';
}

function normalizeOrdens(raw: unknown): OrdemServico[] {
  return Array.isArray(raw) ? raw.filter(isValidOS).map(normalizeOS) : [];
}

/**
 * Rascunho salvo pelo antigo assistente (até a 1.3.0): o número respondido em "Qual número da Ordem de serviço?"
 * ficava só na resposta. A tela da OS esconde essa pergunta e usa o campo do topo, então o número vai para ele, e a
 * resposta sai do rascunho (senão, a cada abertura, voltaria por cima do número corrigido no campo).
 */
function normalizeDraft(raw: OSDraft | null | undefined): OSDraft | null {
  if (!isValidOS(raw)) return null;
  const draft = { ...raw, answers: migrateMeters(raw.serviceType, raw.answers) };
  const q = questionsFor(draft.serviceType).find((x) => x.prefillOS);
  const ans = q ? draft.answers[q.id] : undefined;
  if (!q || !ans) return draft;
  const { [q.id]: _migrada, ...answers } = draft.answers;
  const answered = ans.kind === 'text' ? ans.value.trim() : '';
  return { ...draft, answers, osNumber: answered || draft.osNumber };
}

/** Folha recém-encerrada no topo do histórico; passando de SHEETS_KEPT, a mais antiga sai. */
export function pushSheet(sheets: readonly ClosedSheet[], sheet: ClosedSheet): ClosedSheet[] {
  return [sheet, ...sheets].slice(0, SHEETS_KEPT);
}

/** Folha guardada no formato atual; sem cabeçalho válido, é descartada (não dá para gerar o PDF). */
function normalizeSheet(s: ClosedSheet | null | undefined): ClosedSheet[] {
  const header = normalizeHeader(s?.header);
  if (!s || !header) return [];
  return [{ ...s, header, ordens: normalizeOrdens(s.ordens), tecnicos: normalizeTecnicos(s.tecnicos) }];
}

/** Lê o estado salvo; dado ausente ou corrompido vira estado vazio. */
export function loadData(store: KeyValueStore): AppData {
  // `lastSheet`: até a 1.4.4 só a última folha encerrada era guardada; vira o primeiro item do histórico.
  const current = readJson(store, STORAGE_KEY) as (Partial<AppData> & { lastSheet?: ClosedSheet | null }) | null | undefined;
  if (current?.version === 3 && Array.isArray(current.ordens)) {
    const sheets = Array.isArray(current.sheets) ? current.sheets : current.lastSheet ? [current.lastSheet] : [];
    const header = normalizeHeader(current.header);
    const lastHeader = normalizeHeader(current.lastHeader);
    return {
      version: 3,
      header,
      ordens: normalizeOrdens(current.ordens),
      draft: normalizeDraft(current.draft),
      sheets: sheets.flatMap(normalizeSheet).slice(0, SHEETS_KEPT),
      lastHeader,
      tecnicos: normalizeTecnicos(current.tecnicos),
      eletricistas: normalizeEletricistas(current.eletricistas, header, lastHeader),
    };
  }
  return emptyData();
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

/**
 * Medidores das versões anteriores no formato atual.
 * - Comercial até a 1.4.4 (ver abaixo): vira medidor da UC (`medidorInstNum`/`leituraInst`) + "Foi instalado novo
 *   medidor?" (`novoMedidor`, `novoMedidorNum`/`novoLeitura`), com o mesmo Espelho de Campo de antes.
 * - Ocorrência: a 1.4.1 tinha SIM/NÃO + número e a 1.4.2/1.4.3 só o número, as duas em `medidorInst`; vira
 *   `medidorInstNum` (NÃO ou SIM sem número ficam em branco).
 */
function migrateMeters(type: ServiceType, answers: Record<string, Answer>): Record<string, Answer> {
  const out = { ...answers };
  const numero = (ans: Answer | undefined): Answer | undefined => {
    if (ans?.kind === 'text') return ans;
    const n = ans?.kind === 'choice' && ans.choice === 'Sim' ? (ans.detail ?? '').trim() : '';
    return n ? { kind: 'text', value: n } : undefined;
  };
  if (type === 'OCORRENCIA') {
    if (out.medidorInst) {
      out.medidorInstNum = numero(out.medidorInst) ?? { kind: 'skipped' };
      delete out.medidorInst;
    }
    return out;
  }
  // Comercial até a 1.4.4: "Foi instalado medidor?"/"Foi retirado medidor?" (≤1.4.3 com o número junto, "Se sim qual
  // número?") → atual: medidor da UC + "Foi instalado novo medidor?". O Espelho de Campo sai igual ao de antes.
  if (!['medidorInst', 'medidorRet', 'medidorRetNum', 'leituraRet'].some((k) => k in out)) return out;
  for (const [id, num] of [['medidorInst', 'medidorInstNum'], ['medidorRet', 'medidorRetNum']] as const) {
    const ans = out[id];
    if (ans?.kind !== 'choice' || ans.detail === undefined) continue;
    out[id] = { kind: 'choice', choice: ans.choice };
    const n = numero(ans);
    if (n) out[num] = n;
  }
  const preenchido = (id: string) => {
    const a = out[id];
    return a?.kind === 'text' && a.value.trim() !== '';
  };
  const vazio: Answer = { kind: 'skipped' };
  /** Resposta de texto preenchida e visível na 1.4.4 (`ok`); senão, em branco. */
  const pega = (id: string, ok: boolean): Answer => (ok && preenchido(id) ? out[id]! : vazio);
  // Até a 1.4.3 a leitura não dependia do SIM/NÃO: número ou leitura preenchidos contam como "houve medidor".
  let inst = escolha(out, 'medidorInst');
  let ret = escolha(out, 'medidorRet');
  if (ret !== 'Sim' && (preenchido('medidorRetNum') || preenchido('leituraRet'))) ret = 'Sim';
  // Na 1.4.4 o número/leitura do instalado apareciam com instalou=SIM ou com os dois NÃO (medidor da UC).
  const instVisivel = () => inst === 'Sim' || (inst === 'Não' && ret === 'Não');
  if (!instVisivel() && (preenchido('medidorInstNum') || preenchido('leituraInst'))) inst = 'Sim';
  const iNum = pega('medidorInstNum', instVisivel());
  const iLei = pega('leituraInst', instVisivel());
  const rNum = pega('medidorRetNum', ret === 'Sim');
  const rLei = pega('leituraRet', ret === 'Sim');
  for (const k of ['medidorInst', 'medidorRet', 'medidorRetNum', 'leituraRet']) delete out[k];
  if (ret === 'Sim' || inst === 'Sim') {
    // Troca (ou só instalação): o instalado é o "novo"; o retirado é o medidor que estava na UC.
    Object.assign(out, { medidorInstNum: rNum, leituraInst: rLei, novoMedidor: { kind: 'choice', choice: 'Sim' }, novoMedidorNum: iNum, novoLeitura: iLei });
  } else {
    Object.assign(out, { medidorInstNum: iNum, leituraInst: iLei });
    if (inst === 'Não') out.novoMedidor = { kind: 'choice', choice: 'Não' };
  }
  return out;
}

/** OS lida do aparelho: medidores das versões anteriores no formato atual. */
function normalizeOS(os: OrdemServico): OrdemServico {
  return { ...os, answers: migrateMeters(os.serviceType, os.answers) };
}
