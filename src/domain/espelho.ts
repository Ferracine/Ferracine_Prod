import { questionsFor } from './catalog';
import { osLabel } from './format';
import type { Answer, EspelhoColumn, OrdemServico, Question } from './types';

/**
 * Linhas da tabela do Espelho de Campo (modelo em design/ex_pdf.jpeg).
 * As colunas próprias vêm das perguntas etiquetadas com `espelho` no catálogo; todas as outras respostas
 * preenchidas pelo eletricista vão para INFO ADICIONAL, como "Rótulo: resposta".
 */

export type EspelhoRow = { item: number; os: string; info: string } & Record<EspelhoColumn, string>;

/**
 * Texto que a resposta leva à folha: o texto digitado, SIM/NÃO, ou o complemento de um "Sim, qual?".
 * O "Não" de uma pergunta "se sim, qual?" não acrescenta nada e fica vazio (economiza espaço na célula).
 */
function answerValue(q: Question, ans: Answer | undefined): string {
  if (!ans || ans.kind === 'skipped') return '';
  if (ans.kind === 'text') return ans.value;
  if (q.type === 'yesno_detail') return ans.choice === 'Sim' ? (ans.detail ?? '') : '';
  return ans.choice;
}

function espelhoRow(os: OrdemServico, item: number): EspelhoRow {
  const cols: Record<EspelhoColumn, string[]> = { tipo: [], medidorInstalado: [], leituraInstalado: [], medidorRetirado: [], leituraRetirado: [] };
  const info: string[] = [];
  for (const q of questionsFor(os.serviceType)) {
    const v = answerValue(q, os.answers[q.id]);
    if (!v || q.prefillOS) continue; // o número da OS já tem coluna própria
    if (q.espelho) cols[q.espelho].push(v);
    else info.push(`${q.short ?? q.text}: ${v}`);
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
    info: info.join('; '),
  };
}

export function espelhoRows(ordens: readonly OrdemServico[]): EspelhoRow[] {
  return ordens.map((os, i) => espelhoRow(os, i + 1));
}
