import type { ClosedSheet, ShiftHeader } from './types';

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
 * Nome do PDF: nomes da equipe + data do turno + quantidade de serviços: "Joao_da_Silva_Marcos_Lima_20-11-2026_3_servicos.pdf".
 * A data separa as folhas de dias diferentes da mesma equipe (histórico, Downloads, WhatsApp).
 */
export function sheetFileName(h: ShiftHeader, qtd: number): string {
  const names = [slug(h.nome1), slug(h.nome2)].filter(Boolean);
  if (names.length === 0) names.push('Equipe');
  const data = formatDateBR(h.data).replaceAll('/', '-');
  return `${names.join('_')}${data ? `_${data}` : ''}_${qtd}_${qtd === 1 ? 'servico' : 'servicos'}.pdf`;
}

/** "20/11/2026 17:32 • JOAO • 3 OSs": a hora do encerramento separa dois turnos do mesmo dia. */
export function sheetLabel(sheet: ClosedSheet): string {
  const fechada = new Date(sheet.fechadaEm);
  const hora = Number.isNaN(fechada.getTime()) ? '' : ` ${fechada.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  return `${formatDateBR(sheet.header.data)}${hora} • ${sheet.header.nome1} • ${plural(sheet.ordens.length, 'OS', 'OSs')}`;
}

/** Mesmo eletricista: mesmo nome e matrícula (sem diferença de maiúsculas/espaços). Eletricista 1 e 2 não podem ser. */
export function mesmaPessoa(a: { nome: string; matricula: string } | null | undefined, b: { nome: string; matricula: string } | null | undefined): boolean {
  const chave = (p: { nome: string; matricula: string }) => `${p.nome.trim().toUpperCase()}|${p.matricula.trim().toUpperCase()}`;
  return !!a && !!b && chave(a) === chave(b);
}
