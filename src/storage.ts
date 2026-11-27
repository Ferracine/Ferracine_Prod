import { escolha } from './domain/catalog';
import { HEADER_FIELDS, SHEETS_KEPT, type Answer, type AppData, type ClosedSheet, type Eletricista, type OrdemServico, type ServiceType, type ShiftHeader, type Tecnico, type OSDraft, type Choice } from './domain/types';

export const STORAGE_KEY = 'ferracine_prod:v3';
/** Chave do protótipo (antes da 1.1.0): não é lida; é apagada ao abrir para não guardar nomes e matrículas à toa. */
const LEGACY_KEY = 'ferracine_prod:v2';

export type KeyValueStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const texto = (v: unknown): string => (typeof v === 'string' ? v : '');

// --- Leitura tipada dos dados salvos -------------------------------------

/** Valor que um leitor devolve quando o campo não serve: o item inteiro (OS, técnico, folha...) é descartado. */
export const INVALIDO = Symbol('inválido');

/** Lê um campo salvo e devolve o valor no formato atual (ou INVALIDO). */
export type Leitor<V> = (v: unknown) => V | typeof INVALIDO;

/**
 * Um leitor para cada campo do tipo, inclusive os opcionais, e nenhum a mais. Campo novo no tipo sem leitor aqui não
 * compila: se compilasse, seria descartado calado na primeira abertura (o app grava no formato atual ao abrir).
 */
export type Esquema<T> = { [K in keyof Required<T>]: Leitor<T[K]> };

/** Monta o objeto só com os campos do esquema; campo opcional lido como `undefined` fica de fora. */
export function montar<T>(esquema: Esquema<T>, raw: unknown): T | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const out: Partial<Record<keyof T, unknown>> = {};
  for (const k of Object.keys(esquema) as (keyof T)[]) {
    const v = esquema[k]((raw as Partial<Record<keyof T, unknown>>)[k]);
    if (v === INVALIDO) return undefined;
    if (v !== undefined) out[k] = v;
  }
  return out as T;
}

/** Lista salva: cada item montado pelo esquema; o que não serve sai. */
function lista<T>(esquema: Esquema<T>, raw: unknown): T[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    const v = montar(esquema, item);
    return v === undefined ? [] : [v];
  });
}

/** Texto obrigatório (pode ser vazio); outro tipo invalida o item. */
const textoExato: Leitor<string> = (v) => (typeof v === 'string' ? v : INVALIDO);

/** Cabeçalho: todos os campos de HEADER_FIELDS (a fonte do tipo), texto ausente vira vazio. */
const CABECALHO = Object.fromEntries(HEADER_FIELDS.map((k) => [k, texto])) as Esquema<ShiftHeader>;
const TECNICO: Esquema<Tecnico> = { id: textoExato, nome: textoExato, telefone: textoExato };
const ELETRICISTA: Esquema<Eletricista> = { id: textoExato, nome: textoExato, matricula: textoExato };

export function emptyData(): AppData {
  return { version: 3, header: null, ordens: [], draft: null, sheets: [], lastHeader: null, tecnicos: [], eletricistas: [] };
}

/** Completa com vazio os campos que não existiam quando o cabeçalho foi salvo (ex.: equipe, viatura, bodycam2). */
function normalizeHeader(raw: unknown): ShiftHeader | null {
  return montar(CABECALHO, raw) ?? null;
}

const tipoServico: Leitor<ServiceType> = (v) => (v === 'COMERCIAL' || v === 'OCORRENCIA' ? v : INVALIDO);
const respostas: Leitor<Record<string, Answer>> = (v) => (v && typeof v === 'object' ? (v as Record<string, Answer>) : INVALIDO);

/** OS nova em preenchimento: sem tipo conhecido ou sem respostas, é descartada (em vez de travar a tela da OS). */
const RASCUNHO: Esquema<OSDraft> = { osNumber: texto, serviceType: tipoServico, serviceCode: texto, answers: respostas };

/**
 * OS registrada: os campos do rascunho + id (sem ele não dá para editar nem excluir: a OS sai) e horário. A ordem dos
 * campos dos esquemas é a mesma com que o app grava (`finalize`, `startDraft`...): diferente, o JSON mudaria e o app
 * regravaria tudo a cada abertura (há teste para isso).
 */
const OS: Esquema<OrdemServico> = { id: (v) => texto(v) || INVALIDO, ...RASCUNHO, registradaEm: texto };

