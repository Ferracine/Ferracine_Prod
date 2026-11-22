import { ClipboardList, Eye, FileDown, Pencil, Plus, Trash2 } from 'lucide';
import { SERVICE_LABEL } from '../domain/catalog';
import { formatDateBR, formatHorario, orDash, osLabel, plural } from '../domain/format';
import type { OrdemServico, ServiceType, ShiftHeader } from '../domain/types';
import { answerRows } from '../domain/ordem';
import { btn, h, icon } from './dom';

export interface DashboardProps {
  header: ShiftHeader;
  ordens: readonly OrdemServico[];
  /** "+" Comercial / "+" Ocorrência: abre a tela da OS em branco com as perguntas do tipo. */
  onNewOS: (type: ServiceType) => void;
  onView: (os: OrdemServico) => void;
  /** Lápis: edição completa da OS (número, código e qualquer resposta). */
  onEdit: (os: OrdemServico) => void;
  onDelete: (os: OrdemServico) => void;
  onEditHeader: () => void;
  onFinish: () => void;
}

/** Cores do selo de tipo (lista e tela da OS): Comercial = ciano do logo, Ocorrência = laranja do logo. */
export const TYPE_BADGE: Record<ServiceType, string> = {
  COMERCIAL: 'bg-brand/15 text-brand-fg',
  OCORRENCIA: 'bg-accent/15 text-accent-fg',
};

const BADGE = 'text-[11px] font-bold px-2 py-0.5 rounded-md';

/** "+" de cada tipo: Comercial = ciano do logo, Ocorrência = laranja do logo (classes por extenso para o Tailwind). */
const PLUS_COLORS: Record<ServiceType, string> = {
  COMERCIAL: 'bg-brand-600 hover:bg-brand-700 shadow-brand/30',
  OCORRENCIA: 'bg-accent-600 hover:bg-accent-700 shadow-accent/30',
};

/** "+" de nova OS: círculo colorido do tipo com o rótulo embaixo; a coluna inteira é a área de toque. */
function botaoNovaOS(type: ServiceType, onClick: () => void): HTMLElement {
  return h(
    'button',
    { type: 'button', id: `btn-new-${type.toLowerCase()}`, 'aria-label': `Nova OS ${SERVICE_LABEL[type]}`, class: 'flex flex-col items-center gap-2 group w-full rounded-xl py-1', onClick },
    h('span', { class: `size-16 rounded-full text-white shadow-lg flex items-center justify-center transition-all group-active:scale-95 ${PLUS_COLORS[type]}` }, icon(Plus, 'w-8 h-8')),
    h('span', { class: 'text-xs font-extrabold tracking-wide text-fg' }, SERVICE_LABEL[type]),
  );
}

