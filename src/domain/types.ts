export type ServiceType = 'COMERCIAL' | 'OCORRENCIA';

export type QuestionType = 'text' | 'yesno' | 'yesno_detail';

/** Teclado sugerido no celular para a resposta de texto. */
export type InputKind = 'text' | 'numeric' | 'decimal' | 'time';

/** Colunas próprias do Espelho de Campo; perguntas sem coluna (inclusive o tipo de serviço) vão para INFO ADICIONAL. */
export const ESPELHO_COLUMNS = ['kmIni', 'horaIni', 'horaFin', 'kmFin', 'medidorInstalado', 'leituraInstalado', 'medidorRetirado', 'leituraRetirado', 'clientePresente'] as const;

export type EspelhoColumn = (typeof ESPELHO_COLUMNS)[number];

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
  /** Rótulo curto na coluna INFO ADICIONAL do PDF (perguntas sem `espelho` e que não são o número da OS). */
  short?: string;
}

export type Choice = 'Sim' | 'Não';

export type Answer =
  | { kind: 'skipped' }
  | { kind: 'text'; value: string }
  | { kind: 'choice'; choice: Choice; detail?: string };

/**
 * Campos do cabeçalho do turno, todos texto. Fonte única: o tipo, a leitura do armazenamento e o formulário
 * derivam desta lista. `data` é AAAA-MM-DD; `horaInicio`/`horaFim` são HH:MM; `lider` é o id de um Tecnico ou vazio.
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
  /** Respostas de perguntas que saíram do catálogo (OSs migradas da v2), já como texto para INFO ADICIONAL. */
  infoLegada?: string;
}

/** OS em preenchimento no assistente. Persistida para sobreviver ao fechamento da aba. */
export interface WizardDraft {
  osNumber: string;
  serviceType: ServiceType;
  serviceCode: string;
  index: number;
  answers: Record<string, Answer>;
  infoLegada?: string;
}

/** Técnico líder cadastrado no aparelho (rodapé do Espelho de Campo). */
export interface Tecnico {
  id: string;
  nome: string;
  telefone: string;
}

/** Folha encerrada mais recente, guardada para baixar ou compartilhar o PDF de novo. */
export interface ClosedSheet {
  header: ShiftHeader;
  ordens: OrdemServico[];
  fechadaEm: string;
  /** Técnicos cadastrados quando a folha foi gerada (o PDF de novo sai igual mesmo se a lista mudar). */
  tecnicos: Tecnico[];
}

export interface AppData {
  version: 3;
  header: ShiftHeader | null;
  ordens: OrdemServico[];
  draft: WizardDraft | null;
  lastSheet: ClosedSheet | null;
  /** Último cabeçalho usado: preenche o próximo turno automaticamente (menos a data, que vem do sistema). */
  lastHeader: ShiftHeader | null;
  tecnicos: Tecnico[];
}

/** Linha pronta para exibir no app ou no PDF. */
export interface AnswerRow {
  question: string;
  display: string;
  skipped: boolean;
  isDitais: boolean;
}