/** Folha encerrada: sem cabeçalho válido é descartada (não dá para gerar o PDF). */
const FOLHA: Esquema<ClosedSheet> = {
  header: (v) => normalizeHeader(v) ?? INVALIDO,
  ordens: (v) => lista(OS, v),
  fechadaEm: texto,
  tecnicos: (v) => lista(TECNICO, v),
  baixadaEm: texto,
};

/** Tudo o que o app guarda. Sem versão 3 ou sem a lista de OSs, o dado não é deste app: começa vazio. */
const DADOS: Esquema<AppData> = {
  version: (v) => (v === 3 ? 3 : INVALIDO),
  header: normalizeHeader,
  ordens: (v) => (Array.isArray(v) ? lista(OS, v) : INVALIDO),
  draft: (v) => montar(RASCUNHO, v) ?? null,
  sheets: (v) => lista(FOLHA, v).slice(0, SHEETS_KEPT),
  lastHeader: normalizeHeader,
  tecnicos: (v) => lista(TECNICO, v),
  eletricistas: (v) => lista(ELETRICISTA, v),
};

/** Folha recém-encerrada no topo do histórico; passando de SHEETS_KEPT, a mais antiga sai. */
export function pushSheet(sheets: readonly ClosedSheet[], sheet: ClosedSheet): ClosedSheet[] {
  return [sheet, ...sheets].slice(0, SHEETS_KEPT);
}

export function removerFolha(sheets: readonly ClosedSheet[], sheet: ClosedSheet): ClosedSheet[] {
  return sheets.filter((s) => s !== sheet);
}

/**
 * Encerra o turno: a folha (ainda sem PDF baixado) vai para o topo do histórico e cabeçalho, OSs e rascunho ficam
 * vazios. Sem turno aberto, não faz nada.
 */
export function encerrarDados(d: AppData, fechadaEm: string): void {
  if (!d.header) return;
  d.sheets = pushSheet(d.sheets, { header: d.header, ordens: d.ordens, fechadaEm, tecnicos: d.tecnicos, baixadaEm: '' });
  d.header = null;
  d.ordens = [];
  d.draft = null;
}

/**
 * "Cancelar turno": descarta o cabeçalho, as OSs e o rascunho sem criar folha. `reaberta` = a folha que o "Editar" do
 * histórico tinha tirado de lá: volta como estava antes da correção (no lugar dela pela data de encerramento).
 */
export function cancelarDados(d: AppData, reaberta: ClosedSheet | null): void {
  d.header = null;
  d.ordens = [];
  d.draft = null;
  if (reaberta) d.sheets = [...d.sheets, reaberta].sort((a, b) => b.fechadaEm.localeCompare(a.fechadaEm)).slice(0, SHEETS_KEPT);
}

/** "Editar" uma folha encerrada: ela volta a ser o turno aberto (cabeçalho e OSs) e sai do histórico. */
export function reabrirDados(d: AppData, sheet: ClosedSheet): void {
  d.header = sheet.header;
  d.ordens = sheet.ordens;
  d.draft = null;
  d.sheets = removerFolha(d.sheets, sheet);
}

/**
 * Lê o estado salvo; dado ausente ou corrompido vira estado vazio. Primeiro as conversões de versões antigas (sobre
 * o JSON cru), depois os esquemas acima montam cada objeto só com os campos atuais. Se o resultado difere do que
 * estava gravado, grava já no formato atual.
 */
