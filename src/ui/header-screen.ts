import { ArrowRight, Download, FileDown, Share2, Trash2, Truck, UserCheck, UserCog, Users } from 'lucide';
import { eletricistaLabel, formatDateBR, plural, todayISO } from '../domain/format';
import { HEADER_FIELDS, type ClosedSheet, type Eletricista, type ShiftHeader, type Tecnico } from '../domain/types';
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
  /** Eletricistas cadastrados: escolher um preenche nome e matrícula (igual aos técnicos líderes). */
  getEletricistas: () => readonly Eletricista[];
  onAddEletricista: (nome: string, matricula: string) => void;
  onRemoveEletricista: (id: string) => void;
  /** Últimas folhas encerradas (a mais recente primeiro). */
  sheets: readonly ClosedSheet[];
  canShare: boolean;
  onSubmit: (header: ShiftHeader) => void;
  onCancelEdit: () => void;
  onDownloadSheet: (sheet: ClosedSheet) => void;
  onShareSheet: (sheet: ClosedSheet) => void;
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

/** "20/11/2026 17:32 • JOAO • 3 OSs": a hora do encerramento separa dois turnos do mesmo dia. */
function sheetLabel(sheet: ClosedSheet): string {
  const fechada = new Date(sheet.fechadaEm);
  const hora = Number.isNaN(fechada.getTime()) ? '' : ` ${fechada.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  return `${formatDateBR(sheet.header.data)}${hora} • ${sheet.header.nome1} • ${plural(sheet.ordens.length, 'OS', 'OSs')}`;
}

/** Últimas folhas encerradas (até 4): baixar ou compartilhar o PDF de cada uma de novo. */
function sheetsCard(p: HeaderScreenProps): HTMLElement {
  return h(
    'div',
    { class: 'card p-4 space-y-3', 'data-testid': 'last-sheets' },
    h(
      'div',
      { class: 'flex items-center gap-3' },
      h('div', { class: 'bg-brand/15 text-brand-fg p-2 rounded-lg shrink-0' }, icon(FileDown, 'w-5 h-5')),
      h('p', { class: 'text-sm font-bold text-fg' }, p.sheets.length === 1 ? 'Última folha encerrada' : `Últimas ${p.sheets.length} folhas encerradas`),
    ),
    p.sheets.map((sheet) =>
      h(
        'div',
        { class: 'flex flex-wrap items-center justify-between gap-3 border-t border-fg/10 pt-3', 'data-testid': 'last-sheet' },
        h('p', { class: 'text-xs text-muted min-w-0' }, sheetLabel(sheet)),
        h(
          'div',
          { class: 'flex gap-2' },
          p.canShare && h('button', { type: 'button', class: `${BTN.neutral} flex items-center gap-1.5`, onClick: () => p.onShareSheet(sheet) }, icon(Share2), 'Compartilhar'),
          h('button', { type: 'button', class: `${BTN.primary} flex items-center gap-1.5`, onClick: () => p.onDownloadSheet(sheet) }, icon(Download), 'Baixar PDF'),
        ),
      ),
    ),
  );
}

function tecnicoLabel(t: Tecnico): string {
  return t.telefone ? `${t.nome} - ${t.telefone}` : t.nome;
}

/** O que muda entre os cadastros de técnicos e de eletricistas (a janela é a mesma). */
interface Cadastro<T extends { id: string; nome: string }> {
  titulo: string;
  /** Chave dos ids (`tecnico-nome`, `tecnicos-list`...). */
  item: string;
  /** Nome nos textos ("técnico", "eletricista"). */
  rotulo: string;
  /** Segundo campo: id (`tecnico-telefone`), rótulo e exemplo. */
  extra: { id: string; label: string; placeholder: string; inputmode: string };
  nomePlaceholder: string;
  get: () => readonly T[];
  extraOf: (t: T) => string;
  onAdd: (nome: string, extra: string) => void;
  onRemove: (id: string) => void;
}

/** Janela com os cadastrados (excluir) e o formulário para cadastrar outro. `onChange`: a lista mudou. */
function manageCadastro<T extends { id: string; nome: string }>(c: Cadastro<T>, onChange: () => void): void {
  const list = h('ul', { class: 'space-y-2', 'data-testid': `${c.item}s-list` });
  const drawList = () => {
    const itens = c.get();
    list.replaceChildren(
      ...(itens.length === 0
        ? [h('li', { class: 'text-sm text-muted' }, `Nenhum ${c.rotulo} cadastrado.`)]
        : itens.map((t) =>
            h(
              'li',
              { class: 'flex items-center justify-between gap-3 p-3 rounded-xl bg-fg/5 border border-fg/10' },
              h('div', { class: 'min-w-0' }, h('p', { class: 'text-sm font-bold text-fg break-words' }, t.nome), c.extraOf(t) && h('p', { class: 'text-xs text-muted' }, c.extraOf(t))),
              h(
                'button',
                {
                  type: 'button',
                  class: 'p-2.5 rounded-xl border border-fg/10 text-danger-fg hover:bg-rose-500/10 shrink-0',
                  'aria-label': `Excluir ${c.rotulo} ${t.nome}`,
                  onClick: () => {
                    c.onRemove(t.id);
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
      showToast(`Digite o nome do ${c.rotulo}.`, 'warning');
      nome.focus();
      return;
    }
    c.onAdd(nome.value.trim().toUpperCase(), extra.value.trim().toUpperCase());
    onChange();
    nome.value = '';
    extra.value = '';
    drawList();
    nome.focus();
  };
  const nome = h('input', { id: `${c.item}-nome`, class: 'field', autocomplete: 'off', placeholder: c.nomePlaceholder });
  const extra = h('input', { id: c.extra.id, class: 'field', autocomplete: 'off', inputmode: c.extra.inputmode, placeholder: c.extra.placeholder, onKeydown: onEnter(add) });
  drawList();

  openModal(
    c.titulo,
    h(
      'div',
      { class: 'space-y-4' },
      list,
      h(
        'div',
        { class: 'space-y-3 pt-3 border-t border-fg/10' },
        h('p', { class: 'lbl' }, `Cadastrar ${c.rotulo}`),
        h('div', null, h('label', { for: `${c.item}-nome`, class: 'lbl' }, 'Nome'), nome),
        h('div', null, h('label', { for: c.extra.id, class: 'lbl' }, c.extra.label), extra),
        h('button', { type: 'button', class: `${BTN.primary} w-full`, onClick: add }, `Adicionar ${c.rotulo}`),
      ),
    ),
    [{ label: 'Fechar', variant: 'neutral', onClick: closeModal }],
  );
}

/** Link "Adicionar / excluir ..." ao lado de um rótulo. */
function manageLink(id: string, text: string, onClick: () => void): HTMLElement {
  return h('button', { type: 'button', id, class: 'text-xs font-bold text-brand-fg hover:underline flex items-center gap-1 mb-1.5', onClick }, icon(UserCog, 'w-3.5 h-3.5'), text);
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

  const tecnicosCadastro: Cadastro<Tecnico> = {
    titulo: 'Técnicos líderes',
    item: 'tecnico',
    rotulo: 'técnico',
    extra: { id: 'tecnico-telefone', label: 'Telefone', placeholder: 'Ex: 69 99999-9999', inputmode: 'tel' },
    nomePlaceholder: 'Ex: TEC. JOÃO SILVA',
    get: p.getTecnicos,
    extraOf: (t) => t.telefone,
    onAdd: p.onAddTecnico,
    onRemove: p.onRemoveTecnico,
  };

  // Eletricista 1 e 2: escolher um cadastrado preenche nome e matrícula (que continuam editáveis).
  const sels: { n: 1 | 2; sel: HTMLSelectElement }[] = [];
  const fillEletricistas = () => {
    const lista = p.getEletricistas();
    for (const { n, sel } of sels) {
      // Marca quem já está nos campos (turno anterior), se for um cadastrado.
      const nome = input(`nome${n}`).value.trim().toUpperCase();
      const mat = input(`mat${n}`).value.trim().toUpperCase();
      sel.replaceChildren(
        h('option', { value: '' }, lista.length ? 'Escolher eletricista cadastrado…' : 'Nenhum eletricista cadastrado'),
        ...lista.map((e) => h('option', { value: e.id }, e.matricula ? eletricistaLabel(e.nome, e.matricula) : e.nome)),
      );
      sel.value = lista.find((e) => e.nome === nome && e.matricula === mat)?.id ?? '';
    }
  };
  const eletricistasCadastro: Cadastro<Eletricista> = {
    titulo: 'Eletricistas',
    item: 'eletricista',
    rotulo: 'eletricista',
    extra: { id: 'eletricista-matricula', label: 'Matrícula', placeholder: 'Ex: 123456', inputmode: 'numeric' },
    nomePlaceholder: 'Ex: JOÃO DA SILVA',
    get: p.getEletricistas,
    extraOf: (e) => (e.matricula ? `Mat: ${e.matricula}` : ''),
    onAdd: p.onAddEletricista,
    onRemove: p.onRemoveEletricista,
  };
  const escolher = (n: 1 | 2) => {
    const sel = h('select', {
      id: `eletricista${n}`,
      class: 'field',
      'aria-label': `Escolher eletricista ${n} cadastrado`,
      onChange: () => {
        const e = p.getEletricistas().find((x) => x.id === sel.value);
        if (!e) return;
        input(`nome${n}`).value = e.nome;
        input(`mat${n}`).value = e.matricula;
      },
    });
    sels.push({ n, sel });
    return h(
      'div',
      null,
      h(
        'div',
        { class: 'flex items-center justify-between gap-2' },
        h('label', { for: `eletricista${n}`, class: 'lbl' }, 'Cadastrado'),
        n === 1 && manageLink('btn-eletricistas', 'Adicionar / excluir eletricistas', () => manageCadastro(eletricistasCadastro, fillEletricistas)),
      ),
      sel,
    );
  };

  form.append(
    group(
      'Eletricista 1 (obrigatório)',
      UserCheck,
      null,
      escolher(1),
      h(
        'div',
        { class: 'grid grid-cols-1 sm:grid-cols-3 gap-4' },
        field('nome1', 'Nome 1 *', { required: true, placeholder: 'Nome completo do eletricista 1', value: v('nome1') }, 'sm:col-span-2'),
        field('mat1', 'Mat. 1 *', { required: true, placeholder: 'Ex: 123456', inputmode: 'numeric', value: v('mat1') }),
      ),
    ),
    group(
      'Eletricista 2',
      Users,
      'Opcional se solo',
      escolher(2),
      h(
        'div',
        { class: 'grid grid-cols-1 sm:grid-cols-3 gap-4' },
        field('nome2', 'Nome 2', { placeholder: 'Nome completo do eletricista 2', value: v('nome2') }, 'sm:col-span-2'),
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
        field('equipe', 'Equipe', { placeholder: 'Ex: PVH-01', value: v('equipe') }),
        field('viatura', 'Viatura', { placeholder: 'Prefixo ou placa', value: v('viatura') }),
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
        manageLink('btn-tecnicos', 'Adicionar / excluir técnicos', () => manageCadastro(tecnicosCadastro, () => fillLider(liderSelect.value))),
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

  fillEletricistas(); // depois de montar o form: lê os nomes já preenchidos

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
    !init && p.sheets.length > 0 && sheetsCard(p),
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
