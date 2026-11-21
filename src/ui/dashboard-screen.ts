import { Briefcase, ClipboardList, Eye, FileDown, Pencil, Plus, Trash2, TriangleAlert } from 'lucide';
import { SERVICE_CODES, SERVICE_LABEL, questionsFor } from '../domain/catalog';
import { formatDateBR, formatHorario, orDash, osLabel, plural, teamLabel } from '../domain/format';
import type { OrdemServico, ServiceType, ShiftHeader } from '../domain/types';
import { answerRows } from '../domain/ordem';
import { h, icon, onEnter } from './dom';
import { showToast } from './feedback';

export interface DashboardProps {
  header: ShiftHeader;
  ordens: readonly OrdemServico[];
  /** Botão "+": abre a escolha do tipo e do código (serviceChooser). */
  onNewOS: () => void;
  onView: (os: OrdemServico) => void;
  /** Lápis: edição completa da OS (número, código e qualquer resposta). */
  onEdit: (os: OrdemServico) => void;
  onDelete: (os: OrdemServico) => void;
  onEditHeader: () => void;
  onFinish: () => void;
}

/** Cores do selo de tipo (lista, tela da OS e escolha do serviço): Comercial = ciano do logo, Ocorrência = laranja do logo. */
export const TYPE_BADGE: Record<ServiceType, string> = {
  COMERCIAL: 'bg-brand/15 text-brand-fg',
  OCORRENCIA: 'bg-accent/15 text-accent-fg',
};

const BADGE = 'text-[11px] font-bold px-2 py-0.5 rounded-md';

// Só as cores mudam entre os tipos; o Tailwind precisa das classes escritas por extenso.
const TYPE_COLORS: Record<ServiceType, { box: string; title: string; code: string; start: string; divider: string }> = {
  COMERCIAL: {
    box: 'border-brand/35 bg-brand/[0.06]',
    title: 'text-brand-fg',
    code: 'bg-brand/10 hover:bg-brand-600 text-brand-fg hover:text-white border-brand/40',
    start: 'bg-brand-600 hover:bg-brand-700 text-white',
    divider: 'border-brand/20',
  },
  OCORRENCIA: {
    box: 'border-accent/35 bg-accent/[0.06]',
    title: 'text-accent-fg',
    code: 'bg-accent/10 hover:bg-accent-600 text-accent-fg hover:text-white border-accent/40',
    start: 'bg-accent-600 hover:bg-accent-700 text-white',
    divider: 'border-accent/20',
  },
};

