import { CircleCheck, CircleX, Save } from 'lucide';
import { SERVICE_LABEL, questionsFor } from '../domain/catalog';
import { CODE_FIELD, choiceAnswer, type OSEdit } from '../domain/ordem';
import type { Answer, Choice, Question, ServiceType } from '../domain/types';
import { TYPE_BADGE } from './dashboard-screen';
import { BTN, BTN_PRIMARY_LG, h, icon } from './dom';

export interface OSScreenProps {
  /** `new`: OS nova (rascunho salvo a cada alteração); `edit`: lápis de uma OS concluída. */
  mode: 'new' | 'edit';
  serviceType: ServiceType;
  initial: OSEdit;
  /** A cada alteração, com tudo o que está na tela. */
  onChange: (edit: OSEdit) => void;
  /** Valida e grava; as regras ficam em `createOS`/`applyEdit` (domain/ordem.ts). */
  onSave: (edit: OSEdit) => void;
  onCancel: () => void;
}

const CHOICE_ON: Record<Choice, string> = {
  Sim: 'border-brand bg-brand-600 text-white shadow-lg shadow-brand/20',
  // Inverso do tema (escuro no claro, claro no escuro): distingue bem do SIM.
  Não: 'border-fg bg-fg text-app shadow-lg',
};
const CHOICE_OFF = 'border-fg/15 bg-fg/5 text-fg hover:border-brand';

/** Rótulo do número no topo da tela: número da ocorrência ou da OS comercial. */
const NUMBER_LABEL: Record<ServiceType, string> = {
  COMERCIAL: 'Número da OS comercial',
  OCORRENCIA: 'Número da ocorrência',
};

function typeBadge(type: ServiceType): HTMLElement {
  return h('span', { class: `text-xs font-extrabold uppercase px-2.5 py-0.5 rounded-md ${TYPE_BADGE[type]}` }, SERVICE_LABEL[type]);
}

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

function choiceButtons(selected: Choice | undefined, onChoice: (c: Choice) => void): HTMLElement {
  const btn = (choice: Choice, node: typeof CircleCheck) =>
    h(
      'button',
      {
        type: 'button',
        'aria-pressed': String(selected === choice),
        'data-choice': choice,
        class: `py-3 text-base px-4 rounded-2xl border-2 font-extrabold transition-all flex items-center justify-center gap-2 ${selected === choice ? CHOICE_ON[choice] : CHOICE_OFF}`,
        onClick: () => onChoice(choice),
      },
      icon(node, 'w-6 h-6'),
      choice.toUpperCase(),
    );
  return h('div', { class: 'grid grid-cols-2 gap-4' }, btn('Sim', CircleCheck), btn('Não', CircleX));
}

/**
 * Tela da OS: número, código e todas as perguntas numa página (a mesma para a OS nova e para o lápis).
 * O estado vive nesta tela e sai por `onChange` a cada alteração; nada é gravado na folha antes de "Salvar".
 */
