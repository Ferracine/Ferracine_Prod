import { ArrowRight, Download, FileDown, Share2, Trash2, Truck, UserCheck, UserCog, Users } from 'lucide';
import { formatDateBR, plural, todayISO } from '../domain/format';
import { HEADER_FIELDS, type ClosedSheet, type ShiftHeader, type Tecnico } from '../domain/types';
import { BTN, BTN_PRIMARY_LG, h, icon, onEnter } from './dom';
import { closeModal, openModal, showToast } from './feedback';

export interface HeaderScreenProps {
  /** Cabeçalho atual, quando a tela é aberta para corrigir o turno em andamento. */
  editing: ShiftHeader | null;
  /** Último cabeçalho usado: preenche o novo turno automaticamente (a data vem do sistema; o líder começa em branco). */
  defaults: ShiftHeader | null;
  /** Lista atual de técnicos: a tela não é redesenhada ao cadastrar/excluir (o que foi digitado fica). */
  getTecnicos: () => readonly Tecnico[];
  onAddTecnico: (nome: string, telefone: string) => void;
  onRemoveTecnico: (id: string) => void;
  lastSheet: ClosedSheet | null;
  canShare: boolean;
  onSubmit: (header: ShiftHeader) => void;
  onCancelEdit: () => void;
  onDownloadLast: () => void;
  onShareLast: () => void;
}

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
    { class: 'bg-fg/[0.03] p-4 rounded-xl border border-fg/10 space-y-4' },
    h(
      'div',
      { class: 'flex items-center justify-between gap-2' },
      h('div', { class: 'flex items-center gap-2 text-brand-fg font-bold text-sm' }, icon(node), title),
      hint && h('span', { class: 'text-xs text-subtle font-medium' }, hint),
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
      h('div', { class: 'bg-brand/15 text-brand-fg p-2 rounded-lg shrink-0' }, icon(FileDown, 'w-5 h-5')),
      h(
        'div',
        { class: 'min-w-0' },
        h('p', { class: 'text-sm font-bold text-fg' }, 'Última folha encerrada'),
        h('p', { class: 'text-xs text-muted' }, `${formatDateBR(sheet.header.data)} • ${sheet.header.nome1} • ${plural(sheet.ordens.length, 'OS', 'OSs')}`),
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

function tecnicoLabel(t: Tecnico): string {
  return t.telefone ? `${t.nome} - ${t.telefone}` : t.nome;
}

/** Janela com os técnicos cadastrados (excluir) e o formulário para cadastrar outro. */
function manageTecnicos(p: HeaderScreenProps, onChange: () => void): void {
  const list = h('ul', { class: 'space-y-2', 'data-testid': 'tecnicos-list' });
  const drawList = () => {
    const tecnicos = p.getTecnicos();
    list.replaceChildren(
      ...(tecnicos.length === 0
        ? [h('li', { class: 'text-sm text-muted' }, 'Nenhum técnico cadastrado.')]
        : tecnicos.map((t) =>
            h(
              'li',
              { class: 'flex items-center justify-between gap-3 p-3 rounded-xl bg-fg/5 border border-fg/10' },
              h('div', { class: 'min-w-0' }, h('p', { class: 'text-sm font-bold text-fg break-words' }, t.nome), t.telefone && h('p', { class: 'text-xs text-muted' }, t.telefone)),
              h(
                'button',
                {
                  type: 'button',
                  class: 'p-2.5 rounded-xl border border-fg/10 text-danger-fg hover:bg-rose-500/10 shrink-0',
                  'aria-label': `Excluir técnico ${t.nome}`,
                  onClick: () => {
                    p.onRemoveTecnico(t.id);
                    onChange();
                    drawList();
                  },
                },
                icon(Trash2),
              ),
            ),
          )),
    );
  };

  const add = () => {
    if (!nome.value.trim()) {
      showToast('Digite o nome do técnico.', 'warning');
      nome.focus();
      return;
    }
    p.onAddTecnico(nome.value.trim(), telefone.value.trim());
    onChange();
    nome.value = '';
    telefone.value = '';
    drawList();
    nome.focus();
  };
  const nome = h('input', { id: 'tecnico-nome', class: 'field', autocomplete: 'off', autocapitalize: 'characters', placeholder: 'Ex: TEC. JOÃO SILVA' });
  const telefone = h('input', { id: 'tecnico-telefone', class: 'field', autocomplete: 'off', inputmode: 'tel', placeholder: 'Ex: 69 99999-9999', onKeydown: onEnter(add) });
  drawList();

  openModal(
    'Técnicos líderes',
    h(
      'div',
      { class: 'space-y-4' },
      list,
      h(
        'div',
        { class: 'space-y-3 pt-3 border-t border-fg/10' },
        h('p', { class: 'lbl' }, 'Cadastrar técnico'),
        h('div', null, h('label', { for: 'tecnico-nome', class: 'lbl' }, 'Nome'), nome),
        h('div', null, h('label', { for: 'tecnico-telefone', class: 'lbl' }, 'Telefone'), telefone),
        h('button', { type: 'button', class: `${BTN.primary} w-full`, onClick: add }, 'Adicionar técnico'),
      ),
    ),
    [{ label: 'Fechar', variant: 'neutral', onClick: closeModal }],
  );
}

export function headerScreen(p: HeaderScreenProps): HTMLElement {
  const init = p.editing;
  const source = init ?? p.defaults;
  // Correção do turno: mantém o líder escolhido. Turno novo: líder em branco, escolhido a cada turno.
  const v = (k: keyof ShiftHeader) => (k === 'lider' && !init ? '' : (source?.[k] ?? ''));
  const form = h('form', { id: 'header-form', class: 'p-6 space-y-5', novalidate: true });
  const input = (k: keyof ShiftHeader) => form.elements.namedItem(k) as HTMLInputElement | HTMLSelectElement;

  const liderSelect = h('select', { id: 'lider', name: 'lider', class: 'field' });
  const fillLider = (selected: string) => {
    const tecnicos = p.getTecnicos();
    liderSelect.replaceChildren(h('option', { value: '' }, '—'), ...tecnicos.map((t) => h('option', { value: t.id }, tecnicoLabel(t))));
    liderSelect.value = tecnicos.some((t) => t.id === selected) ? selected : '';
  };
  fillLider(v('lider'));

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
      // Turno novo: a data é sempre a de hoje (do sistema); na correção, a do turno.
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
    h(
      'div',
      null,
      h(
        'div',
        { class: 'flex items-center justify-between gap-2' },
        h('label', { for: 'lider', class: 'lbl' }, 'Técnico líder responsável'),
        h(
          'button',
          {
            type: 'button',
            id: 'btn-tecnicos',
            class: 'text-xs font-bold text-brand-fg hover:underline flex items-center gap-1 mb-1.5',
            onClick: () => manageTecnicos(p, () => fillLider(liderSelect.value)),
          },
          icon(UserCog, 'w-3.5 h-3.5'),
          'Adicionar / excluir técnicos',
        ),
      ),
      liderSelect,
    ),
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
        { class: 'px-6 py-5 border-b border-fg/10 bg-brand/10' },
        h('p', { class: 'text-[11px] uppercase tracking-widest text-brand-fg font-bold' }, 'Departamento de Operação'),
        h('h2', { class: 'text-xl font-extrabold mt-0.5 text-fg' }, init ? 'Corrigir cabeçalho do turno' : 'Identificação da equipe e turno'),
        h(
          'p',
          { class: 'text-xs text-muted mt-1' },
          init
            ? 'As OSs já registradas são mantidas.'
            : p.defaults
              ? 'Dados do último turno já preenchidos; a data é a de hoje. Confira e inicie.'
              : 'Preencha os dados obrigatórios para liberar o registro de Ordens de Serviço.',
        ),
      ),
      form,
    ),
  );
}
