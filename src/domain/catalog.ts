import type { Question, ServiceType } from './types';

/**
 * Catálogo de códigos e perguntas da Folha de Produção.
 * Os textos são os da versão original do app (design/index_base.html); mudanças aqui alteram o app e o PDF.
 */

export const SERVICE_CODES: Record<ServiceType, readonly string[]> = {
  COMERCIAL: ['28', '709', '739', '33', '798'],
  OCORRENCIA: ['508', '509', '503', '531', '324', '533'],
};

export const SERVICE_LABEL: Record<ServiceType, string> = {
  COMERCIAL: 'COMERCIAL',
  OCORRENCIA: 'OCORRÊNCIA',
};

const COMERCIAL: readonly Question[] = [
  { id: 'c1', text: 'Qual tipo de serviço?', type: 'text', placeholder: 'Descreva o serviço comercial executado...', espelho: 'tipo' },
  { id: 'c2', text: 'Cliente presente?', type: 'yesno' },
  { id: 'c3', text: 'Foi necessário lançar ramal?', type: 'yesno' },
];

const OCORRENCIA: readonly Question[] = [
  { id: 'o1', text: 'Qual tipo de serviço?', type: 'text', placeholder: 'Descreva o tipo de serviço...', espelho: 'tipo' },
  { id: 'o2', text: 'Qual número da Ordem de serviço?', type: 'text', placeholder: 'Número da OS', input: 'numeric', prefillOS: true },
  { id: 'o3', text: 'Tentou callback?', type: 'yesno' },
  { id: 'o4', text: 'Qual foi o defeito?', type: 'text', placeholder: 'Informe o defeito encontrado...' },
  { id: 'o5', text: 'Qual dispositivo manobrado?', type: 'text', placeholder: 'Ex: Chave fusível, religador, disjuntor...' },
  { id: 'o6', text: 'Houve necessidade de realizar os DITAIS?', type: 'yesno', required: true, isDitais: true },
  { id: 'o7', text: 'Deseja informar o KM inicial?', type: 'text', placeholder: 'Ex: 45210', input: 'numeric' },
  { id: 'o8', text: 'Deseja informar o KM Final?', type: 'text', placeholder: 'Ex: 45235', input: 'numeric' },
  { id: 'o9', text: 'Deseja informar a hora inicial?', type: 'text', placeholder: 'Ex: 08:15', input: 'time' },
  { id: 'o10', text: 'Deseja informar a hora final?', type: 'text', placeholder: 'Ex: 09:40', input: 'time' },
  { id: 'o11', text: 'Houve alguma dificuldade, se sim qual?', type: 'yesno_detail', detailLabel: 'Qual foi a dificuldade?', placeholder: 'Descreva a dificuldade encontrada...', espelho: 'desvios' },
  { id: 'o12', text: 'Foi instalado medidor? Se sim qual número?', type: 'yesno_detail', detailLabel: 'Número do medidor instalado:', placeholder: 'Digite o nº do medidor instalado...', espelho: 'medidorInstalado' },
  { id: 'o13', text: 'Foi retirado medidor? Se sim qual número?', type: 'yesno_detail', detailLabel: 'Número do medidor retirado:', placeholder: 'Digite o nº do medidor retirado...', espelho: 'medidorRetirado' },
  { id: 'o14', text: 'Qual leitura do medidor instalado?', type: 'text', placeholder: 'Digite a leitura atual...', input: 'decimal', espelho: 'leituraInstalado' },
  { id: 'o15', text: 'Qual leitura do medidor retirado?', type: 'text', placeholder: 'Digite a leitura final...', input: 'decimal', espelho: 'leituraRetirado' },
  { id: 'o16', text: 'Deseja informar o KM inicial?', type: 'text', placeholder: 'Ex: 45235', input: 'numeric' },
  { id: 'o17', text: 'Deseja informar o KM final?', type: 'text', placeholder: 'Ex: 45250', input: 'numeric' },
  { id: 'o18', text: 'Houve alguma dificuldade na execução desse serviço? Se sim relate!', type: 'yesno_detail', detailLabel: 'Relate a dificuldade na execução:', placeholder: 'Relate detalhadamente...', espelho: 'desvios' },
];

const QUESTIONS: Record<ServiceType, readonly Question[]> = { COMERCIAL, OCORRENCIA };

/** Técnicos líderes do rodapé do Espelho de Campo, como estão no modelo de papel. */
export const TECNICOS_LIDERES: readonly string[] = [
  'TEC. FULANO DE TAL - 69 90000-0001',
  'TEC. BELTRANO SOUZA - 69 90000-0002',
  'TEC. CICRANO LIMA - 69 90000-0003',
];

export function questionsFor(type: ServiceType): readonly Question[] {
  return QUESTIONS[type];
}
