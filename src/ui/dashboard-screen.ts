import { Briefcase, CirclePlus, ClipboardList, Eye, FileDown, Pencil, Trash2, TriangleAlert } from 'lucide';
import { SERVICE_CODES, SERVICE_LABEL, questionsFor } from '../domain/catalog';
import { formatDateBR, formatHorario, orDash, osLabel, plural, teamLabel } from '../domain/format';
import type { OrdemServico, ServiceType, ShiftHeader } from '../domain/types';
import { answerRows } from '../domain/wizard';
import { h, icon, onEnter } from './dom';
import { showToast } from './feedback';

export interface DashboardProps {
  header: ShiftHeader;
  ordens: readonly OrdemServico[];
  /** `osNumber` vazio = OS sem número (S/N). */
  onStartOS: (osNumber: string, type: ServiceType, code: string) => void;
  onView: (os: OrdemServico) => void;
  onEditNumber: (os: OrdemServico) => void;
  onDelete: (os: OrdemServico) => void;
  onEditHeader: () => void;
  onFinish: () => void;
}

/** Cores do selo de tipo (lista, assistente e contador): Comercial = ciano do logo, Ocorrência = laranja do logo. */
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
      action('Editar nº', 'text-accent-fg hover:bg-fg/10', Pencil, () => p.onEditNumber(os)),
      action('Ver respostas', 'text-brand-fg hover:bg-fg/10', Eye, () => p.onView(os)),
      action('Excluir', 'text-danger-fg hover:bg-rose-500/10', Trash2, () => p.onDelete(os)),
    ),
  );
}

export function dashboardScreen(p: DashboardProps): HTMLElement {
  const { header, ordens } = p;
  const osInput = h('input', {
    id: 'input-os-number',
    type: 'text',
    inputmode: 'numeric',
    enterkeyhint: 'done',
    autocomplete: 'off',
    placeholder: 'Digite o número ou deixe vazio (S/N)',
    class: 'field',
  });

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
      p.onStartOS(osInput.value.trim(), type, code);
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
      h('p', { class: 'text-xs text-muted' }, 'Toque no código para iniciar:'),
      h(
        'div',
        { class: 'flex flex-wrap gap-2' },
        SERVICE_CODES[type].map((code) =>
          h(
            'button',
            { type: 'button', class: `min-w-14 px-3.5 py-3 rounded-xl border font-extrabold text-base transition-all active:scale-95 ${c.code}`, 'data-code': code, onClick: () => p.onStartOS(osInput.value.trim(), type, code) },
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

  const list =
    ordens.length === 0
      ? h(
          'div',
          { class: 'text-center py-8 px-4 bg-fg/[0.03] rounded-xl border border-dashed border-fg/15' },
          h('p', { class: 'text-sm font-semibold text-muted' }, 'Nenhuma Ordem de Serviço registrada ainda.'),
          h('p', { class: 'text-xs text-subtle mt-1' }, 'Digite o número da OS (ou deixe vazio) e toque no código para começar.'),
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
    h(
      'div',
      { class: 'card p-6 space-y-5' },
      h(
        'div',
        { class: 'flex items-center gap-3 border-b border-fg/10 pb-4' },
        h('div', { class: 'bg-brand/15 text-brand-fg p-2 rounded-lg' }, icon(CirclePlus, 'w-5 h-5')),
        h(
          'div',
          null,
          h('h2', { class: 'text-base font-extrabold text-fg' }, 'Registrar nova Ordem de Serviço'),
          h('p', { class: 'text-xs text-muted' }, 'Número opcional: se não lembrar, deixe vazio e preencha depois.'),
        ),
      ),
      h('div', null, h('label', { for: 'input-os-number', class: 'lbl' }, 'Número da OS (opcional)'), osInput),
      h(
        'div',
        { class: 'space-y-3' },
        h('p', { class: 'lbl' }, 'Selecione o tipo e o código do serviço *'),
        h('div', { class: 'grid grid-cols-1 md:grid-cols-2 gap-4' }, typeBlock('COMERCIAL'), typeBlock('OCORRENCIA')),
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
