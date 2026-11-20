import { ArrowLeft, ArrowRight, CircleCheck, CircleX, ShieldAlert, SkipForward } from 'lucide';
import { SERVICE_LABEL } from '../domain/catalog';
import type { Choice, Question, WizardDraft } from '../domain/types';
import { currentQuestion, isLastQuestion, totalQuestions } from '../domain/wizard';
import { TYPE_BADGE } from './dashboard-screen';
import { h, icon } from './dom';

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

const TEXT_INPUT_CLS =
  'w-full px-4 py-4 rounded-xl border-2 border-slate-300 focus:border-energisa-blue outline-none text-lg font-semibold text-energisa-navy bg-slate-50 focus:bg-white transition-all';

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
  const btn = (choice: Choice, node: typeof CircleCheck, on: string, hover: string) =>
    h(
      'button',
      {
        type: 'button',
        'aria-pressed': String(selected === choice),
        'data-choice': choice,
        class: `${size} px-4 rounded-2xl border-2 font-extrabold transition-all flex items-center justify-center gap-2 ${selected === choice ? `${on} text-white shadow-lg` : `border-slate-200 bg-slate-50 text-slate-700 ${hover}`}`,
        onClick: () => onChoice(choice),
      },
      icon(node, 'w-6 h-6'),
      choice.toUpperCase(),
    );
  return h(
    'div',
    { class: 'grid grid-cols-2 gap-4' },
    btn('Sim', CircleCheck, 'border-energisa-blue bg-energisa-blue', 'hover:border-energisa-blue'),
    btn('Não', CircleX, 'border-energisa-navy bg-energisa-navy', 'hover:border-energisa-navy'),
  );
}

