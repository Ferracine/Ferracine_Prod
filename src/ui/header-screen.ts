import { ArrowRight, Download, FileDown, Share2, UserCheck, Users } from 'lucide';
import { formatDateBR, plural, todayISO } from '../domain/format';
import type { ClosedSheet, ShiftHeader } from '../domain/types';
import { BTN, INPUT_CLS, LABEL_CLS, h, icon } from './dom';
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

function field(id: string, label: string, attrs: Record<string, string | boolean>, extraCls = '') {
  return h(
    'div',
    { class: extraCls },
    h('label', { for: id, class: LABEL_CLS }, label),
    h('input', { id, name: id, class: INPUT_CLS, autocomplete: 'off', ...attrs }),
  );
}

function lastSheetCard(sheet: ClosedSheet, p: HeaderScreenProps): HTMLElement {
  return h(
    'div',
    { class: 'bg-white rounded-2xl shadow-sm border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-3', 'data-testid': 'last-sheet' },
    h(
      'div',
      { class: 'flex items-center gap-3 min-w-0' },
      h('div', { class: 'bg-energisa-light text-energisa-blue p-2 rounded-lg shrink-0' }, icon(FileDown, 'w-5 h-5')),
      h(
        'div',
        { class: 'min-w-0' },
        h('p', { class: 'text-sm font-bold text-energisa-navy' }, 'Última folha encerrada'),
        h('p', { class: 'text-xs text-slate-500' }, `${formatDateBR(sheet.header.data)} • ${sheet.header.nome1} • ${plural(sheet.ordens.length, 'OS', 'OSs')}`),
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
  const form = h('form', { id: 'header-form', class: 'p-6 space-y-5', novalidate: true });

  const previousTeam = p.lastSheet?.header;
  const fillTeam = () => {
    if (!previousTeam) return;
    for (const k of ['nome1', 'mat1', 'nome2', 'mat2'] as const) {
      (form.elements.namedItem(k) as HTMLInputElement).value = previousTeam[k];
    }
    showToast('Equipe do último turno preenchida. Confira data, horário e bodycam.', 'info');
  };

  form.append(
    h(
      'div',
      { class: 'bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4' },
      h(
        'div',
        { class: 'flex items-center justify-between gap-2 border-b border-slate-200 pb-2' },
        h('div', { class: 'flex items-center gap-2 text-energisa-navy font-bold text-sm' }, icon(UserCheck, 'w-4 h-4 text-energisa-blue'), 'Integrante principal (obrigatório)'),
        !init && previousTeam && h('button', { type: 'button', class: 'text-xs font-bold text-energisa-blue hover:underline', onClick: fillTeam }, 'Usar equipe do último turno'),
      ),
      h(
        'div',
        { class: 'grid grid-cols-1 sm:grid-cols-3 gap-4' },
        field('nome1', 'Nome 1 *', { required: true, placeholder: 'Nome completo do eletricista 1', autocapitalize: 'words', value: init?.nome1 ?? '' }, 'sm:col-span-2'),
        field('mat1', 'Mat. 1 *', { required: true, placeholder: 'Ex: 123456', inputmode: 'numeric', value: init?.mat1 ?? '' }),
      ),
    ),
    h(
      'div',
      { class: 'bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4' },
      h(
        'div',
        { class: 'flex items-center justify-between border-b border-slate-200 pb-2' },
        h('div', { class: 'flex items-center gap-2 text-energisa-navy font-bold text-sm' }, icon(Users, 'w-4 h-4 text-energisa-blue'), 'Integrante auxiliar / dupla'),
        h('span', { class: 'text-xs text-slate-400 font-medium' }, 'Opcional se solo'),
      ),
      h(
        'div',
        { class: 'grid grid-cols-1 sm:grid-cols-3 gap-4' },
        field('nome2', 'Nome 2', { placeholder: 'Nome completo do eletricista 2', autocapitalize: 'words', value: init?.nome2 ?? '' }, 'sm:col-span-2'),
        field('mat2', 'Mat. 2', { placeholder: 'Ex: 654321', inputmode: 'numeric', value: init?.mat2 ?? '' }),
      ),
    ),
    h(
      'div',
      { class: 'grid grid-cols-2 sm:grid-cols-4 gap-4' },
      field('data', 'Data *', { type: 'date', required: true, value: init?.data ?? todayISO() }, 'col-span-2 sm:col-span-1'),
      field('horaInicio', 'Início *', { type: 'time', required: true, value: init?.horaInicio ?? '' }),
      field('horaFim', 'Fim *', { type: 'time', required: true, value: init?.horaFim ?? '' }),
      field('bodycam1', 'Bodycam 1', { placeholder: 'Nº da câmera', value: init?.bodycam1 ?? '' }, 'col-span-2 sm:col-span-1'),
    ),
    h(
      'div',
      { class: 'pt-2 flex flex-col sm:flex-row gap-3' },
      init && h('button', { type: 'button', class: `${BTN.neutral} py-4 sm:w-1/3`, onClick: p.onCancelEdit }, 'Cancelar'),
      h(
        'button',
        { type: 'submit', class: 'flex-1 bg-energisa-blue hover:bg-energisa-navy text-white font-bold py-4 px-6 rounded-xl shadow-lg shadow-energisa-blue/25 transition-all flex items-center justify-center gap-2 text-base active:scale-[0.99]' },
        init ? 'Salvar cabeçalho' : 'Iniciar turno e liberar OSs',
        icon(ArrowRight, 'w-5 h-5'),
      ),
    ),
  );

  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const get = (k: keyof ShiftHeader) => (form.elements.namedItem(k) as HTMLInputElement).value.trim();
    const header: ShiftHeader = {
      nome1: get('nome1'),
      mat1: get('mat1'),
      nome2: get('nome2'),
      mat2: get('mat2'),
      data: get('data'),
      horaInicio: get('horaInicio'),
      horaFim: get('horaFim'),
      bodycam1: get('bodycam1'),
    };
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
      { class: 'bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden' },
      h(
        'div',
        { class: 'bg-energisa-navy text-white px-6 py-4 border-b-4 border-energisa-orange' },
        h('p', { class: 'text-xs uppercase tracking-wider text-blue-200 font-semibold' }, 'Departamento de Operação'),
        h('h2', { class: 'text-lg sm:text-xl font-bold mt-0.5' }, init ? 'Corrigir cabeçalho do turno' : 'Identificação da equipe e turno'),
        h('p', { class: 'text-xs text-slate-300 mt-1' }, init ? 'As OSs já registradas são mantidas.' : 'Preencha os dados obrigatórios para liberar o registro de Ordens de Serviço.'),
      ),
      form,
    ),
  );
}
