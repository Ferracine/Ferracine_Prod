export type ServiceType = 'COMERCIAL' | 'OCORRENCIA';

export type QuestionType = 'text' | 'yesno' | 'yesno_detail';

/** Teclado sugerido no celular para a resposta de texto. */
export type InputKind = 'text' | 'numeric' | 'decimal' | 'time';

export interface Question {
  id: string;
  text: string;
  type: QuestionType;
  placeholder?: string;
  /** Rótulo do campo complementar quando a resposta é "Sim" (yesno_detail). */
  detailLabel?: string;
  input?: InputKind;
  /** Não pode ser pulada. */
  required?: boolean;
  /** Pergunta de segurança dos DITAIS: obrigatória e destacada no PDF. */
  isDitais?: boolean;
  /** Já começa preenchida com o número da OS digitado no painel. */
  prefillOS?: boolean;
}

export type Choice = 'Sim' | 'Não';

export type Answer =
  | { kind: 'skipped' }
  | { kind: 'text'; value: string }
  | { kind: 'choice'; choice: Choice; detail?: string };

export interface ShiftHeader {
  nome1: string;
  mat1: string;
  nome2: string;
  mat2: string;
  /** AAAA-MM-DD (valor do <input type="date">). */
  data: string;
  /** HH:MM */
  horaInicio: string;
  /** HH:MM */
  horaFim: string;
  bodycam1: string;
}

export interface OrdemServico {
  id: string;
  osNumber: string;
  serviceType: ServiceType;
  serviceCode: string;
  answers: Record<string, Answer>;
  /** ISO 8601 do momento em que a OS foi concluída. */
  registradaEm: string;
}

/** OS em preenchimento no assistente. Persistida para sobreviver ao fechamento da aba. */
export interface WizardDraft {
  osNumber: string;
  serviceType: ServiceType;
  serviceCode: string;
  index: number;
  answers: Record<string, Answer>;
  /** Presente quando o rascunho é a edição de uma OS já concluída. */
  editingId?: string;
}

/** Folha encerrada mais recente, guardada para baixar ou compartilhar o PDF de novo. */
export interface ClosedSheet {
  header: ShiftHeader;
  ordens: OrdemServico[];
  fechadaEm: string;
}

export interface AppData {
  version: 2;
  header: ShiftHeader | null;
  ordens: OrdemServico[];
  draft: WizardDraft | null;
  lastSheet: ClosedSheet | null;
}

/** Linha pronta para exibir no app ou no PDF. */
export interface AnswerRow {
  question: string;
  display: string;
  skipped: boolean;
  isDitais: boolean;
}
