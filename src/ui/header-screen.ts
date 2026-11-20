import { ArrowRight, Download, FileDown, Share2, Truck, UserCheck, Users } from 'lucide';
import { TECNICOS_LIDERES } from '../domain/catalog';
import { formatDateBR, plural, todayISO } from '../domain/format';
import { HEADER_FIELDS, type ClosedSheet, type ShiftHeader } from '../domain/types';
import { BTN, BTN_PRIMARY_LG, h, icon } from './dom';
import { showToast } from './feedback';

export interface HeaderScreenProps {
  /** Cabeçalho atual, quando a tela é aberta para corrigir o turno em andamento. */
  editing: ShiftHeader | null;
  lastSheet: ClosedSheet | null;
  canShare: boolean;
  onSubmit: (header: ShiftHeader) => void;
  onCancelEdit: () => void;
  onDownloadLast: () => void;
  onShareLast: () => void;
}

/** Campos repetidos de um turno para o outro pelo botão "Usar equipe do último turno". */
const TEAM_FIELDS = ['nome1', 'mat1', 'nome2', 'mat2', 'equipe', 'viatura', 'lider'] as const;

function field(id: keyof ShiftHeader, label: string, attrs: Record<string, string | boolean>, extraCls = '') {
  return h(
    'div',
    { class: extraCls },
    h('label', { for: id, class: 'lbl' }, label),
    h('input', { id, name: id, class: 'field', autocomplete: 'off', ...attrs }),
  );
}

function group(title: string, node: Parameters<typeof icon>[0], hint: string | null, ...children: HTMLElement[]) {
  return h(
    'div',
    { class: 'bg-white/[0.03] p-4 rounded-xl border border-white/10 space-y-4' },
    h(
      'div',
      { class: 'flex items-center justify-between gap-2' },
      h('div', { class: 'flex items-center gap-2 text-energisa-sky font-bold text-sm' }, icon(node), title),
      hint && h('span', { class: 'text-xs text-slate-500 font-medium' }, hint),
    ),
    ...children,
  );
}

function lastSheetCard(sheet: ClosedSheet, p: HeaderScreenProps): HTMLElement {
  return h(
    'div',
    { class: 'card p-4 flex flex-wrap items-center justify-between gap-3', 'data-testid': 'last-sheet' },
    h(
      'div',
      { class: 'flex items-center gap-3 min-w-0' },
      h('div', { class: 'bg-energisa-blue/20 text-energisa-sky p-2 rounded-lg shrink-0' }, icon(FileDown, 'w-5 h-5')),
      h(
        'div',
        { class: 'min-w-0' },
        h('p', { class: 'text-sm font-bold text-white' }, 'Última folha encerrada'),
        h('p', { class: 'text-xs text-slate-400' }, `${formatDateBR(sheet.header.data)} • ${sheet.header.nome1} • ${plural(sheet.ordens.length, 'OS', 'OSs')}`),
      ),
    ),
    h(
      'div',
      { class: 'flex gap-2' },
      p.canShare && h('button', { type: 'button', class: `${BTN.neutral} flex items-center gap-1.5`, onClick: p.onShareLast }, icon(Share2), 'Compartilhar'),
      h('button', { type: 'button', class: `${BTN.primary} flex items-center gap-1.5`, onClick: p.onDownloadLast }, icon(Download), 'Baixar PDF'),
    ),
  );
}

