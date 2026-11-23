import { ArrowRight, FileDown, Trash2, Truck, UserCog, Users } from 'lucide';
import { mesmaPessoa, todayISO } from '../domain/format';
import { HEADER_FIELDS, type Eletricista, type ShiftHeader, type Tecnico } from '../domain/types';
import { btn, BTN_CHOICE, BTN_LINK, BTN_PRIMARY_LG, ESCOLHA_OFF, ESCOLHA_ON, h, icon, marcarFaltando, onEnter } from './dom';
import { closeModal, openModal, showToast } from './feedback';
import { listaFolhas, type FolhasProps } from './folhas';

export interface HeaderScreenProps {
  /** Cabeçalho atual, quando a tela é aberta para corrigir o turno em andamento. */
  editing: ShiftHeader | null;
  /** Último cabeçalho usado: preenche o novo turno automaticamente (a data vem do sistema; o líder começa em branco). */
  defaults: ShiftHeader | null;
  /** Lista atual de técnicos: a tela não é redesenhada ao cadastrar/excluir (o que foi digitado fica). */
  getTecnicos: () => readonly Tecnico[];
  onAddTecnico: (nome: string, telefone: string) => void;
  onRemoveTecnico: (id: string) => void;
  /** Eletricistas cadastrados (nome e matrícula): Eletricista 1 e 2 são escolhidos nesta lista, como o técnico líder. */
  getEletricistas: () => readonly Eletricista[];
  onAddEletricista: (nome: string, matricula: string) => void;
  onRemoveEletricista: (id: string) => void;
  /** Últimas folhas encerradas e as ações de cada uma (a mesma lista da janela de histórico do topo). */
  folhas: FolhasProps;
  onSubmit: (header: ShiftHeader) => void;
  onCancelEdit: () => void;
}

function field(id: keyof ShiftHeader, label: string, attrs: Record<string, string | boolean>, extraCls = '') {
  return h(
    'div',
    { class: extraCls },
    h('label', { for: id, class: 'lbl' }, label),
    h('input', { id, name: id, class: 'field', autocomplete: 'off', ...attrs }),
  );
}

function group(title: string, node: Parameters<typeof icon>[0], ...children: HTMLElement[]) {
  return h(
    'div',
    { class: 'bg-fg/[0.03] p-4 rounded-xl border border-fg/10 space-y-4' },
    h('div', { class: 'flex items-center gap-2 text-brand-fg font-bold text-sm' }, icon(node), title),
    ...children,
  );
}

/** Últimas folhas encerradas (até 4), com as ações de cada uma. */
export function sheetsCard(folhas: FolhasProps): HTMLElement {
  return h(
    'div',
    { class: 'card p-4 space-y-3', 'data-testid': 'last-sheets' },
    h(
      'div',
      { class: 'flex items-center gap-3' },
      h('div', { class: 'bg-brand/15 text-brand-fg p-2 rounded-lg shrink-0' }, icon(FileDown, 'w-5 h-5')),
      h('p', { class: 'text-sm font-bold text-fg' }, folhas.sheets.length === 1 ? 'Última folha encerrada' : `Últimas ${folhas.sheets.length} folhas encerradas`),
    ),
    listaFolhas(folhas),
  );
}

/** Opção da lista de técnicos: "NOME - TELEFONE". */
function cadastroLabel(nome: string, extra: string): string {
  return extra ? `${nome} - ${extra}` : nome;
}

