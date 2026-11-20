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

/** Troca o número de uma OS concluída (lápis da lista), mantendo coerente a pergunta do número. */
export function withOSNumber(os: OrdemServico, osNumber: string): OrdemServico {
  const number = osNumber.trim();
  return { ...os, osNumber: number, answers: withOSAnswer(os.serviceType, os.answers, number) };
}

/**
 * Nada mudou desde que o assistente abriu (comparado às respostas pré-preenchidas numa OS nova, ou às da OS salva
 * `original` numa edição): pode sair sem confirmação. Texto apagado ou "Sim" sem complemento contam como não respondidos.
 */
export function isUnchanged(draft: WizardDraft, original?: OrdemServico): boolean {
  const baseline = original?.answers ?? startDraft(draft.osNumber, draft.serviceType, draft.serviceCode).answers;
  return questionsFor(draft.serviceType).every(
    (q) => JSON.stringify(normalizeAnswer(q, draft.answers[q.id])) === JSON.stringify(normalizeAnswer(q, baseline[q.id])),
  );
}

export function draftFromOS(os: OrdemServico): WizardDraft {
  return {
    osNumber: os.osNumber,
    serviceType: os.serviceType,
    serviceCode: os.serviceCode,
    index: 0,
    answers: { ...os.answers },
    editingId: os.id,
  };
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

export function setChoice(draft: WizardDraft, choice: Choice): WizardDraft {
  const prev = draft.answers[currentQuestion(draft).id];
  const prevDetail = prev?.kind === 'choice' ? prev.detail : undefined;
  const q = currentQuestion(draft);
  if (q.type === 'yesno_detail' && choice === 'Sim') {
    return withAnswer(draft, { kind: 'choice', choice, detail: prevDetail ?? '' });
  }
  return withAnswer(draft, { kind: 'choice', choice });
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

  if (q.type === 'yesno_detail' && ans.choice === 'Sim') {
    const detail = (ans.detail ?? '').trim();
    if (!detail) {
      return { ok: false, error: 'Como você marcou SIM, preencha o campo complementar.', focus: 'detail' };
    }
    return advance(withAnswer(draft, { ...ans, detail }));
  }

  return advance(draft);
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

export function answerRows(os: Pick<OrdemServico, 'serviceType' | 'answers'>): AnswerRow[] {
  return questionsFor(os.serviceType).map((q) => {
    const display = describeAnswer(os.answers[q.id]);
    return {
      question: q.text,
      display: display ?? 'Não informado',
      skipped: display === null,
      isDitais: !!q.isDitais,
    };
  });
}
