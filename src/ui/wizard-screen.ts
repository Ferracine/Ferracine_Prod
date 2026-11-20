import { ArrowLeft, ArrowRight, CircleCheck, CircleX, ShieldAlert, SkipForward } from 'lucide';
import { SERVICE_LABEL } from '../domain/catalog';
import { osLabel } from '../domain/format';
import type { Choice, Question, WizardDraft } from '../domain/types';
import { currentQuestion, isLastQuestion, totalQuestions } from '../domain/wizard';
import { TYPE_BADGE } from './dashboard-screen';
import { h, icon, onEnter } from './dom';

export interface WizardProps {
  draft: WizardDraft;
  onText: (value: string) => void;
  onChoice: (choice: Choice) => void;
  onDetail: (value: string) => void;
  onNext: () => void;
  onSkip: () => void;
  onBack: () => void;
  onCancel: () => void;
}

const CHOICE_ON: Record<Choice, string> = {
  Sim: 'border-energisa-sky bg-energisa-blue text-white shadow-lg shadow-sky-500/20',
  Não: 'border-slate-300 bg-slate-200 text-slate-900 shadow-lg',
};
const CHOICE_OFF = 'border-white/15 bg-white/5 text-slate-200 hover:border-energisa-sky';

function inputAttrs(q: Question): Record<string, string> {
  switch (q.input) {
    case 'time':
      return { type: 'time' };
    case 'numeric':
    case 'decimal':
      return { type: 'text', inputmode: q.input };
    default:
      return { type: 'text', autocapitalize: 'sentences' };
  }
}

function choiceButtons(selected: Choice | undefined, onChoice: (c: Choice) => void, big: boolean): HTMLElement {
  const size = big ? 'py-5 text-lg' : 'py-4 text-base';
  const btn = (choice: Choice, node: typeof CircleCheck) =>
    h(
      'button',
      {
        type: 'button',
        'aria-pressed': String(selected === choice),
        'data-choice': choice,
        class: `${size} px-4 rounded-2xl border-2 font-extrabold transition-all flex items-center justify-center gap-2 ${selected === choice ? CHOICE_ON[choice] : CHOICE_OFF}`,
        onClick: () => onChoice(choice),
      },
      icon(node, 'w-6 h-6'),
      choice.toUpperCase(),
    );
  return h('div', { class: 'grid grid-cols-2 gap-4' }, btn('Sim', CircleCheck), btn('Não', CircleX));
}