export function osScreen(p: OSScreenProps): HTMLElement {
  const answers: Record<string, Answer> = { ...p.initial.answers };
  const state = { osNumber: p.initial.osNumber, serviceCode: p.initial.serviceCode };
  const current = (): OSEdit => ({ ...state, answers: { ...answers } });
  const changed = () => p.onChange(current());
  const isNew = p.mode === 'new';

  /** Campo de texto do topo. `field` = id para o erro de regra rolar até ele (data-field). */
  const textField = (id: string, label: string, value: string, attrs: Record<string, string>, onValue: (v: string) => void, field?: string) =>
    h(
      'div',
      field ? { 'data-field': field } : null,
      h('label', { for: id, class: 'lbl' }, label),
      h('input', { id, class: 'field', autocomplete: 'off', value, ...attrs, onInput: (ev) => { onValue((ev.target as HTMLInputElement).value); changed(); } }),
    );

  /** Um bloco por pergunta; SIM/NÃO redesenham só o próprio bloco (mantém o foco e o que foi digitado nos outros). */
  const questionBlock = (q: Question): HTMLElement => {
    const block = h('div', { class: 'card p-4 space-y-3', 'data-question': q.id, 'data-field': q.id });
    const draw = () => {
      const ans = answers[q.id];
      const title = h(
        'p',
        { class: 'text-sm font-bold text-fg' },
        q.text,
        q.required && h('span', { class: 'ml-2 text-[11px] font-bold text-danger-fg uppercase' }, 'obrigatória'),
      );
      if (q.type === 'text') {
        const input = h('input', {
          id: `q-${q.id}`,
          class: 'field',
          autocomplete: 'off',
          ...inputAttrs(q),
          value: ans?.kind === 'text' ? ans.value : '',
          placeholder: q.placeholder ?? 'Não informado',
          'aria-label': q.text,
          onInput: (ev) => {
            answers[q.id] = { kind: 'text', value: (ev.target as HTMLInputElement).value };
            changed();
          },
        });
        block.replaceChildren(title, input);
        return;
      }
      const selected = ans?.kind === 'choice' ? ans.choice : undefined;
      const choose = (choice: Choice) => {
        // Tocar de novo no que já está marcado limpa a resposta (exceto na obrigatória).
        answers[q.id] = selected === choice && !q.required ? { kind: 'skipped' } : choiceAnswer(q, ans, choice);
        changed();
        draw();
        block.querySelector<HTMLInputElement>('input')?.focus();
      };
      block.replaceChildren(title, choiceButtons(selected, choose));
      if (q.type === 'yesno_detail' && ans?.kind === 'choice' && ans.choice === 'Sim') {
        block.append(
          h('input', {
            type: 'text',
            autocomplete: 'off',
            autocapitalize: 'sentences',
            value: ans.detail ?? '',
            placeholder: q.placeholder ?? 'Digite aqui...',
            class: 'field py-3.5',
            'aria-label': q.detailLabel ?? 'Complemento',
            onInput: (ev) => {
              const cur = answers[q.id];
              if (cur?.kind === 'choice') answers[q.id] = { ...cur, detail: (ev.target as HTMLInputElement).value };
              changed();
            },
          }),
        );
      }
    };
    draw();
    return block;
  };

  return h(
    'section',
    { id: 'screen-os', 'data-mode': p.mode, class: 'space-y-4 pb-8' },
    h(
      'div',
      { class: 'card p-4 flex items-center justify-between gap-3' },
      h(
        'div',
        { class: 'min-w-0' },
        h(
          'div',
          { class: 'flex items-center gap-2 flex-wrap' },
          typeBadge(p.serviceType),
          !isNew && h('span', { class: 'text-xs font-bold bg-fg/10 text-fg px-2.5 py-0.5 rounded-md' }, 'Editando'),
        ),
        h('p', { class: 'text-xs text-muted mt-1' }, isNew ? 'Informe o número (opcional) e o código, preencha o que souber e toque em "Salvar OS".' : 'Altere o que precisar e toque em "Salvar alterações".'),
      ),
      h('button', { type: 'button', class: `${BTN.neutral} shrink-0`, onClick: p.onCancel }, 'Cancelar'),
    ),
    h(
      'div',
      { class: 'card p-4 space-y-3' },
      textField('os-number', NUMBER_LABEL[p.serviceType], state.osNumber, { inputmode: 'numeric', placeholder: 'Vazio = S/N' }, (v) => (state.osNumber = v)),
      textField('os-code', 'Código do serviço', state.serviceCode, { inputmode: 'numeric', maxlength: '10', placeholder: 'Digite o código do serviço' }, (v) => (state.serviceCode = v), CODE_FIELD),
    ),
    // A pergunta do número da OS é respondida no campo acima.
    questionsFor(p.serviceType).filter((q) => !q.prefillOS).map(questionBlock),
    h(
      'button',
      { type: 'button', id: 'btn-os-save', class: `w-full ${BTN_PRIMARY_LG}`, onClick: () => p.onSave(current()) },
      icon(Save, 'w-5 h-5'),
      isNew ? 'Salvar OS' : 'Salvar alterações',
    ),
  );
}
