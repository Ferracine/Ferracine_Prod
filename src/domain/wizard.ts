import { questionsFor } from './catalog';
import type { Answer, AnswerRow, Choice, OrdemServico, Question, ServiceType, WizardDraft } from './types';

/**
 * Assistente de perguntas (uma por vez) como funções puras: cada passo recebe o rascunho
 * e devolve um novo, sem tocar no DOM nem no armazenamento.
 */

export type StepResult =
  | { ok: true; draft: WizardDraft; done: boolean }
  | { ok: false; error: string; focus?: 'detail' };

/**
 * Regras do número da OS. Ele vive em `osNumber` e, na ocorrência, também na pergunta marcada com `prefillOS`
 * ("Qual número da Ordem de serviço?"). Tudo que lê ou grava o número passa por estas três funções.
 */
function osNumberQuestionId(type: ServiceType): string | undefined {
  return questionsFor(type).find((q) => q.prefillOS)?.id;
}

/** Grava o número na pergunta do número (vazio = pulada). */
function withOSAnswer(type: ServiceType, answers: Record<string, Answer>, osNumber: string): Record<string, Answer> {
  const id = osNumberQuestionId(type);
  return id ? { ...answers, [id]: osNumber ? { kind: 'text', value: osNumber } : { kind: 'skipped' } } : answers;
}

/** A pergunta do número, quando respondida, define o número; senão vale o número atual. */
function osNumberFrom(type: ServiceType, answers: Record<string, Answer>, current: string): string {
  const id = osNumberQuestionId(type);
  const ans = id ? answers[id] : undefined;
  return ans?.kind === 'text' ? ans.value : current;
}

/** `osNumber` vazio = OS sem número (S/N); a pergunta do número fica para ser respondida no assistente. */
export function startDraft(osNumber: string, serviceType: ServiceType, serviceCode: string): WizardDraft {
  const answers = osNumber ? withOSAnswer(serviceType, {}, osNumber) : {};
  return { osNumber, serviceType, serviceCode, index: 0, answers };
}

/**
 * Nada foi respondido além do que já veio preenchido ao abrir a OS: pode sair sem confirmação.
 * Texto apagado ou "Sim" sem complemento contam como não respondidos.
 */
export function isUnchanged(draft: WizardDraft): boolean {
  const baseline = startDraft(draft.osNumber, draft.serviceType, draft.serviceCode).answers;
  return questionsFor(draft.serviceType).every(
    (q) => JSON.stringify(normalizeAnswer(q, draft.answers[q.id])) === JSON.stringify(normalizeAnswer(q, baseline[q.id])),
  );
}

export interface OSEdit {
  osNumber: string;
  serviceCode: string;
  answers: Record<string, Answer>;
}

export type EditResult = { ok: true; os: OrdemServico } | { ok: false; error: string; questionId?: string };

/**
 * Edição completa de uma OS concluída (lápis da lista): número, código e qualquer resposta, de uma vez.
 * Aplica as mesmas regras do assistente (DITAIS obrigatória, complemento do SIM) e devolve a OS normalizada.
 */
export function applyEdit(os: OrdemServico, edit: OSEdit): EditResult {
  const serviceCode = edit.serviceCode.trim().toUpperCase();
  if (!serviceCode) return { ok: false, error: 'Informe o código do serviço.' };
  for (const q of questionsFor(os.serviceType)) {
    const error = ruleError(q, edit.answers[q.id]);
    if (error) return { ok: false, error: `${q.text} ${error}`, questionId: q.id };
  }
  const osNumber = edit.osNumber.trim();
  const draft: WizardDraft = {
    osNumber,
    serviceType: os.serviceType,
    serviceCode,
    index: 0,
    answers: withOSAnswer(os.serviceType, edit.answers, osNumber),
    infoLegada: os.infoLegada,
  };
  return { ok: true, os: finalize(draft, os.id, new Date(os.registradaEm)) };
}

export function currentQuestion(draft: WizardDraft): Question {
  const q = questionsFor(draft.serviceType)[draft.index];
  if (!q) throw new Error(`Pergunta ${draft.index} inexistente para ${draft.serviceType}`);
  return q;
}

export function totalQuestions(draft: WizardDraft): number {
  return questionsFor(draft.serviceType).length;
}

