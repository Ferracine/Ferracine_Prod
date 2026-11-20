import type { OrdemServico, ShiftHeader } from './types';

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

export function teamLabel(h: ShiftHeader): string {
  let label = `${h.nome1} (Mat: ${h.mat1})`;
  if (h.nome2.trim()) label += ` • ${h.nome2} (Mat: ${orDash(h.mat2)})`;
  return label;
}

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** Remove acentos e tudo que não for letra/número ("João" → "Joao"). */
function slug(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]/g, '');
}

export function pdfFileName(h: ShiftHeader): string {
  const firstName = slug(h.nome1.trim().split(/\s+/)[0] ?? '') || 'Equipe';
  const date = formatDateBR(h.data).replace(/\//g, '-');
  return `Folha_Producao_Energisa_${firstName}_${date}.pdf`;
}

export function countByType(ordens: readonly OrdemServico[]): { comercial: number; ocorrencia: number } {
  let comercial = 0;
  for (const os of ordens) if (os.serviceType === 'COMERCIAL') comercial++;
  return { comercial, ocorrencia: ordens.length - comercial };
}
