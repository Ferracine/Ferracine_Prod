import { SERVICE_CODES, SERVICE_LABEL, isVisible, questionsFor, visibleQuestions } from './catalog';
import type { Answer, AnswerRow, Choice, OrdemServico, OSDraft, Question, ServiceType } from './types';

/**
 * Regras da OS como funções puras (sem DOM nem armazenamento). A mesma tela serve para a OS nova (rascunho em
 * `AppData.draft`, salvo a cada alteração) e para a edição pelo lápis; as duas passam pelas mesmas regras.
 */

/** OS nova em branco: número (opcional, vazio = S/N), código e respostas são preenchidos na tela da OS. */
export function startDraft(serviceType: ServiceType): OSDraft {
  return { osNumber: '', serviceType, serviceCode: '', answers: {} };
}

/**
 * Nada foi preenchido: pode sair sem confirmação.
 * Texto apagado ou "Sim" sem complemento contam como não respondidos.
 */
export function isUnchanged(draft: OSDraft): boolean {
  return (
    !draft.osNumber.trim() &&
    !draft.serviceCode.trim() &&
    visibleQuestions(draft.serviceType, draft.answers).every((q) => normalizeAnswer(q, draft.answers[q.id]).kind === 'skipped')
  );
}

/** O que a tela da OS edita: número, código e respostas. */
export interface OSEdit {
  osNumber: string;
  serviceCode: string;
  answers: Record<string, Answer>;
}

/** Campo "Código do serviço" da tela da OS (o erro de código rola até ele, como o de uma pergunta). */
export const CODE_FIELD = 'serviceCode' satisfies keyof OSEdit;

/** Regra não cumprida: o motivo e o campo (id da pergunta ou CODE_FIELD) para a tela rolar até ele. */
export interface RuleError {
  ok: false;
  error: string;
  field: string;
}

export type EditResult = { ok: true; os: OrdemServico } | RuleError;

/**
 * Regras comuns à OS nova e à edição: código obrigatório, DITAIS obrigatória, complemento do SIM.
 * Devolve o rascunho pronto para `finalize` (número e código aparados) ou o erro.
 */
function checked(type: ServiceType, edit: OSEdit, infoLegada?: string): { ok: true; draft: OSDraft } | RuleError {
  const serviceCode = edit.serviceCode.trim().toUpperCase();
  if (!serviceCode) return { ok: false, error: 'Informe o código do serviço.', field: CODE_FIELD };
  // Código da lista do outro tipo: a OS ficaria com as perguntas erradas (ex.: ocorrência sem a pergunta dos DITAIS).
  const outro: ServiceType = type === 'COMERCIAL' ? 'OCORRENCIA' : 'COMERCIAL';
  if (SERVICE_CODES[outro].includes(serviceCode)) {
    return { ok: false, error: `Código ${serviceCode} é de ${SERVICE_LABEL[outro]}: use o + ${SERVICE_LABEL[outro]}.`, field: CODE_FIELD };
  }
  // Escondida pela resposta de outra pergunta: não vale, não é validada.
  for (const q of visibleQuestions(type, edit.answers)) {
    const error = ruleError(q, edit.answers[q.id]);
    if (error) return { ok: false, error: `${q.text} ${error}`, field: q.id };
  }
  return {
    ok: true,
    draft: { osNumber: edit.osNumber.trim(), serviceType: type, serviceCode, answers: edit.answers, ...(infoLegada ? { infoLegada } : {}) },
  };
}

/** "Salvar OS" da OS nova: valida e devolve a OS registrada agora. */
export function createOS(draft: OSDraft, id: string, now: Date): EditResult {
  const r = checked(draft.serviceType, draft, draft.infoLegada);
  return r.ok ? { ok: true, os: finalize(r.draft, id, now) } : r;
}

/** Lápis da lista: aplica número, código e respostas de uma vez, mantendo id e horário de registro. */
export function applyEdit(os: OrdemServico, edit: OSEdit): EditResult {
  const r = checked(os.serviceType, edit, os.infoLegada);
  return r.ok ? { ok: true, os: finalize(r.draft, os.id, new Date(os.registradaEm)) } : r;
}