export function isLastQuestion(draft: WizardDraft): boolean {
  return draft.index === totalQuestions(draft) - 1;
}

function withAnswer(draft: WizardDraft, answer: Answer): WizardDraft {
  return { ...draft, answers: { ...draft.answers, [currentQuestion(draft).id]: answer } };
}

export function setText(draft: WizardDraft, value: string): WizardDraft {
  return withAnswer(draft, { kind: 'text', value });
}

/** Resposta ao tocar SIM/NÃO: no "Sim, qual?" o complemento já digitado é mantido; o NÃO o descarta. */
export function choiceAnswer(q: Question, prev: Answer | undefined, choice: Choice): Answer {
  if (q.type === 'yesno_detail' && choice === 'Sim') {
    return { kind: 'choice', choice, detail: prev?.kind === 'choice' ? (prev.detail ?? '') : '' };
  }
  return { kind: 'choice', choice };
}

/**
 * Regras de SIM/NÃO comuns ao assistente e à edição: a obrigatória precisa de SIM ou NÃO e o SIM de um
 * "se sim, qual?" precisa do complemento. Devolve o motivo (sem a pergunta) ou null.
 */
export function ruleError(q: Question, ans: Answer | undefined): string | null {
  if (q.required && ans?.kind !== 'choice') return '— resposta obrigatória: marque SIM ou NÃO.';
  if (q.type === 'yesno_detail' && ans?.kind === 'choice' && ans.choice === 'Sim' && !(ans.detail ?? '').trim()) {
    return '— você marcou SIM: preencha o complemento.';
  }
  return null;
}

export function setChoice(draft: WizardDraft, choice: Choice): WizardDraft {
  const q = currentQuestion(draft);
  return withAnswer(draft, choiceAnswer(q, draft.answers[q.id], choice));
}

export function setDetail(draft: WizardDraft, detail: string): WizardDraft {
  const prev = draft.answers[currentQuestion(draft).id];
  if (prev?.kind !== 'choice' || prev.choice !== 'Sim') return draft;
  return withAnswer(draft, { ...prev, detail });
}

function advance(draft: WizardDraft): StepResult {
  if (isLastQuestion(draft)) return { ok: true, draft, done: true };
  return { ok: true, draft: { ...draft, index: draft.index + 1 }, done: false };
}

/** Valida a resposta da pergunta atual e avança (ou sinaliza fim). */
export function next(draft: WizardDraft): StepResult {
  const q = currentQuestion(draft);
  const ans = draft.answers[q.id];

  if (q.type === 'text') {
    const value = ans?.kind === 'text' ? ans.value.trim() : '';
    if (!value) {
      return {
        ok: false,
        error: q.required ? 'Por favor, preencha esta resposta obrigatória.' : 'Digite uma resposta ou toque em "Pular".',
      };
    }
    return advance(withAnswer(draft, { kind: 'text', value }));
  }

  if (ans?.kind !== 'choice') {
    return {
      ok: false,
      error: q.required ? 'Selecione SIM ou NÃO para prosseguir (obrigatório).' : 'Selecione SIM, NÃO ou toque em "Pular".',
    };
  }
  if (ruleError(q, ans)) return { ok: false, error: 'Como você marcou SIM, preencha o campo complementar.', focus: 'detail' };
  return advance(withAnswer(draft, normalizeAnswer(q, ans)));
}

export function skip(draft: WizardDraft): StepResult {
  const q = currentQuestion(draft);
  if (q.required) return { ok: false, error: 'Esta pergunta é obrigatória e não pode ser pulada.' };
  return advance(withAnswer(draft, { kind: 'skipped' }));
}

export function back(draft: WizardDraft): WizardDraft {
  return draft.index > 0 ? { ...draft, index: draft.index - 1 } : draft;
}

export function finalize(draft: WizardDraft, id: string, now: Date): OrdemServico {
  const answers: Record<string, Answer> = {};
  for (const q of questionsFor(draft.serviceType)) {
    answers[q.id] = normalizeAnswer(q, draft.answers[q.id]);
  }
  return {
    id,
    osNumber: osNumberFrom(draft.serviceType, answers, draft.osNumber),
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
  const rows = questionsFor(os.serviceType).map((q) => {
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
