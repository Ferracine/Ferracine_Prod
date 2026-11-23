import type { Answer, Choice, Question, ServiceType } from './types';

/**
 * Catálogo de perguntas da Folha de Produção, por tipo de OS, na ordem definida pelo dono do app.
 * Mudanças aqui alteram a tela da OS (nova e edição) e o PDF.
 * `espelho` liga a resposta a uma coluna própria do Espelho de Campo; as demais (inclusive "Qual tipo de serviço?")
 * entram em INFO ADICIONAL com o rótulo `short`. Os ids são estáveis: OSs salvas guardam as respostas por id.
 */

export const SERVICE_LABEL: Record<ServiceType, string> = {
  COMERCIAL: 'COMERCIAL',
  OCORRENCIA: 'OCORRÊNCIA',
};

/** SIM/NÃO respondido na pergunta `id` (ou undefined). */
export function escolha(answers: Record<string, Answer>, id: string): Choice | undefined {
  const a = answers[id];
  return a?.kind === 'choice' ? a.choice : undefined;
}

/** Comercial: "Foi instalado novo medidor?" = SIM (troca de medidor). */
const trocou = (a: Record<string, Answer>) => escolha(a, 'novoMedidor') === 'Sim';

const MEDIDOR_INST_NUM: Question = { id: 'medidorInstNum', text: 'Digite o número do medidor instalado', type: 'text', placeholder: 'Nº do medidor...', espelho: 'medidorInstalado' };
const LEITURA_INST: Question = { id: 'leituraInst', text: 'Qual a leitura do medidor instalado?', type: 'text', placeholder: 'Leitura atual...', input: 'decimal', espelho: 'leituraInstalado' };
// Perguntas iguais nos dois tipos (mesmo id, texto e coluna do PDF).
const HORA_INI: Question = { id: 'horaIni', text: 'Deseja informar a hora inicial?', type: 'text', placeholder: 'Ex: 08:15', input: 'time', espelho: 'horaIni' };
const KM_INI: Question = { id: 'kmIni', text: 'Deseja informar o KM inicial?', type: 'text', placeholder: 'Ex: 45210', input: 'numeric', espelho: 'kmIni' };
const KM_FIN: Question = { id: 'kmFin', text: 'Deseja informar o KM final?', type: 'text', placeholder: 'Ex: 45235', input: 'numeric', espelho: 'kmFin' };
/** Caixa aberta, a última nos dois tipos: o eletricista relata o que achar necessário; vai direto para INFO ADICIONAL. */
const INFO_ADICIONAL: Question = {
  id: 'infoAdicional',
  text: 'Informações adicionais',
  type: 'text',
  input: 'longo',
  placeholder: 'Relate o que achar necessário (dificuldades, observações...)',
  semRotulo: true,
};
/** Segurança: obrigatória nos dois tipos (a OS comercial também pode ter o procedimento). */
const DITAIS: Question = { id: 'ditais', text: 'Houve necessidade de realizar os DITAIS?', type: 'yesno', required: true, isDitais: true, short: 'DITAIS' };

const OCORRENCIA: readonly Question[] = [
  { id: 'callback', text: 'Tentou callback?', type: 'yesno', short: 'Callback' },
  HORA_INI,
  KM_INI,
  { id: 'tipo', text: 'Qual tipo de serviço?', type: 'text', placeholder: 'Descreva o tipo de serviço...', short: 'Tipo' },
  { id: 'defeito', text: 'Qual foi o defeito?', type: 'text', placeholder: 'Informe o defeito encontrado...', short: 'Defeito' },
  { id: 'dispositivo', text: 'Qual dispositivo manobrado?', type: 'text', placeholder: 'Ex: Chave fusível, religador, disjuntor...', short: 'Disp.' },
  DITAIS,
  KM_FIN,
  { id: 'alteracaoUC', text: 'Deseja informar alguma alteração feita na UC do cliente?', type: 'text', placeholder: 'Descreva a alteração na UC...', short: 'Alteração UC' },
  // Na ocorrência não há troca de medidor (isso é OS comercial): só o número e a leitura do medidor que está na UC.
  MEDIDOR_INST_NUM,
  LEITURA_INST,
  { id: 'horaFin', text: 'Deseja informar a hora final?', type: 'text', placeholder: 'Ex: 09:40', input: 'time', espelho: 'horaFin' },
  INFO_ADICIONAL,
];

const COMERCIAL: readonly Question[] = [
  { id: 'tipo', text: 'Qual tipo de serviço?', type: 'text', placeholder: 'Descreva o serviço comercial executado...', short: 'Tipo' },
  KM_INI,
  HORA_INI,
  { id: 'clientePresente', text: 'Cliente presente?', type: 'yesno', espelho: 'clientePresente' },
  { id: 'ramal', text: 'Foi necessário lançar ramal?', type: 'yesno', short: 'Lançou ramal' },
  // Medidor da UC (sempre). "Foi instalado novo medidor?" SIM abre o número e a leitura do novo; na troca, o
  // Espelho de Campo leva o novo em MEDIDOR INSTALADO e o da UC em MEDIDOR RETIRADO.
  { ...MEDIDOR_INST_NUM, espelho: (a) => (trocou(a) ? 'medidorRetirado' : 'medidorInstalado') },
  { ...LEITURA_INST, espelho: (a) => (trocou(a) ? 'leituraRetirado' : 'leituraInstalado') },
  { id: 'novoMedidor', text: 'Foi instalado novo medidor?', type: 'yesno', semInfo: true },
  { id: 'novoMedidorNum', text: 'Digite o número do medidor novo', type: 'text', placeholder: 'Nº do medidor novo...', espelho: 'medidorInstalado', showIf: trocou },
  { id: 'novoLeitura', text: 'Qual a leitura do medidor novo?', type: 'text', placeholder: 'Leitura do medidor novo...', input: 'decimal', espelho: 'leituraInstalado', showIf: trocou },
  DITAIS,
  KM_FIN,
  { id: 'horaFin', text: 'Deseja informar o horário final?', type: 'text', placeholder: 'Ex: 09:40', input: 'time', espelho: 'horaFin' },
  INFO_ADICIONAL,
];

const QUESTIONS: Record<ServiceType, readonly Question[]> = { COMERCIAL, OCORRENCIA };

export function questionsFor(type: ServiceType): readonly Question[] {
  return QUESTIONS[type];
}

/** A pergunta aparece com estas respostas (sem `showIf`, sempre). */
export function isVisible(q: Question, answers: Record<string, Answer>): boolean {
  return !q.showIf || q.showIf(answers);
}

/** Perguntas que valem com estas respostas (as escondidas por `showIf` ficam de fora). */
export function visibleQuestions(type: ServiceType, answers: Record<string, Answer>): readonly Question[] {
  return questionsFor(type).filter((q) => isVisible(q, answers));
}
