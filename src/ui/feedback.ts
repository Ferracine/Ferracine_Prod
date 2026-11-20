import { X } from 'lucide';
import { BTN, byId, h, icon } from './dom';

export type ToastType = 'info' | 'success' | 'warning' | 'error';

const TOAST_COLORS: Record<ToastType, string> = {
  info: 'bg-energisa-navy text-white border-energisa-blue',
  success: 'bg-emerald-700 text-white border-emerald-400',
  warning: 'bg-amber-600 text-white border-amber-300',
  error: 'bg-rose-700 text-white border-rose-400',
};

export function showToast(message: string, type: ToastType = 'info'): void {
  const toast = h(
    'div',
    {
      role: type === 'error' ? 'alert' : 'status',
      class: `${TOAST_COLORS[type]} border-l-4 px-4 py-3 rounded-xl shadow-lg text-sm font-medium pointer-events-auto transition-all duration-300`,
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
  variant: keyof typeof BTN;
  onClick: () => void;
}

let lastFocus: Element | null = null;

export function openModal(title: string, body: Node, actions: ModalAction[]): void {
  lastFocus = document.activeElement;
  const modal = byId('modal');
  const close = h('button', { type: 'button', class: 'text-slate-300 hover:text-white p-1 rounded-lg', 'aria-label': 'Fechar janela', onClick: closeModal }, icon(X, 'w-5 h-5'));
  const buttons = actions.map((a) => h('button', { type: 'button', class: BTN[a.variant], onClick: a.onClick }, a.label));
  modal.replaceChildren(
    h(
      'div',
      { class: 'bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'modal-title' },
      h('div', { class: 'bg-energisa-navy px-6 py-4 flex justify-between items-center text-white gap-3' }, h('h3', { id: 'modal-title', class: 'font-bold text-lg' }, title), close),
      h('div', { class: 'p-6 max-h-[70vh] overflow-y-auto text-sm text-slate-700 space-y-3' }, body),
      h('div', { class: 'bg-slate-50 px-6 py-4 flex flex-wrap justify-end gap-3 border-t border-slate-200' }, buttons),
    ),
  );
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  (buttons.at(-1) ?? close).focus();
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