export function wizardScreen(p: WizardProps): HTMLElement {
  const { draft } = p;
  const q = currentQuestion(draft);
  const total = totalQuestions(draft);
  const num = draft.index + 1;
  const percent = Math.round((draft.index / total) * 100);
  const saved = draft.answers[q.id];
  const onEnter = (ev: Event) => {
    if ((ev as KeyboardEvent).key === 'Enter') {
      ev.preventDefault();
      p.onNext();
    }
  };

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
      class: TEXT_INPUT_CLS,
      onInput: (ev) => p.onText((ev.target as HTMLInputElement).value),
      onKeydown: onEnter,
    });
  } else {
    const choice = saved?.kind === 'choice' ? saved.choice : undefined;
    inputArea = h('div', { class: 'space-y-4' }, choiceButtons(choice, p.onChoice, q.type === 'yesno'));
    if (q.type === 'yesno_detail' && choice === 'Sim') {
      inputArea.append(
        h(
          'div',
          { class: 'pt-2' },
          h('label', { for: 'wiz-detail-input', class: 'block text-xs font-bold text-energisa-navy uppercase mb-1.5' }, q.detailLabel ?? 'Informe os detalhes:'),
          h('input', {
            id: 'wiz-detail-input',
            type: 'text',
            enterkeyhint: 'next',
            autocomplete: 'off',
            autocapitalize: 'sentences',
            value: saved?.kind === 'choice' ? (saved.detail ?? '') : '',
            placeholder: q.placeholder ?? 'Digite aqui...',
            class: 'w-full px-4 py-3.5 rounded-xl border-2 border-energisa-blue outline-none text-base font-semibold text-energisa-navy bg-white',
            onInput: (ev) => p.onDetail((ev.target as HTMLInputElement).value),
            onKeydown: onEnter,
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
      { class: 'bg-white rounded-2xl p-4 shadow-sm border border-slate-200 flex items-center justify-between gap-3' },
      h(
        'div',
        { class: 'min-w-0' },
        h(
          'div',
          { class: 'flex items-center gap-2 flex-wrap' },
          h('span', { class: `text-xs font-extrabold uppercase px-2.5 py-0.5 rounded-md ${TYPE_BADGE[draft.serviceType]}` }, SERVICE_LABEL[draft.serviceType]),
          h('span', { class: 'text-xs font-bold bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-md' }, `Código ${draft.serviceCode}`),
          draft.editingId && h('span', { class: 'text-xs font-bold bg-energisa-light text-energisa-blue px-2.5 py-0.5 rounded-md' }, 'Editando'),
        ),
        h('p', { class: 'text-sm font-extrabold text-energisa-navy mt-1 break-all' }, 'OS: ', h('span', { id: 'wiz-os-number', class: 'text-energisa-blue' }, draft.osNumber)),
      ),
      h('button', { type: 'button', class: 'shrink-0 text-xs font-bold text-rose-600 hover:bg-rose-50 px-3 py-2 rounded-xl border border-rose-200 transition-colors', onClick: p.onCancel }, draft.editingId ? 'Cancelar edição' : 'Cancelar OS'),
    ),
    h(
      'div',
      { class: 'space-y-1.5' },
      h('div', { class: 'flex justify-between text-xs font-bold text-slate-600' }, h('span', { id: 'wiz-step-label' }, `Pergunta ${num} de ${total}`), h('span', null, `${percent}%`)),
      h(
        'div',
        { class: 'w-full bg-slate-200 h-2.5 rounded-full overflow-hidden', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': total, 'aria-valuenow': draft.index },
        h('div', { class: 'bg-energisa-blue h-full transition-all duration-300 rounded-full', style: `width: ${percent}%` }),
      ),
    ),
    h(
      'div',
      { class: 'bg-white rounded-2xl shadow-md border border-slate-200 p-6 sm:p-8 space-y-6' },
      q.required &&
        h(
          'div',
          { id: 'wiz-mandatory-alert', class: 'bg-rose-50 border-l-4 border-rose-600 p-3.5 rounded-r-xl flex items-start gap-3' },
          icon(ShieldAlert, 'w-5 h-5 text-rose-600 shrink-0 mt-0.5'),
          h(
            'div',
            null,
            h('p', { class: 'text-xs font-extrabold text-rose-800 uppercase' }, 'Resposta obrigatória de segurança'),
            h('p', { class: 'text-xs text-rose-700 mt-0.5' }, 'Esta etapa não pode ser pulada. Selecione SIM ou NÃO para continuar.'),
          ),
        ),
      h(
        'div',
        null,
        h('span', { class: 'text-xs font-bold uppercase tracking-wider text-energisa-blue block mb-1' }, `Pergunta ${num}`),
        h('h2', { id: 'wiz-question-text', class: 'text-xl sm:text-2xl font-extrabold text-energisa-navy leading-snug' }, q.text),
      ),
      inputArea,
      h(
        'div',
        { class: 'pt-4 border-t border-slate-100 flex flex-col-reverse sm:flex-row items-center justify-between gap-3' },
        h(
          'button',
          {
            type: 'button',
            id: 'btn-wiz-prev',
            class: `${draft.index === 0 ? 'invisible' : ''} w-full sm:w-auto px-5 py-3.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-sm hover:bg-slate-50 transition-colors flex items-center justify-center gap-2`,
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
              { type: 'button', id: 'btn-wiz-skip', class: 'flex-1 sm:flex-initial px-5 py-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm transition-colors flex items-center justify-center gap-1.5', onClick: p.onSkip },
              'Pular',
              icon(SkipForward),
            ),
          h(
            'button',
            { type: 'button', id: 'btn-wiz-next', class: 'flex-1 sm:flex-initial px-6 py-3.5 rounded-xl bg-energisa-blue hover:bg-energisa-navy text-white font-bold text-sm shadow-md shadow-energisa-blue/20 transition-all flex items-center justify-center gap-2', onClick: p.onNext },
            isLastQuestion(draft) ? (draft.editingId ? 'Salvar alterações' : 'Concluir OS') : 'Próximo',
            icon(ArrowRight),
          ),
        ),
      ),
    ),
  );
}
