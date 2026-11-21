import { LEGACY_EXTRA_LABELS, LEGACY_QUESTION_IDS, questionsFor } from './domain/catalog';
import { HEADER_FIELDS, type Answer, type AppData, type ClosedSheet, type OrdemServico, type ServiceType, type ShiftHeader, type Tecnico, type OSDraft } from './domain/types';

export const STORAGE_KEY = 'ferracine_prod:v3';
/** Chave da versão 2 (catálogo antigo, técnicos fixos): lida uma vez e migrada. */
export const LEGACY_STORAGE_KEY = 'ferracine_prod:v2';

export type KeyValueStore = Pick<Storage, 'getItem' | 'setItem'>;

export function emptyData(): AppData {
  return { version: 3, header: null, ordens: [], draft: null, lastSheet: null, lastHeader: null, tecnicos: [] };
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

/** `undefined` = chave ausente; `null` = ilegível (corrompida ou armazenamento indisponível). */
function readJson(store: KeyValueStore, key: string): unknown {
  try {
    const raw = store.getItem(key);
    return raw === null ? undefined : JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Lê o estado salvo; dado corrompido vira estado vazio. A versão 2 só é migrada se a 3 nunca foi gravada:
 * depois da primeira gravação, um dado ruim não pode ressuscitar um turno antigo.
 */
/**
 * Rascunho salvo pelo antigo assistente (até a 1.3.0): o número respondido em "Qual número da Ordem de serviço?"
 * ficava só na resposta. A tela da OS esconde essa pergunta e usa o campo do topo, então o número vai para ele.
 */
function normalizeDraft(raw: OSDraft | null | undefined): OSDraft | null {
  if (!raw) return null;
  const draft = { ...raw, answers: meterAsText(raw.serviceType, raw.answers) };
  const q = questionsFor(draft.serviceType).find((x) => x.prefillOS);
  const ans = q ? draft.answers[q.id] : undefined;
  const answered = ans?.kind === 'text' ? ans.value.trim() : '';
  return answered ? { ...draft, osNumber: answered } : draft;
}

export function loadData(store: KeyValueStore): AppData {
  const current = readJson(store, STORAGE_KEY) as Partial<AppData> | null | undefined;
  if (current === undefined) {
    const legacy = readJson(store, LEGACY_STORAGE_KEY) as LegacyData | null | undefined;
    return legacy?.version === 2 && Array.isArray(legacy.ordens) ? migrateV2(legacy) : emptyData();
  }
  if (current?.version === 3 && Array.isArray(current.ordens)) {
    const last = current.lastSheet;
    const lastSheetHeader = normalizeHeader(last?.header);
    return {
      version: 3,
      header: normalizeHeader(current.header),
      ordens: current.ordens.map(normalizeOS),
      draft: normalizeDraft(current.draft),
      lastSheet:
        last && lastSheetHeader
          ? { ...last, header: lastSheetHeader, ordens: (last.ordens ?? []).map(normalizeOS), tecnicos: normalizeTecnicos(last.tecnicos) }
          : null,
      lastHeader: normalizeHeader(current.lastHeader),
      tecnicos: normalizeTecnicos(current.tecnicos),
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

// --- Migração da versão 2 -------------------------------------------------

interface LegacyData {
  version: 2;
  header?: Partial<ShiftHeader> | null;
  ordens: OrdemServico[];
  /** `editingId`: na v2, a edição de uma OS concluída também era um rascunho (do antigo assistente). */
  draft?: (OSDraft & { editingId?: string }) | null;
  lastSheet?: { header?: Partial<ShiftHeader>; ordens?: OrdemServico[]; fechadaEm?: string } | null;
}

/** Texto de uma resposta antiga sem pergunta equivalente (vazio se pulada). */
function legacyText(ans: Answer): string {
  if (ans.kind === 'text') return ans.value.trim();
  if (ans.kind === 'choice') return ans.choice === 'Sim' && ans.detail?.trim() ? ans.detail.trim() : ans.choice;
  return '';
}

/**
 * Respostas com os ids do catálogo antigo → ids atuais. As de perguntas que deixaram de existir (medidor e leitura
 * retirados da ocorrência, 2º KM etc.) viram o texto `infoLegada`, que o espelho põe em INFO ADICIONAL.
 */
function migrateAnswers(type: ServiceType, answers: Record<string, Answer>): { answers: Record<string, Answer>; infoLegada?: string } {
  const map = LEGACY_QUESTION_IDS[type];
  const out: Record<string, Answer> = {};
  const extras: string[] = [];
  for (const [oldId, ans] of Object.entries(answers ?? {})) {
    const id = map[oldId];
    if (id) out[id] = ans;
    else {
      const label = LEGACY_EXTRA_LABELS[oldId];
      const text = legacyText(ans);
      if (label && text) extras.push(`${label}: ${text}`);
    }
  }
  return extras.length ? { answers: out, infoLegada: extras.join('; ') } : { answers: out };
}

/**
 * Até a 1.4.0 a ocorrência não tinha medidor instalado nem leitura: OSs migradas da v2 guardaram essas respostas
 * como texto em `infoLegada` ("Medidor instalado: M-1; Leitura medidor instalado: 123"). Agora há pergunta para
 * elas: o texto volta para a resposta (coluna própria no PDF, campo preenchido no lápis) e sai da INFO ADICIONAL.
 */
const LEGACY_TEXT_TO_QUESTION: Record<string, string> = { 'Medidor instalado': 'medidorInst', 'Leitura medidor instalado': 'leituraInst' };

/**
 * Na 1.4.1 o medidor da ocorrência era "Foi instalado medidor? Se sim qual número?" (SIM/NÃO + número). Agora é só
 * o número: SIM com número vira o número; NÃO ou SIM sem número ficam em branco.
 */
function meterAsText(type: ServiceType, answers: Record<string, Answer>): Record<string, Answer> {
  const ans = answers.medidorInst;
  if (type !== 'OCORRENCIA' || ans?.kind !== 'choice') return answers;
  const numero = ans.choice === 'Sim' ? (ans.detail ?? '').trim() : '';
  return { ...answers, medidorInst: numero ? { kind: 'text', value: numero } : { kind: 'skipped' } };
}

/** OS lida do aparelho: medidor das versões anteriores no formato atual. */
function normalizeOS(os: OrdemServico): OrdemServico {
  // Primeiro o formato da 1.4.1 (NÃO vira em branco), depois o texto legado: o resultado não muda entre carregamentos.
  return adoptLegacyMeter({ ...os, answers: meterAsText(os.serviceType, os.answers) });
}

function adoptLegacyMeter(os: OrdemServico): OrdemServico {
  if (os.serviceType !== 'OCORRENCIA' || !os.infoLegada) return os;
  const labels = [...Object.keys(LEGACY_TEXT_TO_QUESTION), ...Object.values(LEGACY_EXTRA_LABELS)];
  // "Rótulo: valor; Rótulo: valor": um valor com "; " dentro continua no item anterior.
  const items: string[] = [];
  for (const part of os.infoLegada.split('; ')) {
    if (items.length && !labels.some((l) => part.startsWith(`${l}: `))) items[items.length - 1] += `; ${part}`;
    else items.push(part);
  }
  const answers = { ...os.answers };
  const rest = items.filter((item) => {
    const label = Object.keys(LEGACY_TEXT_TO_QUESTION).find((l) => item.startsWith(`${l}: `));
    const id = label && LEGACY_TEXT_TO_QUESTION[label];
    if (!label || !id || (answers[id] && answers[id].kind !== 'skipped')) return true;
    const value = item.slice(label.length + 2).trim();
    // "Sim" sem número ou "Não": não há número para o campo, e soltos na folha não dizem nada.
    if (!(id === 'medidorInst' && (value === 'Sim' || value === 'Não'))) answers[id] = { kind: 'text', value };
    return false;
  });
  const { infoLegada: _antigo, ...semInfo } = os;
  return rest.length ? { ...semInfo, answers, infoLegada: rest.join('; ') } : { ...semInfo, answers };
}

function migrateOS(os: OrdemServico): OrdemServico {
  const m = migrateAnswers(os.serviceType, os.answers);
  return { ...os, ...m, answers: meterAsText(os.serviceType, m.answers) };
}

/**
 * Na versão 2 o líder era o texto "TEC. NOME - TELEFONE" de uma lista fixa. Agora a lista é cadastrada no
 * aparelho: cada líder usado vira um técnico cadastrado e o cabeçalho passa a guardar o id dele.
 */
function migrateV2(old: LegacyData): AppData {
  const tecnicos: Tecnico[] = [];
  const liderId = (label: string): string => {
    if (!label) return '';
    let tec = tecnicos.find((t) => `${t.nome} - ${t.telefone}` === label);
    if (!tec) {
      const i = label.lastIndexOf(' - ');
      tec = { id: `tec-migrado-${tecnicos.length + 1}`, nome: i < 0 ? label : label.slice(0, i), telefone: i < 0 ? '' : label.slice(i + 3) };
      tecnicos.push(tec);
    }
    return tec.id;
  };
  const header = (raw: Partial<ShiftHeader> | null | undefined): ShiftHeader | null => {
    const h = normalizeHeader(raw);
    return h && { ...h, lider: liderId(h.lider) };
  };

  const current = header(old.header);
  const lastHeader = header(old.lastSheet?.header);
  const lastSheet: ClosedSheet | null =
    old.lastSheet && lastHeader
      ? { header: lastHeader, ordens: (old.lastSheet.ordens ?? []).map(migrateOS), fechadaEm: old.lastSheet.fechadaEm ?? '', tecnicos: [...tecnicos] }
      : null;
  return {
    version: 3,
    header: current,
    ordens: old.ordens.map(migrateOS),
    // As perguntas mudaram de ordem: a OS em preenchimento recomeça da primeira, com as respostas preservadas.
    // Um rascunho de EDIÇÃO (v2 editava pelo assistente) é descartado: a OS original continua salva, sem duplicar.
    draft:
      old.draft && !old.draft.editingId
        ? normalizeDraft({ osNumber: old.draft.osNumber, serviceType: old.draft.serviceType, serviceCode: old.draft.serviceCode, ...migrateAnswers(old.draft.serviceType, old.draft.answers) })
        : null,
    lastSheet,
    lastHeader: current ?? lastHeader,
    tecnicos,
  };
}
