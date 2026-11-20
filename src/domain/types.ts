export type ServiceType = 'COMERCIAL' | 'OCORRENCIA';

export type QuestionType = 'text' | 'yesno' | 'yesno_detail';

/** Teclado sugerido no celular para a resposta de texto. */
export type InputKind = 'text' | 'numeric' | 'decimal' | 'time';

/** Coluna do Espelho de Campo alimentada pela resposta da pergunta. */
export type EspelhoColumn = 'tipo' | 'medidorInstalado' | 'leituraInstalado' | 'medidorRetirado' | 'leituraRetirado' | 'desvios';

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
  /** Pergunta do número da OS: começa com o número do painel e, respondida, define o número. */
  prefillOS?: boolean;
  espelho?: EspelhoColumn;
}

export type Choice = 'Sim' | 'Não';

export type Answer =
  | { kind: 'skipped' }
  | { kind: 'text'; value: string }
  | { kind: 'choice'; choice: Choice; detail?: string };

/**
 * Campos do cabeçalho do turno, todos texto. Fonte única: o tipo, a leitura do armazenamento e o formulário
 * derivam desta lista. `data` é AAAA-MM-DD; `horaInicio`/`horaFim` são HH:MM; `lider` é um de TECNICOS_LIDERES ou vazio.
 */
export const HEADER_FIELDS = ['nome1', 'mat1', 'nome2', 'mat2', 'equipe', 'viatura', 'data', 'horaInicio', 'horaFim', 'bodycam1', 'bodycam2', 'lider'] as const;

export type ShiftHeader = Record<(typeof HEADER_FIELDS)[number], string>;

export interface OrdemServico {
  id: string;
  /** Vazio quando o eletricista não sabia o número (aparece como "S/N"). */
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