export function headerScreen(p: HeaderScreenProps): HTMLElement {
  const init = p.editing;
  const v = (k: keyof ShiftHeader) => init?.[k] ?? '';
  const form = h('form', { id: 'header-form', class: 'p-6 space-y-5', novalidate: true });
  const input = (k: keyof ShiftHeader) => form.elements.namedItem(k) as HTMLInputElement | HTMLSelectElement;

  const previous = p.lastSheet?.header;
  const fillTeam = () => {
    if (!previous) return;
    for (const k of TEAM_FIELDS) input(k).value = previous[k];
    showToast('Equipe do último turno preenchida. Confira data, horário e bodycams.', 'info');
  };

  const liderSelect = h(
    'select',
    { id: 'lider', name: 'lider', class: 'field' },
    h('option', { value: '' }, 'Não informado'),
    TECNICOS_LIDERES.map((l) => h('option', { value: l }, l)),
  );
  liderSelect.value = v('lider');

  form.append(
    group(
      'Integrante principal (obrigatório)',
      UserCheck,
      null,
      h(
        'div',
        { class: 'grid grid-cols-1 sm:grid-cols-3 gap-4' },
        field('nome1', 'Nome 1 *', { required: true, placeholder: 'Nome completo do eletricista 1', autocapitalize: 'words', value: v('nome1') }, 'sm:col-span-2'),
        field('mat1', 'Mat. 1 *', { required: true, placeholder: 'Ex: 123456', inputmode: 'numeric', value: v('mat1') }),
      ),
    ),
    group(
      'Integrante auxiliar / dupla',
      Users,
      'Opcional se solo',
      h(
        'div',
        { class: 'grid grid-cols-1 sm:grid-cols-3 gap-4' },
        field('nome2', 'Nome 2', { placeholder: 'Nome completo do eletricista 2', autocapitalize: 'words', value: v('nome2') }, 'sm:col-span-2'),
        field('mat2', 'Mat. 2', { placeholder: 'Ex: 654321', inputmode: 'numeric', value: v('mat2') }),
      ),
    ),
    group(
      'Equipe e viatura',
      Truck,
      null,
      h(
        'div',
        { class: 'grid grid-cols-2 gap-4' },
        field('equipe', 'Equipe', { placeholder: 'Ex: PVH-01', autocapitalize: 'characters', value: v('equipe') }),
        field('viatura', 'Viatura', { placeholder: 'Prefixo ou placa', autocapitalize: 'characters', value: v('viatura') }),
      ),
    ),
    h(
      'div',
      { class: 'grid grid-cols-2 sm:grid-cols-3 gap-4' },
      field('data', 'Data *', { type: 'date', required: true, value: init?.data ?? todayISO() }, 'col-span-2 sm:col-span-1'),
      field('horaInicio', 'Início *', { type: 'time', required: true, value: v('horaInicio') }),
      field('horaFim', 'Fim *', { type: 'time', required: true, value: v('horaFim') }),
    ),
    h(
      'div',
      { class: 'grid grid-cols-2 gap-4' },
      field('bodycam1', 'Bodycam 1', { placeholder: 'Nº da câmera', value: v('bodycam1') }),
      field('bodycam2', 'Bodycam 2', { placeholder: 'Nº da câmera', value: v('bodycam2') }),
    ),
    h('div', null, h('label', { for: 'lider', class: 'lbl' }, 'Técnico líder responsável'), liderSelect),
    h(
      'div',
      { class: 'pt-2 flex flex-col sm:flex-row gap-3' },
      init && h('button', { type: 'button', class: `${BTN.neutral} py-4 sm:w-1/3`, onClick: p.onCancelEdit }, 'Cancelar'),
      h('button', { type: 'submit', class: `flex-1 ${BTN_PRIMARY_LG}` }, init ? 'Salvar cabeçalho' : 'Iniciar turno e liberar OSs', icon(ArrowRight, 'w-5 h-5')),
    ),
  );

  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const header = Object.fromEntries(HEADER_FIELDS.map((k) => [k, input(k).value.trim()])) as ShiftHeader;
    if (!header.nome1 || !header.mat1 || !header.data || !header.horaInicio || !header.horaFim) {
      showToast('Preencha Nome 1, Matrícula 1, Data e Horário (início e fim) para liberar o turno.', 'error');
      return;
    }
    p.onSubmit(header);
  });

  return h(
    'section',
    { id: 'screen-header', class: 'space-y-6' },
    !init && p.lastSheet && lastSheetCard(p.lastSheet, p),
    h(
      'div',
      { class: 'card overflow-hidden' },
      h(
        'div',
        { class: 'px-6 py-5 border-b border-white/10 bg-gradient-to-r from-energisa-navy to-panel' },
        h('p', { class: 'text-[11px] uppercase tracking-widest text-energisa-sky font-bold' }, 'Departamento de Operação'),
        h('h2', { class: 'text-xl font-extrabold mt-0.5 text-white' }, init ? 'Corrigir cabeçalho do turno' : 'Identificação da equipe e turno'),
        h('p', { class: 'text-xs text-slate-400 mt-1' }, init ? 'As OSs já registradas são mantidas.' : 'Preencha os dados obrigatórios para liberar o registro de Ordens de Serviço.'),
      ),
      !init && previous && h('div', { class: 'px-6 pt-5' }, h('button', { type: 'button', class: `${BTN.neutral} w-full`, onClick: fillTeam }, 'Usar equipe do último turno')),
      form,
    ),
  );
}