export function loadData(store: KeyValueStore): AppData {
  let raw: string | null = null;
  let current: unknown = null;
  try {
    raw = store.getItem(STORAGE_KEY);
    current = raw === null ? null : JSON.parse(raw);
  } catch {
    return emptyData(); // ilegível: não grava por cima (pode ser o armazenamento que falhou, não o dado)
  }
  try {
    store.removeItem(LEGACY_KEY);
  } catch {
    // sem acesso ao armazenamento: tenta de novo na próxima abertura
  }
  if (!current || typeof current !== 'object') return emptyData();
  const data = montar(DADOS, converterDados(current as Record<string, unknown>));
  if (!data) return emptyData();
  // Cota cheia/modo privado: saveData falha calado e o app segue com os dados convertidos (grava no próximo update()).
  if (JSON.stringify(data) !== raw) saveData(store, data);
  return data;
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

// --- Conversões de versões antigas (1.1.0 a 1.4.15) ----------------------
// Rodam antes dos esquemas, sobre o JSON cru. Desde a 1.4.9 o app grava no formato atual ao abrir; a última conversão
// (`baixadaEm` das folhas antigas) é da 1.4.16. Quando todos os aparelhos já tiverem aberto a 1.4.16 ou mais nova, este
// bloco inteiro (até o fim do arquivo) pode sair, junto com a chamada de `converterDados` em `loadData`.

function converterDados(d: Record<string, unknown>): Record<string, unknown> {
  // `lastSheet`: até a 1.4.4 só a última folha encerrada era guardada; vira o primeiro item do histórico.
  const sheets = Array.isArray(d.sheets) ? d.sheets : d.lastSheet ? [d.lastSheet] : [];
  return {
    ...d,
    ordens: Array.isArray(d.ordens) ? d.ordens.map(converterOS) : d.ordens,
    draft: converterRascunho(d.draft),
    sheets: sheets.map(converterFolha),
    eletricistas: Array.isArray(d.eletricistas) ? d.eletricistas : eletricistasDosCabecalhos(normalizeHeader(d.header), normalizeHeader(d.lastHeader)),
  };
}

/**
 * Folha do histórico: respostas antigas nas OSs; e, até a 1.4.15, encerrar já baixava o PDF, então a folha sem
 * `baixadaEm` conta como baixada no encerramento (não aparece "PDF não baixado" nas folhas antigas). Aproximação
 * aceita: um download que falhou naquela época (ex.: Android 7–9 sem permissão) também conta como baixado.
 */
function converterFolha(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  const s = raw as Partial<ClosedSheet>;
  return {
    ...s,
    ...(Array.isArray(s.ordens) ? { ordens: s.ordens.map(converterOS) } : {}),
    ...('baixadaEm' in s ? {} : { baixadaEm: s.fechadaEm }),
  };
}

/** OS ou rascunho: respostas das versões antigas no formato atual (`migrateAnswers`). */
function converterOS(raw: unknown): unknown {
  const o = raw as Partial<OrdemServico> | null;
  const type = tipoServico(o?.serviceType);
  const answers = respostas(o?.answers);
  if (type === INVALIDO || answers === INVALIDO) return raw; // o esquema descarta
  return { ...o, answers: migrateAnswers(type, answers) };
}

/** Rascunho do assistente (até a 1.3.0): o número da OS ficava só na resposta `os`; vai para o campo do topo. */
function converterRascunho(raw: unknown): unknown {
  const ans = (raw as { answers?: Record<string, Answer> } | null)?.answers?.os;
  const doAssistente = ans?.kind === 'text' ? ans.value.trim() : '';
  return converterOS(doAssistente ? { ...(raw as object), osNumber: doAssistente } : raw);
}

/**
 * Sem a lista de eletricistas (até a 1.4.4), o cadastro começa com quem estava nos últimos cabeçalhos, para a dupla de
 * sempre já aparecer para escolher.
 */
function eletricistasDosCabecalhos(...headers: (ShiftHeader | null)[]): Eletricista[] {
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

/** Resposta como as versões antigas gravavam: o SIM/NÃO podia levar um complemento (`detail`). */
type RespostaAntiga = Exclude<Answer, { kind: 'choice' }> | { kind: 'choice'; choice: Choice; detail?: string };

/**
 * Respostas das versões anteriores no formato atual.
 * - `os`: cópia do número da OS que a 1.4.8 e anteriores gravavam numa pergunta escondida; o número fica no campo
 *   `osNumber`.
 * - `dificuldade` (até a 1.4.12, "Houve alguma dificuldade...?" SIM + relato): vira a caixa "Informações adicionais"
 *   (`infoAdicional`) com "DIFICULDADE: <relato>" (maiúsculas, como a caixa grava); o NÃO não ia para a folha e some.
 * - Comercial até a 1.4.4 (ver abaixo): vira medidor da UC (`medidorInstNum`/`leituraInst`) + "Foi instalado novo
 *   medidor?" (`novoMedidor`, `novoMedidorNum`/`novoLeitura`), com o mesmo Espelho de Campo de antes.
 * - Ocorrência: a 1.4.1 tinha SIM/NÃO + número e a 1.4.2/1.4.3 só o número, as duas em `medidorInst`; vira
 *   `medidorInstNum` (NÃO ou SIM sem número ficam em branco).
 */
function migrateAnswers(type: ServiceType, answers: Record<string, RespostaAntiga>): Record<string, Answer> {
  const { os: _copiaDoNumero, dificuldade, ...out } = answers;
  const relato = dificuldade?.kind === 'choice' && dificuldade.choice === 'Sim' ? (dificuldade.detail ?? '').trim() : '';
  if (relato && !out.infoAdicional) out.infoAdicional = { kind: 'text', value: `DIFICULDADE: ${relato}` };
  const numero = (ans: RespostaAntiga | undefined): Answer | undefined => {
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
