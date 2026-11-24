import { visibleQuestions } from './catalog';
import { osLabel } from './format';
import { describeAnswer } from './ordem';
import { ESPELHO_COLUMNS, type EspelhoColumn, type OrdemServico } from './types';

/**
 * Linhas da tabela do Espelho de Campo. A coluna CÓDIGO traz o código do serviço; as colunas próprias (KM,
 * horários, medidores, leituras, cliente presente) vêm das perguntas etiquetadas com `espelho` no catálogo; todas
 * as outras respostas (tipo de serviço, defeito, informações adicionais...) vão para INFORMAÇÃO ADICIONAL como "Rótulo: resposta".
 */

export type EspelhoRow = { item: number; os: string; codigo: string; info: string } & Record<EspelhoColumn, string>;

function espelhoRow(os: OrdemServico, item: number): EspelhoRow {
  const cols = Object.fromEntries(ESPELHO_COLUMNS.map((c) => [c, ''])) as Record<EspelhoColumn, string>;
  const info: string[] = [];
  for (const q of visibleQuestions(os.serviceType, os.answers)) {
    const v = describeAnswer(os.answers[q.id]) ?? '';
    if (!v) continue;
    if (q.espelho) cols[typeof q.espelho === 'function' ? q.espelho(os.answers) : q.espelho] = v;
    else if (q.semInfo) continue; // pergunta de controle (ex.: "Foi instalado novo medidor?"): as colunas já dizem
    else info.push(q.semRotulo ? v : `${q.short ?? q.text}: ${v}`);
  }
  return { item, os: osLabel(os.osNumber), codigo: os.serviceCode, ...cols, info: info.join('; ') };
}

export function espelhoRows(ordens: readonly OrdemServico[]): EspelhoRow[] {
  return ordens.map((os, i) => espelhoRow(os, i + 1));
}
