import { ArrowDown01, ArrowDown10, ClipboardList, Eye, Pencil, Plus, Trash2 } from 'lucide';
import { SERVICE_LABEL } from '../domain/catalog';
import { formatDateBR, formatHorario, orDash, osLabel, plural } from '../domain/format';
import type { OrdemServico, ServiceType, ShiftHeader } from '../domain/types';
import { answerRows, faltaObrigatoria } from '../domain/ordem';
import { btn, type BtnTom, gradeBotoes, h, icon } from './dom';

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
  /** "Cancelar turno": descarta o turno (pede confirmação antes). */
  onCancelTurno: () => void;
  /** Lista das OSs da mais recente para a mais antiga (o número # de cada uma não muda). */
  decrescente: boolean;
  onInverterOrdem: () => void;
}

/** Cores do selo de tipo (lista e tela da OS): Comercial = cor principal do tema, Ocorrência = cor de destaque. */
export const TYPE_BADGE: Record<ServiceType, string> = {
  COMERCIAL: 'bg-brand/15 text-brand-fg',
  OCORRENCIA: 'bg-accent/15 text-accent-fg',
};

const BADGE = 'text-[11px] font-bold px-2 py-0.5 rounded-md';

/** Nova OS: botão do tema; Comercial = ação principal (o "botão padrão" nos temas Windows), Ocorrência = destaque. */
const NOVA_OS: Record<ServiceType, { tom: BtnTom; rotulo: string }> = {
  COMERCIAL: { tom: 'primary', rotulo: 'Nova Comercial' },
  OCORRENCIA: { tom: 'accent', rotulo: 'Nova Ocorrência' },
};

function botaoNovaOS(type: ServiceType, onClick: () => void): HTMLElement {
  const { tom, rotulo } = NOVA_OS[type];
  return h('button', { type: 'button', id: `btn-new-${type.toLowerCase()}`, class: btn(tom), onClick }, icon(Plus, 'w-5 h-5'), rotulo);
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
    { class: 'painel flex items-center justify-between p-4 rounded-xl border border-fg/10 bg-fg/[0.03] gap-3', 'data-testid': 'os-item' },
    h(
      'div',
      { class: 'min-w-0' },
      h('span', { class: 'font-extrabold text-fg text-base break-all' }, `#${index + 1} • OS ${label}`),
      h(
        'div',
        { class: 'flex items-center gap-1.5 flex-wrap mt-1' },
        !os.osNumber && h('span', { class: `${BADGE} bg-rose-500/15 text-danger-fg` }, 'sem nº'),
        faltaObrigatoria(os) && h('span', { class: `${BADGE} bg-rose-500/15 text-danger-fg` }, 'falta DITAIS'),
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

/** Linhas na ordem escolhida (o # de cada OS é a posição na folha e não muda). */
const ordenar = (linhas: HTMLElement[], decrescente: boolean) => (decrescente ? linhas.reverse() : linhas);

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
      : h('ul', { class: 'space-y-3', 'data-testid': 'os-list' }, ordenar(ordens.map((os, i) => osRow(os, i, p)), p.decrescente));

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
          h('button', { type: 'button', class: btn('neutral', 'sm'), onClick: p.onEditHeader }, icon(Pencil, 'w-3.5 h-3.5'), 'Editar'),
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
    // Nova OS: um botão por tipo; cada um abre a tela da OS em branco com as perguntas daquele tipo.
    gradeBotoes((['COMERCIAL', 'OCORRENCIA'] as const).map((type) => botaoNovaOS(type, () => p.onNewOS(type)))),
    h(
      'div',
      { class: 'card p-6 space-y-4' },
      h(
        'div',
        { class: 'flex items-center justify-between border-b border-fg/10 pb-3' },
        h('div', { class: 'flex items-center gap-2' }, icon(ClipboardList, 'w-5 h-5 text-brand-fg'), h('h3', { class: 'font-extrabold text-fg text-base' }, 'OSs concluídas no turno')),
        h(
          'div',
          { class: 'flex items-center gap-2' },
          ordens.length > 1 &&
            h(
              'button',
              {
                type: 'button',
                id: 'btn-ordem-os',
                class: `${btn('outline', 'sm')} text-fg`,
                'aria-pressed': String(p.decrescente),
                title: 'Inverter a ordem da lista',
                onClick: p.onInverterOrdem,
              },
              icon(p.decrescente ? ArrowDown10 : ArrowDown01, 'w-4 h-4'),
              p.decrescente ? 'Decrescente' : 'Crescente',
            ),
          h('span', { id: 'os-count-badge', class: 'bg-brand-600 text-white text-xs font-bold px-3 py-1 rounded-full' }, plural(ordens.length, 'OS', 'OSs')),
        ),
      ),
      list,
    ),
    h(
      'div',
      { class: 'pt-2 pb-8' },
      gradeBotoes([
        h('button', { type: 'button', id: 'btn-finish', class: `${btn('accent', 'lg')} shadow-lg shadow-accent/20`, onClick: p.onFinish }, 'Encerrar turno'),
        // Destrutiva, mas discreta (contornada, texto vermelho), como o Excluir do histórico; confirma antes.
        h('button', { type: 'button', id: 'btn-cancel-turno', class: `${btn('outline', 'lg')} text-danger-fg`, onClick: p.onCancelTurno }, 'Cancelar turno'),
      ]),
    ),
  );
}
