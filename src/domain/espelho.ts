import { questionsFor } from './catalog';
import { osLabel } from './format';
import type { Answer, EspelhoColumn, OrdemServico } from './types';

/**
 * Linhas da tabela do Espelho de Campo (modelo em design/espelho_de_campo.md).
 * Cada coluna vem das perguntas etiquetadas com `espelho` no catálogo; as demais respostas vão para o
 * anexo de detalhamento do PDF.
 */

export const ESPELHO_MIN_LINHAS = 20;

export type EspelhoRow = { item: number; os: string } & Record<EspelhoColumn, string>;

/** Texto que a resposta leva ao espelho: o texto digitado ou o complemento de um "Sim, qual?". */
function value(ans: Answer | undefined): string {
  if (ans?.kind === 'text') return ans.value;
  if (ans?.kind === 'choice' && ans.choice === 'Sim') return ans.detail ?? '';
  return '';
}

function espelhoRow(os: OrdemServico, item: number): EspelhoRow {
  const cols: Record<EspelhoColumn, string[]> = { tipo: [], medidorInstalado: [], leituraInstalado: [], medidorRetirado: [], leituraRetirado: [], desvios: [] };
  for (const q of questionsFor(os.serviceType)) {
    const v = q.espelho && value(os.answers[q.id]);
    if (q.espelho && v) cols[q.espelho].push(v);
  }
  const join = (c: EspelhoColumn) => cols[c].join('; ');
  return {
    item,
    os: osLabel(os.osNumber),
    tipo: [os.serviceCode, ...cols.tipo].join(' - '),
    medidorInstalado: join('medidorInstalado'),
    leituraInstalado: join('leituraInstalado'),
    medidorRetirado: join('medidorRetirado'),
    leituraRetirado: join('leituraRetirado'),
    desvios: join('desvios'),
  };
}

export function espelhoRows(ordens: readonly OrdemServico[]): EspelhoRow[] {
  return ordens.map((os, i) => espelhoRow(os, i + 1));
}
