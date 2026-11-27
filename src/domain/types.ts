export type ServiceType = 'COMERCIAL' | 'OCORRENCIA';

export type QuestionType = 'text' | 'yesno';

/** Tipo de campo da resposta de texto: teclado sugerido no celular (`numeric`, `time`...) ou caixa aberta (`longo`). */
export type InputKind = 'text' | 'numeric' | 'decimal' | 'time' | 'longo';

/** Colunas próprias do Espelho de Campo; perguntas sem coluna (inclusive o tipo de serviço) vão para INFORMAÇÃO ADICIONAL. */
export const ESPELHO_COLUMNS = ['kmIni', 'horaIni', 'horaFin', 'kmFin', 'medidorInstalado', 'leituraInstalado', 'medidorRetirado', 'leituraRetirado', 'clientePresente'] as const;

export type EspelhoColumn = (typeof ESPELHO_COLUMNS)[number];

export interface Question {
  id: string;
  text: string;
  type: QuestionType;
  placeholder?: string;
  input?: InputKind;
  /** Não pode ser pulada. */
  required?: boolean;
  /** Pergunta de segurança dos DITAIS: destacada em "Ver respostas". */
  isDitais?: boolean;
  /** Coluna própria no Espelho de Campo (fixa, ou conforme as respostas: ex. medidor atual vira "retirado" na troca). */
  espelho?: EspelhoColumn | ((answers: Record<string, Answer>) => EspelhoColumn);
  /** Rótulo curto na coluna INFORMAÇÃO ADICIONAL do PDF (perguntas sem `espelho`). */
  short?: string;
  /**
   * Só aparece (e só vale) quando a condição é verdadeira, conforme as outras respostas; escondida, a resposta não
   * conta, não é validada e não vai ao PDF. Na tela, fica recuada embaixo da pergunta de que depende.
   */
  showIf?: (answers: Record<string, Answer>) => boolean;
  /** Pergunta de controle (ex.: "Foi instalado novo medidor?"): a resposta não vai para INFORMAÇÃO ADICIONAL. */
  semInfo?: boolean;
  /** Vai para INFORMAÇÃO ADICIONAL sem "Rótulo: " na frente (ex.: a caixa "Informações adicionais": a coluna já diz). */
  semRotulo?: boolean;
}

export type Choice = 'Sim' | 'Não';

export type Answer =
  | { kind: 'skipped' }
  | { kind: 'text'; value: string }
  | { kind: 'choice'; choice: Choice };

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
}

/** OS nova em preenchimento (tela da OS). Persistida a cada alteração para sobreviver ao fechamento do app. */
export interface OSDraft {
  osNumber: string;
  serviceType: ServiceType;
  serviceCode: string;
  answers: Record<string, Answer>;
}

/** Eletricista cadastrado no aparelho: escolhido no cabeçalho, preenche nome e matrícula. */
export interface Eletricista {
  id: string;
  nome: string;
  matricula: string;
}

/** Técnico líder cadastrado no aparelho (rodapé do Espelho de Campo). */
export interface Tecnico {
  id: string;
  nome: string;
  telefone: string;
}

/** Folha encerrada, guardada para baixar ou compartilhar o PDF de novo (histórico das últimas). */
export interface ClosedSheet {
  header: ShiftHeader;
  ordens: OrdemServico[];
  fechadaEm: string;
  /** Técnicos cadastrados quando a folha foi gerada (o PDF de novo sai igual mesmo se a lista mudar). */
  tecnicos: Tecnico[];
  /** Quando o PDF foi baixado pela 1ª vez ("Baixar PDF"); '' = ainda não (o histórico mostra "PDF não baixado"). */
  baixadaEm: string;
}

/** Quantas folhas encerradas ficam guardadas no aparelho (um turno por dia ≈ os últimos 4 dias). */
export const SHEETS_KEPT = 4;

export interface AppData {
  version: 3;
  header: ShiftHeader | null;
  ordens: OrdemServico[];
  draft: OSDraft | null;
  /** Últimas folhas encerradas, a mais recente primeiro (no máximo SHEETS_KEPT; a mais antiga sai). */
  sheets: ClosedSheet[];
  /** Último cabeçalho usado: preenche o próximo turno automaticamente (menos a data, que vem do sistema). */
  lastHeader: ShiftHeader | null;
  tecnicos: Tecnico[];
  eletricistas: Eletricista[];
  /**
   * Folha reaberta pelo "Editar" do histórico, como estava: o turno aberto é a correção dela. Gravada (e não só em
   * memória) para "Cancelar turno" devolvê-la ao histórico mesmo depois de o app fechar no meio da correção.
   */
  reaberta: ClosedSheet | null;
}

/** Linha pronta para exibir no app ou no PDF. */
export interface AnswerRow {
  question: string;
  display: string;
  skipped: boolean;
  isDitais: boolean;
}