function osRow(os: OrdemServico, index: number, p: DashboardProps): HTMLElement {
  const rows = answerRows(os);
  const answered = rows.filter((r) => !r.skipped).length;
  const time = new Date(os.registradaEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const label = osLabel(os.osNumber);
  const action = (title: string, cls: string, node: Parameters<typeof icon>[0], onClick: () => void) =>
    h('button', { type: 'button', title, 'aria-label': `${title} OS ${label}`, class: `p-3 rounded-xl bg-fg/5 border border-fg/10 transition-colors ${cls}`, onClick }, icon(node));

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

/** Janela do "+": Comercial e Ocorrência com os códigos da lista e "Outro código". */
export function serviceChooser(onPick: (type: ServiceType, code: string) => void): HTMLElement {
  const typeBlock = (type: ServiceType) => {
    const c = TYPE_COLORS[type];
    const customId = `custom-code-${type.toLowerCase()}`;
    const startCustom = () => {
      const code = customInput.value.trim().toUpperCase();
      if (!code) {
        showToast('Digite o código do serviço.', 'warning');
        customInput.focus();
        return;
      }
      onPick(type, code);
    };
    const customInput = h('input', {
      id: customId,
      type: 'text',
      inputmode: 'numeric',
      autocomplete: 'off',
      placeholder: type === 'COMERCIAL' ? 'Ex: 710' : 'Ex: 510',
      maxlength: 10,
      class: 'field py-2.5 text-sm',
      onKeydown: onEnter(startCustom),
    });

    return h(
      'div',
      { class: `rounded-xl p-4 space-y-3 border ${c.box}` },
      h(
        'div',
        { class: 'flex items-center justify-between' },
        h('span', { class: `font-extrabold text-sm flex items-center gap-1.5 ${c.title}` }, icon(type === 'COMERCIAL' ? Briefcase : TriangleAlert), SERVICE_LABEL[type]),
        h('span', { class: `${BADGE} ${TYPE_BADGE[type]}` }, plural(questionsFor(type).length, 'pergunta', 'perguntas')),
      ),
      h('p', { class: 'text-xs text-muted' }, 'Toque no código:'),
      h(
        'div',
        { class: 'flex flex-wrap gap-2' },
        SERVICE_CODES[type].map((code) =>
          h(
            'button',
            { type: 'button', class: `min-w-14 px-3.5 py-3 rounded-xl border font-extrabold text-base transition-all active:scale-95 ${c.code}`, 'data-code': code, onClick: () => onPick(type, code) },
            code,
          ),
        ),
      ),
      h(
        'div',
        { class: `pt-2 border-t ${c.divider}` },
        h('label', { for: customId, class: 'text-xs text-muted mb-1.5 block' }, 'Outro código:'),
        h(
          'div',
          { class: 'flex gap-2' },
          customInput,
          h('button', { type: 'button', class: `shrink-0 px-4 rounded-xl font-extrabold text-sm active:scale-95 transition ${c.start}`, 'data-start-custom': type, onClick: startCustom }, 'Iniciar'),
        ),
      ),
    );
  };

  return h('div', { class: 'space-y-4', 'data-testid': 'service-chooser' }, typeBlock('COMERCIAL'), typeBlock('OCORRENCIA'));
}

export function dashboardScreen(p: DashboardProps): HTMLElement {
  const { header, ordens } = p;
  const list =
    ordens.length === 0
      ? h(
          'div',
          { class: 'text-center py-8 px-4 bg-fg/[0.03] rounded-xl border border-dashed border-fg/15' },
          h('p', { class: 'text-sm font-semibold text-muted' }, 'Nenhuma Ordem de Serviço registrada ainda.'),
          h('p', { class: 'text-xs text-subtle mt-1' }, 'Toque no + para registrar a primeira OS do turno.'),
        )
      : h('ul', { class: 'space-y-3' }, ordens.map((os, i) => osRow(os, i, p)));

  const teamExtra = [header.equipe && `Equipe ${header.equipe}`, header.viatura && `Viatura ${header.viatura}`].filter(Boolean).join(' • ');
  const bodycams = [header.bodycam1, header.bodycam2].map((b) => b.trim()).filter(Boolean).join(' / ');

  return h(
    'section',
    { id: 'screen-dashboard', class: 'space-y-6' },
    h(
      'div',
      { class: 'card p-5 border-l-4 border-l-accent' },
      h(
        'div',
        { class: 'flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-fg/10' },
        h('span', { class: 'text-[11px] font-extrabold uppercase tracking-widest text-accent-fg' }, 'Cabeçalho ativo do turno'),
        h(
          'div',
          { class: 'flex items-center gap-2' },
          h('span', { class: 'text-xs bg-fg/10 px-3 py-1 rounded-full font-semibold text-fg' }, `${formatDateBR(header.data)} | ${formatHorario(header)}`),
          h('button', { type: 'button', class: 'text-xs font-bold bg-fg/10 hover:bg-fg/15 text-fg px-3 py-1 rounded-full flex items-center gap-1', onClick: p.onEditHeader }, icon(Pencil, 'w-3 h-3'), 'Corrigir'),
        ),
      ),
      h(
        'div',
        { class: 'grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm' },
        h(
          'div',
          null,
          h('span', { class: 'text-subtle text-xs block' }, 'Equipe'),
          h('p', { class: 'font-bold text-fg leading-snug' }, teamLabel(header)),
          teamExtra && h('p', { class: 'text-xs text-muted mt-0.5' }, teamExtra),
        ),
        h('div', { class: 'sm:text-right' }, h('span', { class: 'text-subtle text-xs block' }, 'Bodycam'), h('p', { class: 'font-bold text-brand-fg' }, orDash(bodycams))),
      ),
    ),
    // Nova OS: só o "+"; tipo e código são escolhidos na janela que ele abre.
    h(
      'div',
      { class: 'flex justify-center' },
      h(
        'button',
        {
          type: 'button',
          id: 'btn-new-os',
          'aria-label': 'Nova OS',
          title: 'Nova OS',
          class: 'w-16 h-16 rounded-full bg-brand-600 hover:bg-brand-700 text-white shadow-lg shadow-brand/30 flex items-center justify-center transition-all active:scale-95',
          onClick: p.onNewOS,
        },
        icon(Plus, 'w-8 h-8'),
      ),
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
        { type: 'button', id: 'btn-finish', class: 'w-full bg-accent-600 hover:bg-accent-700 text-white font-extrabold py-4 px-6 rounded-2xl shadow-xl shadow-accent/20 transition-all flex items-center justify-center gap-3 text-base active:scale-[0.99]', onClick: p.onFinish },
        icon(FileDown, 'w-6 h-6'),
        'Finalizar turno e gerar PDF',
      ),
      h('p', { class: 'text-center text-xs text-subtle mt-2.5' }, 'Gera o Espelho de Campo. O turno só é encerrado depois que você confirmar que tem o PDF em mãos.'),
    ),
  );
}
