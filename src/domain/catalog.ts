import type { Answer, Choice, Question, ServiceType } from './types';

/**
 * Catálogo de códigos e perguntas da Folha de Produção, na ordem definida pelo dono do app.
 * Mudanças aqui alteram a tela da OS (nova e edição) e o PDF.
 * `espelho` liga a resposta a uma coluna própria do Espelho de Campo; as demais (inclusive "Qual tipo de serviço?")
 * entram em INFO ADICIONAL com o rótulo `short`. Os ids são estáveis: OSs salvas guardam as respostas por id.
 */

/** Códigos conhecidos de cada tipo. O app não os mostra: servem para recusar código do outro tipo (ordem.ts). */
export const SERVICE_CODES: Record<ServiceType, readonly string[]> = {
  COMERCIAL: ['28', '709', '739', '33', '798'],
  OCORRENCIA: ['508', '509', '503', '531', '324', '533'],
};

export const SERVICE_LABEL: Record<ServiceType, string> = {
  COMERCIAL: 'COMERCIAL',
  OCORRENCIA: 'OCORRÊNCIA',
};

function escolha(answers: Record<string, Answer>, id: string): Choice | undefined {
  const a = answers[id];
  return a?.kind === 'choice' ? a.choice : undefined;
}

/** Comercial: número e leitura do medidor instalado aparecem se instalou, ou se não instalou nem retirou (medidor da UC). */
function medidorDaUC(a: Record<string, Answer>): boolean {
  const inst = escolha(a, 'medidorInst');
  return inst === 'Sim' || (inst === 'Não' && escolha(a, 'medidorRet') === 'Não');
}

/** Comercial: número e leitura do medidor retirado só se retirou. */
const retirou = (a: Record<string, Answer>) => escolha(a, 'medidorRet') === 'Sim';

const MEDIDOR_INST_NUM: Question = { id: 'medidorInstNum', text: 'Digite o número do medidor instalado', type: 'text', placeholder: 'Nº do medidor...', espelho: 'medidorInstalado' };
const LEITURA_INST: Question = { id: 'leituraInst', text: 'Qual a leitura do medidor instalado?', type: 'text', placeholder: 'Leitura atual...', input: 'decimal', espelho: 'leituraInstalado' };

const OCORRENCIA: readonly Question[] = [
  { id: 'callback', text: 'Tentou callback?', type: 'yesno', short: 'Callback' },
  { id: 'os', text: 'Qual número da Ordem de serviço?', type: 'text', placeholder: 'Número da OS', input: 'numeric', prefillOS: true },
  { id: 'horaIni', text: 'Deseja informar a hora inicial?', type: 'text', placeholder: 'Ex: 08:15', input: 'time', espelho: 'horaIni' },
  { id: 'kmIni', text: 'Deseja informar o KM inicial?', type: 'text', placeholder: 'Ex: 45210', input: 'numeric', espelho: 'kmIni' },
  { id: 'tipo', text: 'Qual tipo de serviço?', type: 'text', placeholder: 'Descreva o tipo de serviço...', short: 'Tipo' },
  { id: 'defeito', text: 'Qual foi o defeito?', type: 'text', placeholder: 'Informe o defeito encontrado...', short: 'Defeito' },
  { id: 'dispositivo', text: 'Qual dispositivo manobrado?', type: 'text', placeholder: 'Ex: Chave fusível, religador, disjuntor...', short: 'Disp.' },
  { id: 'ditais', text: 'Houve necessidade de realizar os DITAIS?', type: 'yesno', required: true, isDitais: true, short: 'DITAIS' },
  { id: 'kmFin', text: 'Deseja informar o KM final?', type: 'text', placeholder: 'Ex: 45235', input: 'numeric', espelho: 'kmFin' },
  { id: 'alteracaoUC', text: 'Deseja informar alguma alteração feita na UC do cliente?', type: 'text', placeholder: 'Descreva a alteração na UC...', short: 'Alteração UC' },
  // Na ocorrência não há troca de medidor (isso é OS comercial): só o número e a leitura do medidor que está na UC.
  MEDIDOR_INST_NUM,
  LEITURA_INST,
  { id: 'horaFin', text: 'Deseja informar a hora final?', type: 'text', placeholder: 'Ex: 09:40', input: 'time', espelho: 'horaFin' },
  { id: 'dificuldade', text: 'Houve alguma dificuldade, se sim qual?', type: 'yesno_detail', detailLabel: 'Qual foi a dificuldade?', placeholder: 'Descreva a dificuldade encontrada...', short: 'Dificuldade' },
];

