import { Save } from 'lucide';
import { questionsFor } from '../domain/catalog';
import type { Answer, Choice, OrdemServico, Question } from '../domain/types';
import { choiceAnswer, type OSEdit } from '../domain/wizard';
import { BTN, BTN_PRIMARY_LG, h, icon } from './dom';
import { choiceButtons, detailInput, inputAttrs, typeBadge } from './wizard-screen';

export interface EditProps {
  os: OrdemServico;
  /** Valida e grava; as regras ficam em `applyEdit` (domain/wizard.ts). */
  onSave: (edit: OSEdit) => void;
  onCancel: () => void;
  /** Chamado na primeira alteração (para confirmar antes de descartar). */
  onDirty: () => void;
}

/**
 * Edição completa de uma OS concluída (lápis da lista): número, código e todas as respostas numa página.
 * O estado da edição vive só nesta tela; a OS salva só muda ao tocar em "Salvar alterações".
 */
export function editScreen(p: EditProps): HTMLElement {
  const { os } = p;
  const answers: Record<string, Answer> = { ...os.answers };
  const state = { osNumber: os.osNumber, serviceCode: os.serviceCode };
  const changed = () => p.onDirty();

  const textField = (id: string, label: string, value: string, attrs: Record<string, string>, onValue: (v: string) => void) =>
    h(
      'div',
      null,
      h('label', { for: id, class: 'lbl' }, label),
      h('input', { id, class: 'field', autocomplete: 'off', value, ...attrs, onInput: (ev) => { onValue((ev.target as HTMLInputElement).value); changed(); } }),
    );

  /** Um bloco por pergunta; SIM/NÃO redesenham só o próprio bloco (mantém o foco e o que foi digitado nos outros). */
  const questionBlock = (q: Question): HTMLElement => {
    const block = h('div', { class: 'card p-4 space-y-3', 'data-question': q.id });
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
          id: `edit-${q.id}`,
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
      block.replaceChildren(title, choiceButtons(selected, choose, 'sm'));
      if (q.type === 'yesno_detail' && ans?.kind === 'choice' && ans.choice === 'Sim') {
        block.append(
          detailInput(q, ans.detail ?? '', (detail) => {
            const cur = answers[q.id];
            if (cur?.kind === 'choice') answers[q.id] = { ...cur, detail };
            changed();
          }),
        );
      }
    };
    draw();
    return block;
  };

  return h(
    'section',
    { id: 'screen-edit', class: 'space-y-4 pb-8' },
    h(
      'div',
      { class: 'card p-4 flex items-center justify-between gap-3' },
      h(
        'div',
        { class: 'min-w-0' },
        h(
          'div',
          { class: 'flex items-center gap-2 flex-wrap' },
          typeBadge(os.serviceType),
          h('span', { class: 'text-xs font-bold bg-brand/15 text-brand-fg px-2.5 py-0.5 rounded-md' }, 'Editando'),
        ),
        h('p', { class: 'text-xs text-muted mt-1' }, 'Altere o que precisar e toque em "Salvar alterações".'),
      ),
      h('button', { type: 'button', class: `${BTN.neutral} shrink-0`, onClick: p.onCancel }, 'Cancelar'),
    ),
    h(
      'div',
      { class: 'card p-4 grid grid-cols-2 gap-3' },
      textField('edit-os-number', 'Número da OS', state.osNumber, { inputmode: 'numeric', placeholder: 'Vazio = S/N' }, (v) => (state.osNumber = v)),
      textField('edit-os-code', 'Código do serviço', state.serviceCode, { inputmode: 'numeric', maxlength: '10' }, (v) => (state.serviceCode = v)),
    ),
    // A pergunta do número da OS é editada no campo acima.
    questionsFor(os.serviceType).filter((q) => !q.prefillOS).map(questionBlock),
    h(
      'button',
      { type: 'button', id: 'btn-edit-save', class: `w-full ${BTN_PRIMARY_LG}`, onClick: () => p.onSave({ ...state, answers: { ...answers } }) },
      icon(Save, 'w-5 h-5'),
      'Salvar alterações',
    ),
  );
}
