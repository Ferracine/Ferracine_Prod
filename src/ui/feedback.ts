import { X } from 'lucide';
import { btn, type BtnTom, byId, gradeBotoes, h, icon } from './dom';

export type ToastType = 'info' | 'success' | 'warning' | 'error';

/**
 * Só a cor de fundo distingue o tipo (sem borda): ciano do logo = informação, verde = deu certo, âmbar = falta algo,
 * vermelho = erro. Todos sólidos: o aviso aparece por cima do cabeçalho e não pode se confundir com ele.
 */
const TOAST_COLORS: Record<ToastType, string> = {
  info: 'bg-brand-700 text-white',
  success: 'bg-ok text-white',
  warning: 'bg-warn text-white',
  error: 'bg-err text-white',
};

export function showToast(message: string, type: ToastType = 'info'): void {
  const toast = h(
    'div',
    {
      role: type === 'error' ? 'alert' : 'status',
      class: `${TOAST_COLORS[type]} px-4 py-3 rounded-xl shadow-lg break-words [overflow-wrap:anywhere] text-sm font-semibold pointer-events-auto transition-all duration-300`,
    },
    message,
  );
  byId('toast-container').append(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

export interface ModalAction {
  label: string | Node;
  variant: Exclude<BtnTom, 'outline' | 'ghost'>;
  onClick: () => void;
  /** Ocupa a linha inteira na grade de botões (ex.: "Encerrar turno"). */
  largo?: boolean;
  /** Recebe o foco ao abrir. Sem nenhum marcado, o foco vai para o último botão (a ação de confirmar). */
  autofocus?: boolean;
}

let lastFocus: Element | null = null;

export function openModal(title: string, body: Node, actions: ModalAction[]): void {
  lastFocus = document.activeElement;
  const modal = byId('modal');
  const close = h('button', { type: 'button', class: `${btn('ghost', 'icon')} -my-2 -mr-2`, 'aria-label': 'Fechar janela', onClick: closeModal }, icon(X, 'w-5 h-5'));
  const buttons = actions.map((a) => h('button', { type: 'button', class: btn(a.variant), onClick: a.onClick }, a.label));
  // Até 2 ações: uma embaixo da outra na largura toda (rótulos como "Continuar preenchendo" não cabem lado a lado no
  // celular); a de confirmar fica embaixo, perto do polegar. Mais que 2: grade de 2 colunas iguais.
  const largos = new Set(buttons.filter((_, i) => actions[i]!.largo));
  for (const b of buttons) b.classList.add('w-full');
  const rodape = buttons.length > 2 ? gradeBotoes(buttons, largos) : h('div', { class: 'grid grid-cols-1 sm:grid-cols-2 gap-3' }, buttons);
  modal.replaceChildren(
    h(
      'div',
      { class: 'bg-card rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-fg/10', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'modal-title' },
      h('div', { class: 'px-6 py-4 flex justify-between items-center gap-3 border-b border-fg/10' }, h('h3', { id: 'modal-title', class: 'font-bold text-lg text-fg' }, title), close),
      h('div', { class: 'p-6 max-h-[70vh] overflow-y-auto text-sm text-fg space-y-3' }, body),
      h('div', { class: 'bg-fg/5 px-6 py-4 border-t border-fg/10' }, rodape),
    ),
  );
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  const focusIndex = actions.findIndex((a) => a.autofocus);
  (buttons[focusIndex >= 0 ? focusIndex : buttons.length - 1] ?? close).focus();
}

export function isModalOpen(): boolean {
  return !byId('modal').classList.contains('hidden');
}

export function closeModal(): void {
  const modal = byId('modal');
  if (modal.classList.contains('hidden')) return;
  modal.classList.add('hidden');
  modal.classList.remove('flex');
  modal.replaceChildren();
  if (lastFocus instanceof HTMLElement) lastFocus.focus();
}

export function confirmModal(title: string, body: Node | string, confirm: Omit<ModalAction, 'onClick'>, onConfirm: () => void, cancelLabel = 'Cancelar'): void {
  openModal(title, typeof body === 'string' ? h('p', null, body) : body, [
    { label: cancelLabel, variant: 'neutral', onClick: closeModal },
    { ...confirm, onClick: () => { closeModal(); onConfirm(); } },
  ]);
}
