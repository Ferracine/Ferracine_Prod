import { Briefcase, CirclePlus, ClipboardList, Eye, FileDown, Pencil, Trash2, TriangleAlert } from 'lucide';
import { SERVICE_CODES, SERVICE_LABEL, questionsFor } from '../domain/catalog';
import { formatDateBR, formatHorario, orDash, plural, teamLabel } from '../domain/format';
import type { OrdemServico, ServiceType, ShiftHeader } from '../domain/types';
import { answerRows } from '../domain/wizard';
import { INPUT_CLS, LABEL_CLS, h, icon } from './dom';

export interface DashboardProps {
  header: ShiftHeader;
  ordens: readonly OrdemServico[];
  onStartOS: (osNumber: string, type: ServiceType, code: string) => void;
  onView: (os: OrdemServico) => void;
  onEdit: (os: OrdemServico) => void;
  onDelete: (os: OrdemServico) => void;
  onEditHeader: () => void;
  onFinish: () => void;
}

const TYPE_STYLE: Record<ServiceType, { box: string; title: string; chip: string; code: string; iconCls: string }> = {
  COMERCIAL: {
    box: 'border-2 border-emerald-200 bg-emerald-50/40 rounded-xl p-4 space-y-3',
    title: 'font-extrabold text-emerald-900 text-sm flex items-center gap-1.5',
    chip: 'text-[11px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md',
    code: 'min-w-14 px-3.5 py-3 rounded-xl bg-white hover:bg-emerald-600 text-emerald-900 hover:text-white border border-emerald-300 font-extrabold text-base shadow-sm transition-all active:scale-95',
    iconCls: 'w-4 h-4 text-emerald-600',
  },
  OCORRENCIA: {
    box: 'border-2 border-amber-200 bg-amber-50/40 rounded-xl p-4 space-y-3',
    title: 'font-extrabold text-amber-900 text-sm flex items-center gap-1.5',
    chip: 'text-[11px] font-semibold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md',
    code: 'min-w-14 px-3.5 py-3 rounded-xl bg-white hover:bg-amber-600 text-amber-900 hover:text-white border border-amber-300 font-extrabold text-base shadow-sm transition-all active:scale-95',
    iconCls: 'w-4 h-4 text-amber-600',
  },
};

export const TYPE_BADGE: Record<ServiceType, string> = {
  COMERCIAL: 'bg-emerald-100 text-emerald-800',
  OCORRENCIA: 'bg-amber-100 text-amber-800',
};

