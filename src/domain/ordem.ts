import { isVisible, questionsFor, visibleQuestions } from './catalog';
import type { Answer, AnswerRow, OrdemServico, OSDraft, Question, ServiceType } from './types';

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
 * Texto apagado conta como não respondido.
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
 * Regras comuns à OS nova e à edição: código obrigatório e DITAIS obrigatória.
 * Devolve o rascunho pronto para `finalize` (número e código aparados) ou o erro.
 */
function checked(type: ServiceType, edit: OSEdit): { ok: true; draft: OSDraft } | RuleError {
  // Qualquer código vale nos dois tipos: são muitos serviços, e o eletricista corrige a folha depois se precisar.
  const serviceCode = edit.serviceCode.replace(/\s+/g, '').toUpperCase();
  if (!serviceCode) return { ok: false, error: 'Informe o código do serviço.', field: CODE_FIELD };
  // Escondida pela resposta de outra pergunta: não vale, não é validada.
  for (const q of visibleQuestions(type, edit.answers)) {
    const error = ruleError(q, edit.answers[q.id]);
    if (error) return { ok: false, error: `${q.text} ${error}`, field: q.id };
  }
  return {
    ok: true,
    draft: { osNumber: edit.osNumber.trim(), serviceType: type, serviceCode, answers: edit.answers },
  };
}

/** "Salvar OS" da OS nova: valida e devolve a OS registrada agora. */
export function createOS(draft: OSDraft, id: string, now: Date): EditResult {
  const r = checked(draft.serviceType, draft);
  return r.ok ? { ok: true, os: finalize(r.draft, id, now) } : r;
}

/** Lápis da lista: aplica número, código e respostas de uma vez, mantendo id e horário de registro. */
export function applyEdit(os: OrdemServico, edit: OSEdit): EditResult {
  const r = checked(os.serviceType, edit);
  return r.ok ? { ok: true, os: finalize(r.draft, os.id, new Date(os.registradaEm)) } : r;
}

/**
 * Regra de SIM/NÃO: a obrigatória precisa de SIM ou NÃO. Devolve o motivo (sem a pergunta) ou null.
 */
function ruleError(q: Question, ans: Answer | undefined): string | null {
  return q.required && ans?.kind !== 'choice' ? '— resposta obrigatória: marque SIM ou NÃO.' : null;
}

/** OS pronta para a folha: respostas normalizadas (vazias ou escondidas viram "pulada"). */
export function finalize(draft: OSDraft, id: string, now: Date): OrdemServico {
  const answers: Record<string, Answer> = {};
  for (const q of questionsFor(draft.serviceType)) {
    // Escondida (ex.: número do medidor novo com "Foi instalado novo medidor?" = NÃO): o que foi digitado antes não vale.
    answers[q.id] = isVisible(q, draft.answers) ? normalizeAnswer(q, draft.answers[q.id]) : { kind: 'skipped' };
  }
  return {
    id,
    osNumber: draft.osNumber,
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
    // Caixa aberta: quebras de linha e espaços repetidos viram um espaço (uma linha por OS na folha, como as outras).
    const value = (q.input === 'longo' ? ans.value.replace(/\s+/g, ' ') : ans.value).trim();
    return q.type === 'text' && value ? { kind: 'text', value } : { kind: 'skipped' };
  }
  return q.type === 'yesno' ? { kind: 'choice', choice: ans.choice } : { kind: 'skipped' };
}

/** Texto da resposta (o digitado ou SIM/NÃO); null = não respondida. Usado no app e no Espelho de Campo. */
export function describeAnswer(ans: Answer | undefined): string | null {
  if (!ans || ans.kind === 'skipped') return null;
  if (ans.kind === 'text') return ans.value;
  return ans.choice;
}

/**
 * OS já salva sem a resposta de uma pergunta obrigatória (ex.: OS comercial registrada antes da 1.4.11, quando a
 * DITAIS ainda não valia na comercial). O lápis pede a resposta; o painel e o "Gerar PDF" avisam.
 */
export function faltaObrigatoria(os: Pick<OrdemServico, 'serviceType' | 'answers'>): boolean {
  return visibleQuestions(os.serviceType, os.answers).some((q) => q.required && os.answers[q.id]?.kind !== 'choice');
}

export function answerRows(os: Pick<OrdemServico, 'serviceType' | 'answers'>): AnswerRow[] {
  // Só as perguntas que aparecem com estas respostas ("X de Y respondidas" conta as visíveis).
  return visibleQuestions(os.serviceType, os.answers).map((q) => {
    const display = describeAnswer(os.answers[q.id]);
    return {
      question: q.text,
      display: display ?? (q.required ? 'Falta responder (obrigatória): use Editar' : 'Não informado'),
      skipped: display === null,
      isDitais: !!q.isDitais,
    };
  });
}