export function wizardScreen(p: WizardProps): HTMLElement {
  const { draft } = p;
  const q = currentQuestion(draft);
  const total = totalQuestions(draft);
  const num = draft.index + 1;
  const percent = Math.round((draft.index / total) * 100);
  const saved = draft.answers[q.id];
  const nextOnEnter = onEnter(p.onNext);

  let inputArea: HTMLElement;
  if (q.type === 'text') {
    inputArea = h('input', {
      id: 'wiz-text-input',
      ...inputAttrs(q),
      enterkeyhint: isLastQuestion(draft) ? 'done' : 'next',
      autocomplete: 'off',
      'aria-labelledby': 'wiz-question-text',
      value: saved?.kind === 'text' ? saved.value : '',
      placeholder: q.placeholder ?? 'Digite sua resposta...',
      class: 'field py-4',
      onInput: (ev) => p.onText((ev.target as HTMLInputElement).value),
      onKeydown: nextOnEnter,
    });
  } else {
    const choice = saved?.kind === 'choice' ? saved.choice : undefined;
    inputArea = h('div', { class: 'space-y-4' }, choiceButtons(choice, p.onChoice, q.type === 'yesno'));
    if (q.type === 'yesno_detail' && choice === 'Sim') {
      inputArea.append(
        h(
          'div',
          { class: 'pt-2' },
          h('label', { for: 'wiz-detail-input', class: 'lbl' }, q.detailLabel ?? 'Informe os detalhes:'),
          h('input', {
            id: 'wiz-detail-input',
            type: 'text',
            enterkeyhint: 'next',
            autocomplete: 'off',
            autocapitalize: 'sentences',
            value: saved?.kind === 'choice' ? (saved.detail ?? '') : '',
            placeholder: q.placeholder ?? 'Digite aqui...',
            class: 'field py-3.5',
            onInput: (ev) => p.onDetail((ev.target as HTMLInputElement).value),
            onKeydown: nextOnEnter,
          }),
        ),
      );
    }
  }

  return h(
    'section',
    { id: 'screen-wizard', class: 'space-y-5' },
    h(
      'div',
      { class: 'card p-4 flex items-center justify-between gap-3' },
      h(
        'div',
        { class: 'min-w-0' },
        h(
          'div',
          { class: 'flex items-center gap-2 flex-wrap' },
          h('span', { class: `text-xs font-extrabold uppercase px-2.5 py-0.5 rounded-md ${TYPE_BADGE[draft.serviceType]}` }, SERVICE_LABEL[draft.serviceType]),
          h('span', { class: 'text-xs font-bold bg-white/10 text-slate-200 px-2.5 py-0.5 rounded-md' }, `Código ${draft.serviceCode}`),
          draft.editingId && h('span', { class: 'text-xs font-bold bg-energisa-blue/20 text-energisa-sky px-2.5 py-0.5 rounded-md' }, 'Editando'),
        ),
        h('p', { class: 'text-sm font-extrabold text-white mt-1 break-all' }, 'OS: ', h('span', { id: 'wiz-os-number', class: 'text-energisa-sky' }, osLabel(draft.osNumber))),
      ),
      h('button', { type: 'button', class: 'shrink-0 text-xs font-bold text-rose-300 hover:bg-rose-500/10 px-3 py-2 rounded-xl border border-rose-400/30 transition-colors', onClick: p.onCancel }, draft.editingId ? 'Cancelar edição' : 'Cancelar OS'),
    ),
    h(
      'div',
      { class: 'space-y-1.5' },
      h('div', { class: 'flex justify-between text-xs font-bold text-slate-400' }, h('span', { id: 'wiz-step-label' }, `Pergunta ${num} de ${total}`), h('span', null, `${percent}%`)),
      h(
        'div',
        { class: 'w-full bg-white/10 h-2.5 rounded-full overflow-hidden', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': total, 'aria-valuenow': draft.index },
        h('div', { class: 'bg-gradient-to-r from-energisa-blue to-energisa-sky h-full transition-all duration-300 rounded-full', style: `width: ${percent}%` }),
      ),
    ),
    h(
      'div',
      { class: 'card p-6 sm:p-8 space-y-6 shadow-2xl shadow-black/30' },
      q.required &&
        h(
          'div',
          { id: 'wiz-mandatory-alert', class: 'bg-rose-500/10 border-l-4 border-rose-500 p-3.5 rounded-r-xl flex items-start gap-3' },
          icon(ShieldAlert, 'w-5 h-5 text-rose-400 shrink-0 mt-0.5'),
          h(
            'div',
            null,
            h('p', { class: 'text-xs font-extrabold text-rose-300 uppercase' }, 'Resposta obrigatória de segurança'),
            h('p', { class: 'text-xs text-rose-200/80 mt-0.5' }, 'Esta etapa não pode ser pulada. Selecione SIM ou NÃO para continuar.'),
          ),
        ),
      h(
        'div',
        null,
        h('span', { class: 'text-xs font-bold uppercase tracking-widest text-energisa-sky block mb-1' }, `Pergunta ${num}`),
        h('h2', { id: 'wiz-question-text', class: 'text-xl sm:text-2xl font-extrabold text-white leading-snug' }, q.text),
      ),
      inputArea,
      h(
        'div',
        { class: 'pt-4 border-t border-white/10 flex flex-col-reverse sm:flex-row items-center justify-between gap-3' },
        h(
          'button',
          {
            type: 'button',
            id: 'btn-wiz-prev',
            class: `${draft.index === 0 ? 'invisible' : ''} w-full sm:w-auto px-5 py-3.5 rounded-xl border border-white/15 text-slate-200 font-bold text-sm hover:bg-white/5 transition-colors flex items-center justify-center gap-2`,
            onClick: p.onBack,
          },
          icon(ArrowLeft),
          'Voltar',
        ),
        h(
          'div',
          { class: 'w-full sm:w-auto flex items-center gap-3' },
          !q.required &&
            h(
              'button',
              { type: 'button', id: 'btn-wiz-skip', class: 'flex-1 sm:flex-initial px-5 py-3.5 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 font-bold text-sm transition-colors flex items-center justify-center gap-1.5', onClick: p.onSkip },
              'Pular',
              icon(SkipForward),
            ),
          h(
            'button',
            { type: 'button', id: 'btn-wiz-next', class: 'flex-1 sm:flex-initial whitespace-nowrap px-6 py-3.5 rounded-xl bg-gradient-to-r from-energisa-blue to-sky-500 hover:brightness-110 text-white font-extrabold text-sm shadow-md shadow-sky-500/20 transition-all flex items-center justify-center gap-2', onClick: p.onNext },
            isLastQuestion(draft) ? (draft.editingId ? 'Salvar alterações' : 'Concluir OS') : 'Próximo',
            icon(ArrowRight),
          ),
        ),
      ),
    ),
  );
}
