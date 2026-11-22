import type { ShiftHeader } from './types';

/** AAAA-MM-DD → DD/MM/AAAA, sem passar por Date (evita erro de fuso). */
export function formatDateBR(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

/** Data local de hoje em AAAA-MM-DD (o valor que o <input type="date"> espera). */
export function todayISO(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

export function formatHorario(h: Pick<ShiftHeader, 'horaInicio' | 'horaFim'>): string {
  return `${h.horaInicio} às ${h.horaFim}`;
}

export function orDash(value: string): string {
  return value.trim() || '-';
}

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** OS sem número aparece como "S/N". */
export function osLabel(osNumber: string): string {
  return osNumber || 'S/N';
}

/** Remove acentos e troca o que não for letra/número por "_" ("João da Silva" → "Joao_da_Silva"). */
function slug(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Nomes da equipe + data do turno + quantidade de serviços: "Joao_da_Silva_Marcos_Lima_20-11-2026_3_servicos.pdf" (ou .xlsx).
 * A data separa as folhas de dias diferentes da mesma equipe (histórico, Downloads, WhatsApp).
 */
export function sheetFileName(h: ShiftHeader, qtd: number, ext: 'pdf' | 'xlsx'): string {
  const names = [slug(h.nome1), slug(h.nome2)].filter(Boolean);
  if (names.length === 0) names.push('Equipe');
  const data = formatDateBR(h.data).replaceAll('/', '-');
  return `${names.join('_')}${data ? `_${data}` : ''}_${qtd}_${qtd === 1 ? 'servico' : 'servicos'}.${ext}`;
}
