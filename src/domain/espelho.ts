import { visibleQuestions } from './catalog';
import { osLabel } from './format';
import { ESPELHO_COLUMNS, type Answer, type EspelhoColumn, type OrdemServico, type Question } from './types';

/**
 * Linhas da tabela do Espelho de Campo. A coluna TIPO DE SERVIÇO traz só o código; as colunas próprias (KM,
 * horários, medidores, leituras, cliente presente) vêm das perguntas etiquetadas com `espelho` no catálogo; todas
 * as outras respostas (tipo de serviço, defeito, dificuldades...) vão para INFO ADICIONAL como "Rótulo: resposta".
 */

export type EspelhoRow = { item: number; os: string; codigo: string; info: string } & Record<EspelhoColumn, string>;

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
  const cols = Object.fromEntries(ESPELHO_COLUMNS.map((c) => [c, ''])) as Record<EspelhoColumn, string>;
  const info: string[] = [];
  for (const q of visibleQuestions(os.serviceType, os.answers)) {
    const v = answerValue(q, os.answers[q.id]);
    if (!v || q.prefillOS) continue; // o número da OS já tem coluna própria
    if (q.espelho) cols[typeof q.espelho === 'function' ? q.espelho(os.answers) : q.espelho] = v;
    else if (q.semInfo) continue; // pergunta de controle (ex.: "Foi instalado novo medidor?"): as colunas já dizem
    else info.push(`${q.short ?? q.text}: ${v}`);
  }
  // Respostas de perguntas que saíram do catálogo (OSs registradas antes da atualização).
  if (os.infoLegada) info.push(os.infoLegada);
  return { item, os: osLabel(os.osNumber), codigo: os.serviceCode, ...cols, info: info.join('; ') };
}

export function espelhoRows(ordens: readonly OrdemServico[]): EspelhoRow[] {
  return ordens.map((os, i) => espelhoRow(os, i + 1));
}
