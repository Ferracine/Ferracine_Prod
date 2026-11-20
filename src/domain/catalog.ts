import type { Question, ServiceType } from './types';

/**
 * Catálogo de códigos e perguntas da Folha de Produção, na ordem definida pelo dono do app.
 * Mudanças aqui alteram o assistente, a edição de OS e o PDF.
 * `espelho` liga a resposta a uma coluna própria do Espelho de Campo; as demais (inclusive "Qual tipo de serviço?")
 * entram em INFO ADICIONAL com o rótulo `short`. Os ids são estáveis: OSs salvas guardam as respostas por id.
 */

export const SERVICE_CODES: Record<ServiceType, readonly string[]> = {
  COMERCIAL: ['28', '709', '739', '33', '798'],
  OCORRENCIA: ['508', '509', '503', '531', '324', '533'],
};

export const SERVICE_LABEL: Record<ServiceType, string> = {
  COMERCIAL: 'COMERCIAL',
  OCORRENCIA: 'OCORRÊNCIA',
};

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
  { id: 'horaFin', text: 'Deseja informar a hora final?', type: 'text', placeholder: 'Ex: 09:40', input: 'time', espelho: 'horaFin' },
  { id: 'dificuldade', text: 'Houve alguma dificuldade, se sim qual?', type: 'yesno_detail', detailLabel: 'Qual foi a dificuldade?', placeholder: 'Descreva a dificuldade encontrada...', short: 'Dificuldade' },
];

const COMERCIAL: readonly Question[] = [
  { id: 'tipo', text: 'Qual tipo de serviço?', type: 'text', placeholder: 'Descreva o serviço comercial executado...', short: 'Tipo' },
  { id: 'kmIni', text: 'Deseja informar o KM inicial?', type: 'text', placeholder: 'Ex: 45210', input: 'numeric', espelho: 'kmIni' },
  { id: 'horaIni', text: 'Deseja informar a hora inicial?', type: 'text', placeholder: 'Ex: 08:15', input: 'time', espelho: 'horaIni' },
  { id: 'clientePresente', text: 'Cliente presente?', type: 'yesno', espelho: 'clientePresente' },
  { id: 'ramal', text: 'Foi necessário lançar ramal?', type: 'yesno', short: 'Lançou ramal' },
  { id: 'medidorInst', text: 'Foi instalado medidor? Se sim qual número?', type: 'yesno_detail', detailLabel: 'Número do medidor instalado:', placeholder: 'Digite o nº do medidor instalado...', espelho: 'medidorInstalado' },
  { id: 'medidorRet', text: 'Foi retirado medidor? Se sim qual número?', type: 'yesno_detail', detailLabel: 'Número do medidor retirado:', placeholder: 'Digite o nº do medidor retirado...', espelho: 'medidorRetirado' },
  { id: 'leituraInst', text: 'Qual leitura do medidor instalado?', type: 'text', placeholder: 'Digite a leitura atual...', input: 'decimal', espelho: 'leituraInstalado' },
  { id: 'leituraRet', text: 'Qual leitura do medidor retirado?', type: 'text', placeholder: 'Digite a leitura final...', input: 'decimal', espelho: 'leituraRetirado' },
  { id: 'kmFin', text: 'Deseja informar o KM final?', type: 'text', placeholder: 'Ex: 45235', input: 'numeric', espelho: 'kmFin' },
  { id: 'horaFin', text: 'Deseja informar o horário final?', type: 'text', placeholder: 'Ex: 09:40', input: 'time', espelho: 'horaFin' },
  { id: 'dificuldade', text: 'Houve alguma dificuldade na execução desse serviço? Se sim relate!', type: 'yesno_detail', detailLabel: 'Relate a dificuldade na execução:', placeholder: 'Relate detalhadamente...', short: 'Dificuldade' },
];

const QUESTIONS: Record<ServiceType, readonly Question[]> = { COMERCIAL, OCORRENCIA };

export function questionsFor(type: ServiceType): readonly Question[] {
  return QUESTIONS[type];
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
  },
};

/**
 * Perguntas antigas da ocorrência sem equivalente no catálogo atual. Na migração, as respostas delas viram o texto
 * `infoLegada` da OS e vão para INFO ADICIONAL: nada do que já foi registrado se perde.
 */
export const LEGACY_EXTRA_LABELS: Record<string, string> = {
  o12: 'Medidor instalado',
  o13: 'Medidor retirado',
  o14: 'Leitura medidor instalado',
  o15: 'Leitura medidor retirado',
  o16: 'KM inicial (2º)',
  o17: 'KM final (2º)',
  o18: 'Dificuldade na execução',
};