function osRow(os: OrdemServico, index: number, p: DashboardProps): HTMLElement {
  const rows = answerRows(os);
  const answered = rows.filter((r) => !r.skipped).length;
  const time = new Date(os.registradaEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const label = osLabel(os.osNumber);
  const action = (title: string, cls: string, node: Parameters<typeof icon>[0], onClick: () => void) =>
    h('button', { type: 'button', title, 'aria-label': `${title} OS ${label}`, class: `${btn('outline', 'icon')} ${cls}`, onClick }, icon(node, 'w-5 h-5'));

  return h(
    'li',
    { class: 'flex items-center justify-between p-4 rounded-xl border border-fg/10 bg-fg/[0.03] gap-3', 'data-testid': 'os-item' },
    h(
      'div',
      { class: 'min-w-0' },
      h('span', { class: 'font-extrabold text-fg text-base break-all' }, `#${index + 1} • OS ${label}`),
      h(
        'div',
        { class: 'flex items-center gap-1.5 flex-wrap mt-1' },
        !os.osNumber && h('span', { class: `${BADGE} bg-rose-500/15 text-danger-fg` }, 'sem nº'),
        h('span', { class: `${BADGE} ${TYPE_BADGE[os.serviceType]}` }, SERVICE_LABEL[os.serviceType]),
        h('span', { class: `${BADGE} bg-fg/10 text-fg` }, `Cód. ${os.serviceCode}`),
      ),
      h('p', { class: 'text-xs text-muted mt-1' }, `${answered} de ${rows.length} respondidas • ${time}`),
    ),
    h(
      'div',
      { class: 'flex items-center gap-1.5 shrink-0' },
      action('Editar', 'text-accent-fg hover:bg-fg/10', Pencil, () => p.onEdit(os)),
      action('Ver respostas', 'text-brand-fg hover:bg-fg/10', Eye, () => p.onView(os)),
      action('Excluir', 'text-danger-fg hover:bg-rose-500/10', Trash2, () => p.onDelete(os)),
    ),
  );
}

export function dashboardScreen(p: DashboardProps): HTMLElement {
  const { header, ordens } = p;
  const list =
    ordens.length === 0
      ? h(
          'div',
          { class: 'text-center py-8 px-4 bg-fg/[0.03] rounded-xl border border-dashed border-fg/15' },
          h('p', { class: 'text-sm font-semibold text-muted' }, 'Nenhuma Ordem de Serviço registrada ainda.'),
          h('p', { class: 'text-xs text-subtle mt-1' }, 'Toque no + Comercial ou no + Ocorrência para registrar a primeira OS do turno.'),
        )
      : h('ul', { class: 'space-y-3' }, ordens.map((os, i) => osRow(os, i, p)));

  const bodycams = [header.bodycam1, header.bodycam2].map((b) => b.trim()).filter(Boolean).join(' / ');
  // Uma informação por linha, rótulo à esquerda e valor à direita (o eletricista 2 só se houver dupla).
  const linhas: [string, string][] = [
    ['Eletricista 1', header.nome1],
    ['Matrícula', orDash(header.mat1)],
    ...(header.nome2.trim() ? ([['Eletricista 2', header.nome2], ['Matrícula', orDash(header.mat2)]] as [string, string][]) : []),
    ['Equipe', orDash(header.equipe)],
    ['Viatura', orDash(header.viatura)],
    ['Bodycam', orDash(bodycams)],
  ];

  return h(
    'section',
    { id: 'screen-dashboard', class: 'space-y-6' },
    h(
      'div',
      { class: 'card p-5' },
      h(
        'div',
        { class: 'flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-fg/10' },
        h('span', { class: 'text-[11px] font-extrabold uppercase tracking-widest text-accent-fg' }, 'Cabeçalho ativo do turno'),
        h(
          'div',
          { class: 'flex items-center gap-2' },
          h('span', { class: 'text-xs bg-fg/10 px-3 py-1 rounded-full font-semibold text-fg' }, `${formatDateBR(header.data)} | ${formatHorario(header)}`),
          h('button', { type: 'button', class: btn('neutral', 'sm'), onClick: p.onEditHeader }, icon(Pencil, 'w-3.5 h-3.5'), 'Corrigir'),
        ),
      ),
      h(
        'dl',
        { class: 'text-sm divide-y divide-fg/5', 'data-testid': 'header-info' },
        linhas.map(([rotulo, valor]) =>
          h(
            'div',
            { class: 'flex items-baseline justify-between gap-4 py-2' },
            h('dt', { class: 'text-subtle text-xs shrink-0' }, rotulo),
            h('dd', { class: 'font-bold text-fg text-right break-words min-w-0' }, valor),
          ),
        ),
      ),
    ),
    // Nova OS: um "+" por tipo; cada um abre a tela da OS em branco com as perguntas daquele tipo.
    h(
      'div',
      { class: 'grid grid-cols-2 gap-4 max-w-xs mx-auto' },
      (['COMERCIAL', 'OCORRENCIA'] as const).map((type) => botaoNovaOS(type, () => p.onNewOS(type))),
    ),
    h(
      'div',
      { class: 'card p-6 space-y-4' },
      h(
        'div',
        { class: 'flex items-center justify-between border-b border-fg/10 pb-3' },
        h('div', { class: 'flex items-center gap-2' }, icon(ClipboardList, 'w-5 h-5 text-brand-fg'), h('h3', { class: 'font-extrabold text-fg text-base' }, 'OSs concluídas no turno')),
        h('span', { id: 'os-count-badge', class: 'bg-brand-600 text-white text-xs font-bold px-3 py-1 rounded-full' }, plural(ordens.length, 'OS', 'OSs')),
      ),
      list,
    ),
    h(
      'div',
      { class: 'pt-2 pb-8' },
      h(
        'button',
        { type: 'button', id: 'btn-finish', class: `${btn('accent', 'lg')} w-full shadow-lg shadow-accent/20`, onClick: p.onFinish },
        icon(FileDown, 'w-5 h-5'),
        'Finalizar turno e gerar PDF',
      ),
      h('p', { class: 'text-center text-xs text-subtle mt-2.5' }, 'Gera o Espelho de Campo. O turno só é encerrado depois que você confirmar que tem o PDF em mãos.'),
    ),
  );
}