/** O que muda entre os cadastros de técnicos e de eletricistas (a janela é a mesma). */
interface Cadastro<T extends { id: string; nome: string }> {
  titulo: string;
  /** Chave dos ids (`tecnico-nome`, `tecnicos-list`...). */
  item: string;
  /** Nome nos textos ("técnico", "eletricista"). */
  rotulo: string;
  /** Segundo campo: id (`tecnico-telefone`), rótulo, exemplo e se é obrigatório (matrícula). */
  extra: { id: string; label: string; placeholder: string; inputmode: string; obrigatorio?: boolean };
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
                  class: `${btn('outline', 'icon')} text-danger-fg hover:bg-rose-500/10`,
                  'aria-label': `Excluir ${c.rotulo} ${t.nome}`,
                  onClick: () => {
                    c.onRemove(t.id);
                    onChange();
                    drawList();
                  },
                },
                icon(Trash2, 'w-5 h-5'),
              ),
            ),
          )),
    );
  };

  const add = () => {
    if (!nome.value.trim()) {
      showToast(`Digite o nome do ${c.rotulo}.`, 'warning');
      marcarFaltando(nome);
      nome.focus();
      return;
    }
    if (c.extra.obrigatorio && !extra.value.trim()) {
      showToast(`Digite a ${c.extra.label.toLowerCase()} do ${c.rotulo}.`, 'warning');
      marcarFaltando(extra);
      extra.focus();
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
        h('button', { type: 'button', class: `${btn('primary')} w-full`, onClick: add }, `Adicionar ${c.rotulo}`),
      ),
    ),
    [{ label: 'Fechar', variant: 'neutral', onClick: closeModal }],
  );
}

