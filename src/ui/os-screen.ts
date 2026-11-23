import { CircleCheck, CircleX, Save } from 'lucide';
import { SERVICE_LABEL, isVisible, questionsFor } from '../domain/catalog';
import { CODE_FIELD, type OSEdit } from '../domain/ordem';
import type { Answer, Choice, Question, ServiceType } from '../domain/types';
import { TYPE_BADGE } from './dashboard-screen';
import { btn, BTN_CHOICE, BTN_PRIMARY_LG, ESCOLHA_OFF, ESCOLHA_ON, h, icon } from './dom';

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
  Sim: `${ESCOLHA_ON} shadow-lg shadow-brand/20`,
  // Inverso do tema (escuro no claro, claro no escuro): distingue bem do SIM.
  Não: 'border-fg bg-fg text-app shadow-lg',
};
const CHOICE_OFF = `${ESCOLHA_OFF} hover:border-brand`;

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
    case 'longo':
      return { rows: '4' }; // caixa aberta (textarea)
    default:
      return { type: 'text' };
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
        class: `${BTN_CHOICE} min-h-14 px-4 text-base ${selected === choice ? CHOICE_ON[choice] : CHOICE_OFF}`,
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

  /** Blocos que dependem de outra resposta (`showIf`), para mostrar/esconder na hora. */
  const dependents: { q: Question; el: HTMLElement }[] = [];
  /**
   * Depois de um SIM/NÃO em `tocado`: mostra só as dependentes que valem e abre o teclado no primeiro campo que
   * apareceu abaixo dele (um que aparece acima, como o medidor da UC, não puxa a tela para cima).
   */
  const refresh = (tocado: HTMLElement) => {
    let toFocus: HTMLElement | undefined;
    for (const { q, el } of dependents) {
      const show = isVisible(q, answers);
      const abaixo = !!(tocado.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING);
      if (show && abaixo && el.classList.contains('hidden')) toFocus ??= el;
      el.classList.toggle('hidden', !show);
    }
    toFocus?.querySelector<HTMLInputElement>('input')?.focus();
  };

  /** Um bloco por pergunta; SIM/NÃO redesenham só o próprio bloco (mantém o foco e o que foi digitado nos outros). */
  const questionBlock = (q: Question): HTMLElement => {
    // Dependente de outra resposta: recuada, como um submenu da pergunta de cima.
    const block = h('div', {
      class: `card p-4 space-y-3${q.showIf ? ' ml-6' : ''}${isVisible(q, answers) ? '' : ' hidden'}`,
      'data-question': q.id,
      'data-field': q.id,
    });
    if (q.showIf) dependents.push({ q, el: block });
    const draw = () => {
      const ans = answers[q.id];
      const title = h(
        'p',
        { class: 'text-sm font-bold text-fg' },
        q.text,
        q.required && h('span', { class: 'ml-2 text-[11px] font-bold text-danger-fg uppercase' }, 'obrigatória'),
      );
      if (q.type === 'text') {
        // Caixa aberta (relato livre, `input: 'longo'`): textarea de várias linhas; o resto, campo de uma linha.
        const input = h(q.input === 'longo' ? 'textarea' : 'input', {
          id: `q-${q.id}`,
          class: 'field',
          autocomplete: 'off',
          ...inputAttrs(q),
          value: ans?.kind === 'text' ? ans.value : '',
          placeholder: q.placeholder ?? 'Não informado',
          'aria-label': q.text,
          onInput: (ev: Event) => {
            answers[q.id] = { kind: 'text', value: (ev.target as HTMLInputElement | HTMLTextAreaElement).value };
            changed();
          },
        });
        block.replaceChildren(title, input);
        return;
      }
      const selected = ans?.kind === 'choice' ? ans.choice : undefined;
      const choose = (choice: Choice) => {
        // Tocar de novo no que já está marcado limpa a resposta (exceto na obrigatória).
        answers[q.id] = selected === choice && !q.required ? { kind: 'skipped' } : { kind: 'choice', choice };
        changed();
        draw();
        refresh(block);
      };
      block.replaceChildren(title, choiceButtons(selected, choose));
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
      h('button', { type: 'button', class: `${btn('neutral')} shrink-0`, onClick: p.onCancel }, 'Cancelar'),
    ),
    h(
      'div',
      { class: 'card p-4 space-y-3' },
      textField('os-number', NUMBER_LABEL[p.serviceType], state.osNumber, { inputmode: 'numeric', placeholder: 'Digite o número do serviço.' }, (v) => (state.osNumber = v)),
      textField('os-code', 'Código do serviço', state.serviceCode, { inputmode: 'numeric', maxlength: '10', placeholder: 'Digite o código do serviço.' }, (v) => (state.serviceCode = v), CODE_FIELD),
    ),
    questionsFor(p.serviceType).map(questionBlock),
    h(
      'button',
      { type: 'button', id: 'btn-os-save', class: `w-full ${BTN_PRIMARY_LG}`, onClick: () => p.onSave(current()) },
      icon(Save, 'w-5 h-5'),
      isNew ? 'Salvar OS' : 'Salvar alterações',
    ),
  );
}