/** Resposta ao tocar SIM/NÃO: no "Sim, qual?" o complemento já digitado é mantido; o NÃO o descarta. */
export function choiceAnswer(q: Question, prev: Answer | undefined, choice: Choice): Answer {
  if (q.type === 'yesno_detail' && choice === 'Sim') {
    return { kind: 'choice', choice, detail: prev?.kind === 'choice' ? (prev.detail ?? '') : '' };
  }
  return { kind: 'choice', choice };
}

/**
 * Regras de SIM/NÃO: a obrigatória precisa de SIM ou NÃO e o SIM de um "se sim, qual?" precisa do complemento.
 * Devolve o motivo (sem a pergunta) ou null.
 */
function ruleError(q: Question, ans: Answer | undefined): string | null {
  if (q.required && ans?.kind !== 'choice') return '— resposta obrigatória: marque SIM ou NÃO.';
  if (q.type === 'yesno_detail' && ans?.kind === 'choice' && ans.choice === 'Sim' && !(ans.detail ?? '').trim()) {
    return '— você marcou SIM: preencha o complemento.';
  }
  return null;
}

/**
 * OS pronta para a folha: respostas normalizadas e o número do campo do topo gravado também na pergunta do número
 * (`prefillOS`, "Qual número da Ordem de serviço?" da ocorrência), que a tela não mostra.
 */
export function finalize(draft: OSDraft, id: string, now: Date): OrdemServico {
  const answers: Record<string, Answer> = {};
  for (const q of questionsFor(draft.serviceType)) {
    if (q.prefillOS) answers[q.id] = draft.osNumber ? { kind: 'text', value: draft.osNumber } : { kind: 'skipped' };
    // Escondida (ex.: leitura do medidor retirado com "Foi retirado medidor?" = NÃO): o que foi digitado antes não vale.
    else answers[q.id] = isVisible(q, draft.answers) ? normalizeAnswer(q, draft.answers[q.id]) : { kind: 'skipped' };
  }
  return {
    id,
    osNumber: draft.osNumber,
    serviceType: draft.serviceType,
    serviceCode: draft.serviceCode,
    answers,
    registradaEm: now.toISOString(),
    // Respostas da versão antiga (migração) acompanham a OS em qualquer edição.
    ...(draft.infoLegada ? { infoLegada: draft.infoLegada } : {}),
  };
}

/** Respostas vazias ou incompletas viram "pulada", para nunca irem em branco ao PDF. */
function normalizeAnswer(q: Question, ans: Answer | undefined): Answer {
  if (!ans || ans.kind === 'skipped') return { kind: 'skipped' };
  if (ans.kind === 'text') {
    const value = ans.value.trim();
    return q.type === 'text' && value ? { kind: 'text', value } : { kind: 'skipped' };
  }
  if (q.type === 'text') return { kind: 'skipped' };
  if (q.type === 'yesno' || ans.choice === 'Não') return { kind: 'choice', choice: ans.choice };
  const detail = (ans.detail ?? '').trim();
  return detail ? { kind: 'choice', choice: 'Sim', detail } : { kind: 'skipped' };
}

function describeAnswer(ans: Answer | undefined): string | null {
  if (!ans || ans.kind === 'skipped') return null;
  if (ans.kind === 'text') return ans.value;
  return ans.choice === 'Sim' && ans.detail ? `Sim — ${ans.detail}` : ans.choice;
}

export function answerRows(os: Pick<OrdemServico, 'serviceType' | 'answers' | 'infoLegada'>): AnswerRow[] {
  // Só as perguntas que aparecem com estas respostas ("X de Y respondidas" conta as visíveis).
  const rows = visibleQuestions(os.serviceType, os.answers).map((q) => {
    const display = describeAnswer(os.answers[q.id]);
    return {
      question: q.text,
      display: display ?? 'Não informado',
      skipped: display === null,
      isDitais: !!q.isDitais,
    };
  });
  if (os.infoLegada) rows.push({ question: 'Respostas da versão anterior do app', display: os.infoLegada, skipped: false, isDitais: false });
  return rows;
}