/** Link "Adicionar / excluir ..." ao lado de um rótulo. */
function manageLink(id: string, text: string, onClick: () => void): HTMLElement {
  return h('button', { type: 'button', id, class: `${BTN_LINK} -my-2`, onClick }, icon(UserCog, 'w-4 h-4 shrink-0'), text);
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
    liderSelect.replaceChildren(h('option', { value: '' }, '—'), ...tecnicos.map((t) => h('option', { value: t.id }, cadastroLabel(t.nome, t.telefone))));
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

  // Eletricista 1 e 2: escolhidos na lista dos cadastrados (só o nome; a matrícula aparece no campo ao lado), como o
  // técnico líder.
  const eletricistasCadastro: Cadastro<Eletricista> = {
    titulo: 'Eletricistas',
    item: 'eletricista',
    rotulo: 'eletricista',
    extra: { id: 'eletricista-matricula', label: 'Matrícula', placeholder: 'Ex: 123456', inputmode: 'numeric', obrigatorio: true },
    nomePlaceholder: 'Nome completo',
    get: p.getEletricistas,
    extraOf: (e) => (e.matricula ? `Mat: ${e.matricula}` : ''),
    onAdd: p.onAddEletricista,
    onRemove: p.onRemoveEletricista,
  };
  /** Quem já estava no cabeçalho (turno anterior ou correção) e não está mais na lista: continua escolhível. */
  const anterior = (n: 1 | 2) => ({ nome: v(`nome${n}`).trim(), matricula: v(`mat${n}`).trim() });
  const ANTERIOR = 'anterior';
  const eletSel = ([1, 2] as const).map((n) => h('select', { id: `eletricista${n}`, class: 'field', onChange: () => fillEletricistas() }));
  let primeiraVez = true;
  /**
   * Monta as duas listas. Primeiro decide a escolha de cada uma: na primeira vez, quem veio do turno anterior; depois,
   * mantém a escolha (o "turno anterior" que acabou de ser cadastrado passa a ser a opção do cadastro); se a pessoa
   * foi excluída, volta para "Escolha o eletricista". Depois, na dupla, cada lista fica sem quem está escolhido na
   * outra (a mesma pessoa não pode ser Eletricista 1 e 2).
   */
  const fillEletricistas = () => {
    const lista = p.getEletricistas();
    const montagem = ([1, 2] as const).map((n, i) => {
      const atual = eletSel[i]!.value;
      const ant = anterior(n);
      const doCadastro = lista.find((e) => mesmaPessoa(e, ant));
      const comAnterior = !!ant.nome && !doCadastro;
      const valeAinda = atual === ANTERIOR ? comAnterior : lista.some((e) => e.id === atual);
      const escolha = primeiraVez || (atual === ANTERIOR && doCadastro) ? (doCadastro?.id ?? (ant.nome ? ANTERIOR : '')) : valeAinda ? atual : '';
      const pessoa = escolha === ANTERIOR ? ant : (lista.find((e) => e.id === escolha) ?? null);
      return { ant, comAnterior, escolha, pessoa };
    });
    const [m1, m2] = montagem as [(typeof montagem)[number], (typeof montagem)[number]];
    // Mesma pessoa vinda nas duas (ex.: turno anterior): a 2ª fica para escolher.
    if (mesmaPessoa(m1.pessoa, m2.pessoa)) Object.assign(m2, { escolha: '', pessoa: null });
    ([1, 2] as const).forEach((n, i) => {
      const { ant, comAnterior, escolha } = montagem[i]!;
      const naOutra = dupla ? montagem[1 - i]!.pessoa : null;
      eletSel[i]!.replaceChildren(
        h('option', { value: '' }, lista.length ? 'Escolha o eletricista' : 'Nenhum eletricista cadastrado'),
        // Nome repetido no cadastro: mostra a matrícula junto para dar para saber qual é qual.
        ...lista
          .filter((e) => !mesmaPessoa(e, naOutra))
          .map((e) => h('option', { value: e.id }, lista.filter((x) => x.nome === e.nome).length > 1 ? `${e.nome} (Mat: ${e.matricula || 'sem'})` : e.nome)),
        ...(comAnterior && !mesmaPessoa(ant, naOutra) ? [h('option', { value: ANTERIOR }, `${ant.nome} (turno anterior)`)] : []),
      );
      eletSel[i]!.value = escolha;
      mostraMatricula(n);
    });
    primeiraVez = false;
  };
  /** Campo "Matrícula" ao lado da lista: só leitura, mostra a do eletricista escolhido. */
  const matSaida = ([1, 2] as const).map((n) =>
    h('input', { id: `matricula${n}`, class: 'field', readonly: true, tabindex: '-1', placeholder: '—', 'aria-label': `Matrícula do eletricista ${n}` }),
  );
  const mostraMatricula = (n: 1 | 2) => {
    matSaida[n - 1]!.value = escolhido(n)?.matricula ?? '';
    matSaida[n - 1]!.classList.remove('faltando');
  };
  /** Nome e matrícula do eletricista escolhido na lista `n` (null se nenhum). */
  const escolhido = (n: 1 | 2): { nome: string; matricula: string } | null => {
    const val = eletSel[n - 1]!.value;
    if (val === ANTERIOR) return anterior(n);
    return p.getEletricistas().find((e) => e.id === val) ?? null;
  };

  // Solo ou dupla: solo esconde o Eletricista 2.
  let dupla = !!v('nome2').trim();
  const grupo2 = h('div');
  const modoBtns = (['Solo', 'Dupla'] as const).map((m) =>
    h('button', { type: 'button', 'data-modo': m, class: `${BTN_CHOICE} flex-1 min-h-12 text-sm`, onClick: () => setDupla(m === 'Dupla') }, m),
  );
  const setDupla = (d: boolean) => {
    dupla = d;
    grupo2.classList.toggle('hidden', !d);
    fillEletricistas(); // na dupla, a lista de um fica sem quem está escolhido no outro
    for (const b of modoBtns) {
      const on = (b.dataset.modo === 'Dupla') === d;
      b.setAttribute('aria-pressed', String(on));
      for (const c of ESCOLHA_ON.split(' ')) b.classList.toggle(c, on);
      for (const c of ESCOLHA_OFF.split(' ')) b.classList.toggle(c, !on);
    }
  };

  // Nome na largura toda (nomes longos cabem no celular) e a matrícula na linha de baixo, em campo próprio.
  const eletricistaField = (n: 1 | 2) =>
    h(
      'div',
      { class: 'space-y-2' },
      h('label', { for: `eletricista${n}`, class: 'lbl' }, n === 1 ? 'Eletricista 1 *' : 'Eletricista 2 *'),
      eletSel[n - 1]!,
      h(
        'div',
        { class: 'flex items-center gap-3' },
        h('label', { for: `matricula${n}`, class: 'lbl mb-0 shrink-0 w-24' }, 'Matrícula'),
        h('div', { class: 'flex-1' }, matSaida[n - 1]!),
      ),
    );
  grupo2.append(eletricistaField(2));

  form.append(
    group(
      'Eletricistas',
      Users,
      h('div', { class: 'flex gap-3', role: 'group', 'aria-label': 'Solo ou dupla' }, modoBtns),
      eletricistaField(1),
      grupo2,
      h(
        'div',
        { class: 'flex justify-end' },
        manageLink('btn-eletricistas', 'Adicionar / excluir eletricistas', () => manageCadastro(eletricistasCadastro, fillEletricistas)),
      ),
    ),
    group(
      'Equipe e viatura',
      Truck,
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
        h('label', { for: 'lider', class: 'lbl' }, 'Técnico líder responsável *'),
        manageLink('btn-tecnicos', 'Adicionar / excluir técnicos', () => manageCadastro(tecnicosCadastro, () => fillLider(liderSelect.value))),
      ),
      liderSelect,
    ),
    h(
      'div',
      { class: 'pt-2 flex flex-col sm:flex-row gap-3' },
      init && h('button', { type: 'button', class: `${btn('neutral', 'lg')} sm:w-1/3`, onClick: p.onCancelEdit }, 'Cancelar'),
      h('button', { type: 'submit', class: `flex-1 ${BTN_PRIMARY_LG}` }, init ? 'Salvar cabeçalho' : 'Iniciar turno e liberar OSs', icon(ArrowRight, 'w-5 h-5')),
    ),
  );

  setDupla(dupla); // monta as listas (com quem veio do turno anterior)

  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const e1 = escolhido(1);
    const e2 = dupla ? escolhido(2) : null;
    const campo = (k: keyof ShiftHeader) => (input(k) as HTMLInputElement | null)?.value.trim() ?? '';
    // Tudo o que falta fica vermelho de uma vez; o aviso fala do primeiro problema.
    const faltas: [Element, string][] = [];
    if (!e1) faltas.push([eletSel[0]!, 'Escolha o Eletricista 1 (cadastre em "Adicionar / excluir eletricistas").']);
    else if (!e1.matricula.trim()) faltas.push([matSaida[0]!, `${e1.nome} está sem matrícula: exclua e cadastre de novo com a matrícula.`]);
    if (dupla && !e2) faltas.push([eletSel[1]!, 'Escolha o Eletricista 2, ou marque Solo.']);
    else if (mesmaPessoa(e1, e2)) faltas.push([eletSel[1]!, 'Eletricista 1 e 2 não podem ser a mesma pessoa.']); // rede de segurança: as listas já se excluem
    else if (e2 && !e2.matricula.trim()) faltas.push([matSaida[1]!, `${e2.nome} está sem matrícula: exclua e cadastre de novo com a matrícula.`]);
    for (const k of ['data', 'horaInicio', 'horaFim'] as const) {
      if (!campo(k)) faltas.push([input(k), 'Preencha Data e Horário (início e fim) para liberar o turno.']);
    }
    if (!liderSelect.value) faltas.push([liderSelect, 'Escolha o técnico líder responsável (cadastre em "Adicionar / excluir técnicos").']);
    if (faltas.length) {
      for (const [el] of faltas) marcarFaltando(el);
      showToast(faltas[0]![1], 'error');
      faltas[0]![0].scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    const header = Object.fromEntries(HEADER_FIELDS.map((k) => [k, campo(k)])) as ShiftHeader;
    Object.assign(header, { nome1: e1!.nome, mat1: e1!.matricula, nome2: e2?.nome ?? '', mat2: e2?.matricula ?? '' });
    p.onSubmit(header);
  });

  return h(
    'section',
    { id: 'screen-header', class: 'space-y-6' },
    !init && p.folhas.sheets.length > 0 && sheetsCard(p.folhas),
    h(
      'div',
      { class: 'card overflow-hidden' },
      h(
        'div',
        { class: 'px-6 py-5 border-b border-fg/10 bg-brand/10' },
        h('p', { class: 'text-[11px] uppercase tracking-widest text-brand-fg font-bold' }, 'Departamento de Operação'),
        h('h2', { class: 'text-xl font-extrabold mt-0.5 text-fg' }, init ? 'Editar cabeçalho do turno' : 'Identificação da equipe e turno'),
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