function osRow(os: OrdemServico, index: number, p: DashboardProps): HTMLElement {
  const rows = answerRows(os);
  const answered = rows.filter((r) => !r.skipped).length;
  const time = new Date(os.registradaEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const action = (label: string, cls: string, node: Parameters<typeof icon>[0], onClick: () => void) =>
    h('button', { type: 'button', title: label, 'aria-label': `${label} OS ${os.osNumber}`, class: `p-3 rounded-xl bg-white border border-slate-200 transition-colors ${cls}`, onClick }, icon(node));

  return h(
    'li',
    { class: 'flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-slate-50/70 gap-3', 'data-testid': 'os-item' },
    h(
      'div',
      { class: 'min-w-0' },
      h(
        'div',
        { class: 'flex items-center gap-2 flex-wrap' },
        h('span', { class: 'font-extrabold text-energisa-navy text-base break-all' }, `#${index + 1} • OS ${os.osNumber}`),
        h('span', { class: `text-[11px] font-bold px-2 py-0.5 rounded-md ${TYPE_BADGE[os.serviceType]}` }, SERVICE_LABEL[os.serviceType]),
        h('span', { class: 'text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-200 text-slate-700' }, `Cód. ${os.serviceCode}`),
      ),
      h('p', { class: 'text-xs text-slate-500 mt-1' }, `${answered} de ${rows.length} respondidas • ${time}`),
    ),
    h(
      'div',
      { class: 'flex items-center gap-1.5 shrink-0' },
      action('Ver respostas', 'text-energisa-blue hover:bg-energisa-light', Eye, () => p.onView(os)),
      action('Editar', 'text-slate-600 hover:bg-slate-100', Pencil, () => p.onEdit(os)),
      action('Excluir', 'text-rose-600 hover:bg-rose-50', Trash2, () => p.onDelete(os)),
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
    placeholder: 'Digite o número da OS...',
    class: `${INPUT_CLS} py-3.5 border-2 border-slate-200 text-lg font-bold text-energisa-navy bg-slate-50 focus:bg-white`,
  });

  const typeBlock = (type: ServiceType) => {
    const s = TYPE_STYLE[type];
    return h(
      'div',
      { class: s.box },
      h(
        'div',
        { class: 'flex items-center justify-between' },
        h('span', { class: s.title }, icon(type === 'COMERCIAL' ? Briefcase : TriangleAlert, s.iconCls), SERVICE_LABEL[type]),
        h('span', { class: s.chip }, plural(questionsFor(type).length, 'pergunta', 'perguntas')),
      ),
      h('p', { class: 'text-xs text-slate-600' }, 'Toque no código para iniciar:'),
      h(
        'div',
        { class: 'flex flex-wrap gap-2' },
        SERVICE_CODES[type].map((code) =>
          h('button', { type: 'button', class: s.code, 'data-code': code, onClick: () => p.onStartOS(osInput.value.trim(), type, code) }, code),
        ),
      ),
    );
  };

  const list =
    ordens.length === 0
      ? h(
          'div',
          { class: 'text-center py-8 px-4 bg-slate-50 rounded-xl border border-dashed border-slate-300' },
          h('p', { class: 'text-sm font-semibold text-slate-500' }, 'Nenhuma Ordem de Serviço registrada ainda.'),
          h('p', { class: 'text-xs text-slate-400 mt-1' }, 'Digite o número da OS acima e toque no código para começar.'),
        )
      : h('ul', { class: 'space-y-3' }, ordens.map((os, i) => osRow(os, i, p)));

  return h(
    'section',
    { id: 'screen-dashboard', class: 'space-y-6' },
    h(
      'div',
      { class: 'bg-energisa-navy text-white rounded-2xl p-5 shadow-md border-b-4 border-energisa-orange' },
      h(
        'div',
        { class: 'flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-white/15' },
        h('span', { class: 'text-xs font-bold uppercase tracking-wider text-energisa-orange' }, 'Cabeçalho ativo do turno'),
        h(
          'div',
          { class: 'flex items-center gap-2' },
          h('span', { class: 'text-xs bg-white/15 px-3 py-1 rounded-full font-semibold' }, `${formatDateBR(header.data)} | ${formatHorario(header)}`),
          h('button', { type: 'button', class: 'text-xs font-bold bg-white/10 hover:bg-white/20 px-3 py-1 rounded-full flex items-center gap-1', onClick: p.onEditHeader }, icon(Pencil, 'w-3 h-3'), 'Corrigir'),
        ),
      ),
      h(
        'div',
        { class: 'grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm' },
        h('div', null, h('span', { class: 'text-slate-400 text-xs block' }, 'Equipe:'), h('p', { class: 'font-bold leading-snug' }, teamLabel(header))),
        h('div', { class: 'sm:text-right' }, h('span', { class: 'text-slate-400 text-xs block' }, 'Bodycam 1:'), h('p', { class: 'font-bold text-blue-200' }, orDash(header.bodycam1))),
      ),
    ),
    h(
      'div',
      { class: 'bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-5' },
      h(
        'div',
        { class: 'flex items-center gap-2 border-b border-slate-100 pb-3' },
        h('div', { class: 'bg-energisa-light text-energisa-blue p-2 rounded-lg' }, icon(CirclePlus, 'w-5 h-5')),
        h(
          'div',
          null,
          h('h2', { class: 'text-base font-bold text-energisa-navy' }, 'Registrar nova Ordem de Serviço'),
          h('p', { class: 'text-xs text-slate-500' }, 'Informe o número da OS e toque no código de atendimento.'),
        ),
      ),
      h('div', null, h('label', { for: 'input-os-number', class: LABEL_CLS }, 'Número da Ordem de Serviço (OS) *'), osInput),
      h('div', { class: 'grid grid-cols-1 md:grid-cols-2 gap-4' }, typeBlock('COMERCIAL'), typeBlock('OCORRENCIA')),
    ),
    h(
      'div',
      { class: 'bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4' },
      h(
        'div',
        { class: 'flex items-center justify-between border-b border-slate-100 pb-3' },
        h('div', { class: 'flex items-center gap-2' }, icon(ClipboardList, 'w-5 h-5 text-energisa-blue'), h('h3', { class: 'font-bold text-energisa-navy text-base' }, 'OSs concluídas no turno')),
        h('span', { id: 'os-count-badge', class: 'bg-energisa-navy text-white text-xs font-bold px-3 py-1 rounded-full' }, plural(ordens.length, 'OS', 'OSs')),
      ),
      list,
    ),
    h(
      'div',
      { class: 'pt-2 pb-8' },
      h(
        'button',
        { type: 'button', id: 'btn-finish', class: 'w-full bg-energisa-orange hover:bg-orange-600 text-white font-extrabold py-4 px-6 rounded-2xl shadow-xl shadow-orange-500/25 transition-all flex items-center justify-center gap-3 text-base active:scale-[0.99]', onClick: p.onFinish },
        icon(FileDown, 'w-6 h-6'),
        'Finalizar turno e gerar PDF',
      ),
      h('p', { class: 'text-center text-xs text-slate-500 mt-2.5' }, 'Ao gerar o PDF a folha é encerrada e o cabeçalho é reiniciado para o próximo turno. O último PDF fica disponível para baixar de novo.'),
    ),
  );
}
