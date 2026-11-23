import { X } from 'lucide';
import { btn, type BtnTom, byId, h, icon } from './dom';

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
  label: string;
  variant: Exclude<BtnTom, 'outline' | 'ghost'>;
  onClick: () => void;
}

let lastFocus: Element | null = null;

export function openModal(title: string, body: Node, actions: ModalAction[]): void {
  lastFocus = document.activeElement;
  const modal = byId('modal');
  const close = h('button', { type: 'button', class: `${btn('ghost', 'icon')} -my-2 -mr-2`, 'aria-label': 'Fechar janela', onClick: closeModal }, icon(X, 'w-5 h-5'));
  const buttons = actions.map((a) => h('button', { type: 'button', class: btn(a.variant), onClick: a.onClick }, a.label));
  // Uma ação embaixo da outra na largura toda (rótulos como "Continuar preenchendo" não cabem lado a lado no
  // celular); a de confirmar fica embaixo, perto do polegar.
  for (const b of buttons) b.classList.add('w-full');
  const rodape = h('div', { class: 'grid grid-cols-1 sm:grid-cols-2 gap-3' }, buttons);
  modal.replaceChildren(
    h(
      'div',
      { class: 'janela bg-card rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-fg/10', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'modal-title' },
      h('div', { class: 'janela-titulo px-6 py-4 flex justify-between items-center gap-3 border-b border-fg/10' }, h('h3', { id: 'modal-title', class: 'font-bold text-lg text-fg' }, title), close),
      h('div', { class: 'p-6 max-h-[70vh] overflow-y-auto text-sm text-fg space-y-3' }, body),
      h('div', { class: 'bg-fg/5 px-6 py-4 border-t border-fg/10' }, rodape),
    ),
  );
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  (buttons.at(-1) ?? close).focus(); // a ação de confirmar
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
  // Ação perigosa (excluir, encerrar com pendência): um Enter por engano cancela em vez de confirmar.
  if (confirm.variant !== 'primary') byId('modal').querySelector<HTMLButtonElement>('[role="dialog"] button.btn-neutral')?.focus();
}