const COMERCIAL: readonly Question[] = [
  { id: 'tipo', text: 'Qual tipo de serviço?', type: 'text', placeholder: 'Descreva o serviço comercial executado...', short: 'Tipo' },
  { id: 'kmIni', text: 'Deseja informar o KM inicial?', type: 'text', placeholder: 'Ex: 45210', input: 'numeric', espelho: 'kmIni' },
  { id: 'horaIni', text: 'Deseja informar a hora inicial?', type: 'text', placeholder: 'Ex: 08:15', input: 'time', espelho: 'horaIni' },
  { id: 'clientePresente', text: 'Cliente presente?', type: 'yesno', espelho: 'clientePresente' },
  { id: 'ramal', text: 'Foi necessário lançar ramal?', type: 'yesno', short: 'Lançou ramal' },
  // Medidores: SIM abre o número e a leitura logo abaixo; com os dois NÃO, registra o medidor que ficou na UC.
  { id: 'medidorInst', text: 'Foi instalado medidor?', type: 'yesno', semInfo: true },
  { ...MEDIDOR_INST_NUM, showIf: medidorDaUC },
  { ...LEITURA_INST, showIf: medidorDaUC },
  { id: 'medidorRet', text: 'Foi retirado medidor?', type: 'yesno', semInfo: true },
  { id: 'medidorRetNum', text: 'Digite o número do medidor retirado', type: 'text', placeholder: 'Nº do medidor retirado...', espelho: 'medidorRetirado', showIf: retirou },
  { id: 'leituraRet', text: 'Qual a leitura do medidor retirado?', type: 'text', placeholder: 'Leitura final...', input: 'decimal', espelho: 'leituraRetirado', showIf: retirou },
  { id: 'kmFin', text: 'Deseja informar o KM final?', type: 'text', placeholder: 'Ex: 45235', input: 'numeric', espelho: 'kmFin' },
  { id: 'horaFin', text: 'Deseja informar o horário final?', type: 'text', placeholder: 'Ex: 09:40', input: 'time', espelho: 'horaFin' },
  { id: 'dificuldade', text: 'Houve alguma dificuldade na execução desse serviço? Se sim relate!', type: 'yesno_detail', detailLabel: 'Relate a dificuldade na execução:', placeholder: 'Relate detalhadamente...', short: 'Dificuldade' },
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

/**
 * Ids da versão anterior do catálogo (c1..c3, o1..o18) → ids atuais, para não perder OSs de um turno aberto
 * na atualização. Perguntas que deixaram de existir no tipo ficam de fora (resposta descartada).
 */
export const LEGACY_QUESTION_IDS: Record<ServiceType, Record<string, string>> = {
  COMERCIAL: { c1: 'tipo', c2: 'clientePresente', c3: 'ramal' },
  OCORRENCIA: {
    o1: 'tipo',
    o2: 'os',
    o3: 'callback',
    o4: 'defeito',
    o5: 'dispositivo',
    o6: 'ditais',
    o7: 'kmIni',
    o8: 'kmFin',
    o9: 'horaIni',
    o10: 'horaFin',
    o11: 'dificuldade',
    o12: 'medidorInst',
    o14: 'leituraInst',
  },
};

/**
 * Perguntas antigas da ocorrência sem equivalente no catálogo atual. Na migração, as respostas delas viram o texto
 * `infoLegada` da OS e vão para INFO ADICIONAL: nada do que já foi registrado se perde.
 */
export const LEGACY_EXTRA_LABELS: Record<string, string> = {
  o13: 'Medidor retirado',
  o15: 'Leitura medidor retirado',
  o16: 'KM inicial (2º)',
  o17: 'KM final (2º)',
  o18: 'Dificuldade na execução',
};
